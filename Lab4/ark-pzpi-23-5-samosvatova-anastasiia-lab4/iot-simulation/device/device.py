import paho.mqtt.client as mqtt
import time
import json
import math
import os
import sys
import csv
import random
from datetime import datetime, timedelta
from collections import deque



MQTT_BROKER = os.getenv("MQTT_BROKER_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_BROKER_PORT", 1883))


HARDCODED_ID = "8ddcdaf6-98a5-428d-af68-53fb01169bcd"
GREENHOUSE_ID = os.getenv("GREENHOUSE_ID", HARDCODED_ID)

print(f" Configuration loaded:")
print(f"   - Broker: {MQTT_BROKER}:{MQTT_PORT}")
print(f"   - Greenhouse ID: {GREENHOUSE_ID}")

DEVICE_TOPIC_DATA = f"gh/{GREENHOUSE_ID}/telemetry"
DEVICE_TOPIC_COMMAND = f"gh/{GREENHOUSE_ID}/command"


INTERVAL_SEC = 2
VIRTUAL_STEP_HOURS = 0.05
AIR_DENSITY = 1.225
AIR_HEAT_CAPACITY = 1006
MAX_WATER_AT_20C = 17.3
OUTSIDE_TEMP_NIGHT = 6.0
OUTSIDE_TEMP_DAY = 14.0
OUTSIDE_HUMIDITY = 40.0

SIMULATION_START = datetime.now()
simulated_seconds = 0

env = {
    "temperature": 13.0,
    "humidity": 40.0,
    "soil_moisture": 40.0,
    "light": 15000,
    "hour": SIMULATION_START.hour
}

# Стан актуаторів
actuators = {
    "heater": {"on": False, "power": 0, "capacity": 2000},
    "fan": {"on": False, "power": 0, "capacity": 3000},
    "vent": {"on": False, "power": 0, "capacity": 10},
    "humidifier": {"on": False, "power": 0, "capacity": 500},
    "pump": {"on": False, "power": 0, "capacity": 50},
    "grow_light": {"on": False, "power": 0, "capacity": 20000}
}

DYNAMIC_PHYSICS = {}


#  БІЗНЕС-ЛОГІКА IOT

class LocalLogger:
    def __init__(self, filename="device_history.csv"):
        self.filename = filename
        if not os.path.exists(self.filename):
            with open(self.filename, mode='w', newline='') as file:
                writer = csv.writer(file)
                writer.writerow(["Timestamp", "Sensor", "Value", "IsAnomaly", "SentToCloud"])

    def log(self, timestamp, sensor_type, value, is_anomaly, sent):
        try:
            with open(self.filename, mode='a', newline='') as file:
                writer = csv.writer(file)
                writer.writerow([timestamp, sensor_type, value, is_anomaly, sent])
        except Exception as e:
            print(f" Log error: {e}")

class AnomalyDetector:
    def __init__(self, window_size=10, threshold_percent=0.6):
        self.window_size = window_size
        self.threshold = threshold_percent 
     
        self.history = {}
        self.ignored_sensors = {"light"}
    def is_anomaly(self, sensor_type, current_value):
        if sensor_type in self.ignored_sensors:
            return False
        if sensor_type not in self.history:
            self.history[sensor_type] = deque(maxlen=self.window_size)
        
        buffer = self.history[sensor_type]

        if len(buffer) < self.window_size:
            buffer.append(current_value)
            return False

        avg = sum(buffer) / len(buffer)
  
        if avg == 0: avg = 0.1 

        deviation = abs(current_value - avg) / abs(avg)

        if deviation > self.threshold:
            return True 

        buffer.append(current_value)
        return False


logger = LocalLogger()
detector = AnomalyDetector(window_size=10, threshold_percent=0.25) 


def calculate_physics(area=20, height=3):
    volume = area * height
    air_mass = volume * AIR_DENSITY
    time_step_sec = VIRTUAL_STEP_HOURS * 3600
    
    global DYNAMIC_PHYSICS
    DYNAMIC_PHYSICS = {
        "HEATER_W_TO_TEMP": time_step_sec / (air_mass * AIR_HEAT_CAPACITY),
        "FAN_M3H_TO_TEMP": ((time_step_sec / 3600) / volume) * 5,
        "VENT_TO_TEMP": ((time_step_sec / 3600) / volume) * 3,
        "HUMIDIFIER_TO_HUM": ((time_step_sec / 3600) / (volume * MAX_WATER_AT_20C)) * 100,
        "PUMP_TO_SOIL": (time_step_sec / 1000) / area * 2.0,
        "LIGHT_LUMEN_TO_LUX": 1 / area,
        "SOIL_DRY_RATE": 1.0 * VIRTUAL_STEP_HOURS
    }
    print(" Physics initialized")

# MQTT ЛОГІКА 

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        
        for type, state in payload.items():
            if type in actuators:
                actuators[type]["on"] = state.get("on", False)
                
                val = float(state.get("value", 0))
                actuators[type]["power"] = val / 100 if actuators[type]["on"] else 0
              
                if "capacity" in state and state["capacity"] is not None:
                    new_capacity = float(state["capacity"])
                    if new_capacity > 0 and actuators[type]["capacity"] != new_capacity:
                        actuators[type]["capacity"] = new_capacity
                        print(f"⚙️ Config update [{type}]: capacity -> {new_capacity}")

    except Exception as e:
        print(f"Error processing command: {e}")

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Connected to MQTT. Listening on {DEVICE_TOPIC_COMMAND}")
        client.subscribe(DEVICE_TOPIC_COMMAND)
    else:
        print(f"Connection failed with code {rc}")

client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

def connect_mqtt():
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f" Connection failed: {e}")
        time.sleep(5) 

def update_environment(virtual_time):

    env["hour"] = virtual_time.hour + virtual_time.minute / 60
    is_day = 6 <= env["hour"] <= 20
    
    out_temp = OUTSIDE_TEMP_DAY if is_day else OUTSIDE_TEMP_NIGHT
    env["temperature"] += (out_temp - env["temperature"]) * 0.1 * VIRTUAL_STEP_HOURS
  
    if actuators["heater"]["on"]:
        impact = actuators["heater"]["capacity"] * actuators["heater"]["power"] * DYNAMIC_PHYSICS["HEATER_W_TO_TEMP"]
        env["temperature"] += impact
        
    if actuators["fan"]["on"]:
        impact = actuators["fan"]["capacity"] * actuators["fan"]["power"] * DYNAMIC_PHYSICS["FAN_M3H_TO_TEMP"]
        env["temperature"] -= impact

    if actuators["vent"]["on"]:
        impact = actuators["vent"]["capacity"] * actuators["vent"]["power"] * DYNAMIC_PHYSICS["VENT_TO_TEMP"]
        env["temperature"] -= impact
        env["humidity"] -= (env["humidity"] - OUTSIDE_HUMIDITY) * 0.1 * actuators["vent"]["power"]

    env["humidity"] += (OUTSIDE_HUMIDITY - env["humidity"]) * 0.05 * VIRTUAL_STEP_HOURS
    if actuators["humidifier"]["on"]:
        impact = actuators["humidifier"]["capacity"] * actuators["humidifier"]["power"] * DYNAMIC_PHYSICS["HUMIDIFIER_TO_HUM"]
        env["humidity"] += impact

    env["soil_moisture"] -= DYNAMIC_PHYSICS["SOIL_DRY_RATE"]
    if actuators["pump"]["on"]:
        impact = actuators["pump"]["capacity"] * actuators["pump"]["power"] * DYNAMIC_PHYSICS["PUMP_TO_SOIL"]
        env["soil_moisture"] += impact

    env["soil_moisture"] = max(0, min(100, env["soil_moisture"]))
    env["humidity"] = max(0, min(100, env["humidity"]))

    natural_lux = 16000 * math.sin(((env["hour"] - 6) / 14) * math.pi) if is_day else 0
    natural_lux = max(0, natural_lux)
    
    artificial_lux = 0
    if actuators["grow_light"]["on"]:
        artificial_lux = actuators["grow_light"]["capacity"] * actuators["grow_light"]["power"] * DYNAMIC_PHYSICS["LIGHT_LUMEN_TO_LUX"]
    
    env["light"] = int(natural_lux + artificial_lux)

if __name__ == "__main__":
    calculate_physics()
    connect_mqtt()
    
    print(" Simulation started with Anomaly Detection & Local Logging...")
    print(f" Logs are saved to: {logger.filename}")
    
    while True:
        simulated_seconds += VIRTUAL_STEP_HOURS * 3600
        virtual_time = SIMULATION_START + timedelta(seconds=simulated_seconds)
   
        update_environment(virtual_time)
     
        simulated_env = env.copy()
        if random.random() < 0.05: 
            print(" SIMULATING SENSOR SPIKE (GLITCH)!")
            simulated_env["temperature"] += 50 

        data_to_send = {}
        status_parts = []

        for sensor_type, value in simulated_env.items():
            if sensor_type == "hour": continue 

        
            is_anomaly = detector.is_anomaly(sensor_type, value)
         
            should_send = not is_anomaly
          
            logger.log(virtual_time.isoformat(), sensor_type, value, is_anomaly, should_send)

            if should_send:
                data_to_send[sensor_type] = round(value, 2)
                status_parts.append(f"{sensor_type[0].upper()}:{value:.1f}")
            else:
                status_parts.append(f"{sensor_type[0].upper()}:[SKIP {value:.1f}]")
    
        if client.is_connected() and data_to_send:
            payload = {
                "timestamp": virtual_time.isoformat(),
                "data": data_to_send
            }
            client.publish(DEVICE_TOPIC_DATA, json.dumps(payload))
      
            active = []
            if actuators['heater']['on']: active.append("HEAT:ON|")
            if actuators['grow_light']['on']: active.append("LIGHT:ON|")
            if actuators['fan']['on']: active.append("FAN:ON|")
            if actuators['pump']['on']: active.append("WATER:ON|")
            if actuators['vent']['on']: active.append("VENT:ON|")
            print(f" {virtual_time.strftime('%H:%M')} | {' '.join(status_parts)} | {' '.join(active)}")
        
        elif not client.is_connected():
             print(" MQTT Disconnected")
             try: client.reconnect()
             except: pass
        
        time.sleep(INTERVAL_SEC)