const db = require('../config/db');
const { greenhouses, crops, sensors, actuators, readings } = require('../db/schema');
const { eq, and, desc } = require('drizzle-orm');
const IoTRepo = require('../repositories/iotRepository');
const NotificationRepo = require('../repositories/notificationRepository');

const AIR_HEAT_CAPACITY = 1006; // Дж/(кг*°C)
const AIR_DENSITY = 1.225; // кг/м³

const PREDICTION_TIME_SECONDS = 300; 

class AutomationService {
  
  async processTelemetry(greenhouseId, sensorType, value, timestamp = new Date()) {
     console.log(`\n[AUTO] GH:${greenhouseId} | ${sensorType}: ${value} ${timestamp}`);

    try {
        const greenhouse = await db.query.greenhouses.findFirst({
            where: eq(greenhouses.id, greenhouseId),
            with: { activeCrop: true }
        });

        if (!greenhouse || !greenhouse.activeCrop) return;
        const crop = greenhouse.activeCrop;

        const trend = await this.calculateTrend(sensorType, greenhouseId, value);
        const virtualTime = new Date(timestamp);

        if (Math.abs(trend) > 0.001) {
             console.log(`[TREND] ${sensorType}: ${trend > 0 ? '+' : ''}${trend.toFixed(4)} / sec`);
        }

        switch (sensorType) {
            case 'soil_moisture':
                await this.handleSoilMoisture(greenhouse, crop, value, trend);
                break;
            case 'temperature':
                await this.handleTemperature(greenhouse, crop, value, trend);
                break;
            case 'humidity':
                await this.handleAirHumidity(greenhouse, crop, value, trend);
                break;
            case 'light':
                await this.handleLighting(greenhouse, crop, value, virtualTime);
                break;
        }
    } catch (err) {
        console.error("[AUTO-CRASH]", err);
    }
  }

  
  async calculateTrend(sensorType, greenhouseId, currentValue) {
      const sensor = await this.findSensor(greenhouseId, sensorType);
      if (!sensor) return 0;

      const history = await db.query.readings.findMany({
          where: eq(readings.sensorId, sensor.id),
          orderBy: desc(readings.timestamp),
          limit: 2
      });

      if (history.length < 2) return 0; 

      const latest = history[0]; 
      const previous = history[1]; 

      const timeDiffSeconds = (latest.timestamp - previous.timestamp) / 1000;
      if (timeDiffSeconds === 0) return 0;

      const valueDiff = parseFloat(latest.value) - parseFloat(previous.value);

      return valueDiff / timeDiffSeconds;
  }

  async checkAndAlert(ghId, message, severity, keyPhrase) {
      try {
          const alreadySent = await NotificationRepo.hasRecentNotification(ghId, keyPhrase, 30, severity);
          
          if (!alreadySent) {
              console.log(`[ALERT] Creating notification: ${message}`);
              await NotificationRepo.create(ghId, message, severity);
          }
      } catch (e) {
          console.error("Notification Error:", e.message);
      }
  }

  async checkAndAlertRecovery(ghId, message, keyPhrase) {
      try {
          const lastSeverity = await NotificationRepo.getLastSeverity(ghId, keyPhrase);
          
          if (lastSeverity === 'CRITICAL' || lastSeverity === 'WARNING') {
              
              const alreadyResolved = await NotificationRepo.hasRecentNotification(ghId, 'Resolved', 10);
              
              if (!alreadyResolved) {
                  console.log(`[RECOVERY] Creating notification: ${message}`);
                  await NotificationRepo.create(ghId, `Resolved: ${message}`, 'INFO');
              }
          }
      } catch (e) {
          console.error("Recovery Alert Error:", e.message);
      }
  }

  calculateMaxWaterInAir(temp) {
      const es = 6.112 * Math.exp((17.67 * temp) / (temp + 243.5));
      return (es * 216.7) / (temp + 273.15);
  }

  
  async handleSoilMoisture(greenhouse, crop, currentVal, trend) {
    const min = parseFloat(crop.idealSoilMoistureMin);
    const max = parseFloat(crop.idealSoilMoistureMax);
    const target = (min + max) / 2;
    const keyPhrase = 'Soil moisture';

    const predictedVal = currentVal + (trend * 300);

     if (currentVal < 30) {
        await this.checkAndAlert(greenhouse.id, `CRITICAL: Soil moisture extremely low (${currentVal}%)!`, 'CRITICAL', keyPhrase);
    } else if (currentVal < min - 5) {
        await this.checkAndAlert(greenhouse.id, `Warning: Soil moisture is low (${currentVal}%).`, 'WARNING', keyPhrase);
    } else if (currentVal >= min && currentVal <= max) {
        await this.checkAndAlertRecovery(greenhouse.id, `Soil moisture returned to optimal range.`, keyPhrase);
    }

    if (trend > 0.05 && currentVal > (min - 2)) {
        console.log(`[SMART] Soil rising fast (+${trend.toFixed(3)}/s). Skipping pump to prevent overshoot.`);
        await this.toggleActuator(greenhouse.id, 'pump', false, 'AUTO:InertiaStop');
        return;
    }

    if (currentVal >= target) { 
        await this.toggleActuator(greenhouse.id, 'pump', false, 'AUTO:TargetReached');
        return;
    }
    if (currentVal > min) return; 

    const deficit = max - currentVal; 
    const area = parseFloat(greenhouse.areaSqMeters);
    const waterFactor = crop.waterNeedFactor; 
    const waterVolumeMl = deficit * area * waterFactor; 

    const pump = await this.findActuator(greenhouse.id, 'pump');
    if (!pump) return;

    if (!pump.currentState && waterVolumeMl > 50) {
        const flowRate = parseFloat(pump.capacity) || 50; 
        const duration = waterVolumeMl / flowRate;

        console.log(`[ACTION] Pump ON for ${duration.toFixed(1)}s (Trend: ${trend.toFixed(4)})`);
        await IoTRepo.updateActuatorState(pump.id, true, 100, `AUTO:Watering ${waterVolumeMl.toFixed(0)}ml`);
        
        setTimeout(async () => {
            await IoTRepo.updateActuatorState(pump.id, false, 0, 'AUTO:CycleEnd');
        }, duration * 1000);
    }
  }

  async handleTemperature(greenhouse, crop, currentVal, trend) {
      const min = parseFloat(crop.idealTempMin);
      const max = parseFloat(crop.idealTempMax);
      const keyPhrase = 'Temperature';
      const target = (min + max) / 2;
   
      const predictedVal = currentVal + (trend * 60);
      
      const area = parseFloat(greenhouse.areaSqMeters);
      const height = parseFloat(greenhouse.heightMeters) || 3.0;
      const volume = area * height; 
      const airMassKg = volume * AIR_DENSITY;

    if (currentVal < (min - 5)) {
            await this.checkAndAlert(greenhouse.id, `CRITICAL: Freezing risk! Temp: ${currentVal}°C`, 'CRITICAL', keyPhrase);
        } else if (currentVal < (min - 2)) {
            await this.checkAndAlert(greenhouse.id, `Warning: Low temperature (${currentVal}°C).`, 'WARNING', keyPhrase);
        } else if (currentVal > (max + 5)) {
            await this.checkAndAlert(greenhouse.id, `CRITICAL: Overheating! Temp: ${currentVal}°C`, 'CRITICAL', keyPhrase);
        } else if (currentVal > (max + 2)) {
            await this.checkAndAlert(greenhouse.id, `Warning: High temperature (${currentVal}°C).`, 'WARNING', keyPhrase);
        } else if (currentVal >= min && currentVal <= max) {
            await this.checkAndAlertRecovery(greenhouse.id, `Temperature normalized (${currentVal}°C).`, keyPhrase);
        }

      const heater = await this.findActuator(greenhouse.id, 'heater');
      const fan = await this.findActuator(greenhouse.id, 'fan');
      const vent = await this.findActuator(greenhouse.id, 'vent');

      if (currentVal < min || (currentVal < target && predictedVal < target)) {
          const deltaT = target - currentVal; 
          
          if (heater) {
              const heaterCapacityW = parseFloat(heater.capacity) || 2000;
              let powerNeededW = (AIR_HEAT_CAPACITY * airMassKg * deltaT) / 600; 
              
              if (trend > 0) {
                  const trendBrake = (AIR_HEAT_CAPACITY * airMassKg * (trend * 300)) / 600;
                  powerNeededW -= trendBrake;
              }
              
              let percent = (powerNeededW / heaterCapacityW) * 100;
              percent = Math.min(100, Math.max(0, percent));

              if (percent > 5) {
                  if (currentVal > (target - 1) && trend > 0.05) {
                       await this.setActuator(heater, false, 0, 'AUTO:Coast(Inertia)');
                  } else {
                       await this.setActuator(heater, true, percent, `AUTO:Heat(Target ${target})`);
                  }
              } else {
                  await this.setActuator(heater, false, 0, 'AUTO:Coast');
              }
          }
          if (fan) await this.setActuator(fan, false, 0, 'AUTO:SaveHeat');
          if (vent) await this.setActuator(vent, false, 0, 'AUTO:SaveHeat');
      } 
   
      else if (currentVal > target) {
          const deltaT = currentVal - target;

          if (fan) {

              if (predictedVal > max || currentVal > max) {
                  const fanCapacityM3H = parseFloat(fan.capacity) || 5000;
      
                  let requiredFlow = volume * (10 + deltaT * 10); 
    

                  if (trend > 0) requiredFlow += (volume * 200 * trend); 
              
                  else requiredFlow += (volume * 500 * trend); 
    
                  let percent = (requiredFlow / fanCapacityM3H) * 100;
                  percent = Math.min(100, Math.max(0, percent));
    
                  if (percent > 10) await this.setActuator(fan, true, percent, `AUTO:Cool(Target ${target})`);
                  else await this.setActuator(fan, false, 0, 'AUTO:Coast');
              } else {
                  await this.setActuator(fan, false, 0, 'AUTO:ComfortZone');
              }
          }
          
          if (vent) {
               if (predictedVal > max || currentVal > max) {
                   let angle = (deltaT * 15) + (trend * 500);
                   angle = Math.min(100, Math.max(0, angle));
                   if (angle > 5) await this.setActuator(vent, true, angle, `AUTO:Vent`);
                   else await this.setActuator(vent, false, 0, 'AUTO:Close');
               } else {
                   await this.setActuator(vent, false, 0, 'AUTO:ComfortZone');
               }
          }
          if (heater) await this.setActuator(heater, false, 0, 'AUTO:StopHeat');
      }
      else {
          if (heater) await this.setActuator(heater, false, 0, 'AUTO:Optimal');
          if (fan) await this.setActuator(fan, false, 0, 'AUTO:Optimal');
          if (vent) await this.setActuator(vent, false, 0, 'AUTO:Optimal');
      }
  }

 
  async handleAirHumidity(greenhouse, crop, currentVal, trend) {
      const min = parseFloat(crop.idealAirHumidityMin);
      const max = parseFloat(crop.idealAirHumidityMax);
      const keyPhrase = 'Humidity';

      const predictedVal = currentVal + (trend * PREDICTION_TIME_SECONDS);
      const target = (min + max) / 2;
      const humidifier = await this.findActuator(greenhouse.id, 'humidifier');
      const vent = await this.findActuator(greenhouse.id, 'vent');

      if (currentVal > (max + 5)) {
           await this.checkAndAlert(greenhouse.id, `Warning: High humidity (${currentVal}%). Risk of mold!`, 'WARNING', keyPhrase);
      } else if (currentVal < (min - 5)) {
           await this.checkAndAlert(greenhouse.id, `Warning: Low humidity (${currentVal}%). Risk of drying!`, 'WARNING', keyPhrase);
      } else if (currentVal >= min && currentVal <= max) {
           await this.checkAndAlertRecovery(greenhouse.id, `Humidity normalized.`, keyPhrase);
      }
      if (predictedVal < min) {
          if (humidifier) {
               const deficit = target - currentVal;
              let power = (deficit * 5) - (trend * 1000); 
              power = Math.min(100, Math.max(10, power));

               await this.setActuator(humidifier, true, power, `AUTO:Humidify(Target ${target})`);
          }
      } 

      else if (predictedVal > max) {
          if (vent) {
              const excess = currentVal - target;
              let power = (excess * 5) + (trend * 1000);
              power = Math.min(100, Math.max(10, power));
              
             await this.setActuator(vent, true, power, `AUTO:Dehumidify(Target ${target})`);
          }
          if (humidifier) await this.setActuator(humidifier, false, 0, 'AUTO:StopHumidify');
      }
      else {
          if (humidifier) await this.setActuator(humidifier, false, 0, 'AUTO:Optimal');
      }
  }

 
  async handleLighting(greenhouse, crop, currentLux, currentTime = new Date()) {
      const targetLux = crop.idealLightLevel;
      const dayLength = crop.requiredDayHours;
      const area = parseFloat(greenhouse.areaSqMeters);
      const keyPhrase = 'Light';
    
     const currentHour = currentTime.getHours();
      const isDayTime = currentHour >= 6 && currentHour < (6 + dayLength);

      if (isDayTime) {
          if (currentLux  < (targetLux * 0.5)) {
              await this.checkAndAlert(greenhouse.id, `CRITICAL: Low light (${currentLux} lux). Growth stalled!`, 'CRITICAL', keyPhrase);
          } else if (currentLux  < (targetLux * 0.8)) {
              await this.checkAndAlert(greenhouse.id, `Warning: Low light level (${currentLux} lux).`, 'WARNING', keyPhrase);
          } else if (currentLux  >= targetLux) {
              await this.checkAndAlertRecovery(greenhouse.id, `Light level optimal.`, keyPhrase);
          }
      }
      const growLight = await this.findActuator(greenhouse.id, 'grow_light');
      if (!growLight) return;

      if (isDayTime) {
         
          const maxLampLux = (parseFloat(growLight.capacity) || 20000) / area;
          const currentLampContribution = growLight.currentState 
              ? (maxLampLux * (parseFloat(growLight.currentValue) / 100)) 
              : 0;

          const naturalLux = Math.max(0, currentLux - currentLampContribution);
          
          if (naturalLux < targetLux) {
              const neededArtificial = targetLux - naturalLux;
              let percent = (neededArtificial / maxLampLux) * 100;
              percent = Math.min(100, Math.max(0, percent));

              await this.setActuator(growLight, true, percent, `AUTO:SmartLight`);
          } else {
              await this.setActuator(growLight, false, 0, 'AUTO:SunEnough');
          }
      } else {
          await this.setActuator(growLight, false, 0, 'AUTO:NightMode');
      }
  }

  async findActuator(ghId, type) {
      return await db.query.actuators.findFirst({
          where: and(eq(actuators.greenhouseId, ghId), eq(actuators.type, type))
      });
  }
  async findSensor(ghId, type) {
      return await db.query.sensors.findFirst({
          where: and(eq(sensors.greenhouseId, ghId), eq(sensors.type, type))
      });
  }
  async getLastReading(sensorId) {
      return await db.query.readings.findFirst({
          where: eq(readings.sensorId, sensorId),
          orderBy: desc(readings.timestamp)
      });
  }
  async toggleActuator(ghId, type, state, reason) {
      const act = await this.findActuator(ghId, type);
      if (act && act.currentState !== state) {
          await IoTRepo.updateActuatorState(act.id, state, state ? 100 : 0, reason);
      }
  }
  async setActuator(actuator, state, value, reason) {
      const currentVal = parseFloat(actuator.currentValue || 0);
      const diff = Math.abs(currentVal - value);
    
      if (actuator.currentState !== state || (state === true && diff > 5)) {
          console.log(` [SMART-SET] ${actuator.type}: ${value.toFixed(1)}% (was ${currentVal.toFixed(1)}%)`);
          await IoTRepo.updateActuatorState(actuator.id, state, value, reason);
      }
  }
}

module.exports = new AutomationService();