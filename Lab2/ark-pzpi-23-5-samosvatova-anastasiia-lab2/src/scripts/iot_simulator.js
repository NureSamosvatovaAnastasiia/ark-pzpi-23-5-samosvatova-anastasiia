const axios = require('axios');
const db = require('../config/db');
const { sensors, greenhouses, actuators } = require('../db/schema');
const { eq } = require('drizzle-orm');

const API_URL = 'http://localhost:3000/api/v1/iot/telemetry';
const INTERVAL_MS = 1200;          
const VIRTUAL_STEP_HOURS = 0.05;   


const SIMULATION_START = new Date();
let simulatedMs = 0;

const AIR_DENSITY = 1.225;
const AIR_HEAT_CAPACITY = 1006;
const MAX_WATER_AT_20C = 17.3;


const OUTSIDE_TEMP_NIGHT = 6.0;
const OUTSIDE_TEMP_DAY = 14.0;
const OUTSIDE_HUMIDITY = 40.0; 


let env = {
    temperature: 13.0,
    humidity: 40.0,
    soil_moisture: 40.0,
    light: 15000,
    hour: SIMULATION_START.getHours() + SIMULATION_START.getMinutes() / 60
};

let DYNAMIC_PHYSICS = {};
const toLocalISOString = (date) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, -1);
};

const calculatePhysics = (area, height) => {
    const volume = area * height;
    const airMass = volume * AIR_DENSITY;
    const timeStepSeconds = VIRTUAL_STEP_HOURS * 3600;

    console.log(`\nPhysics Engine Initialized`);
    console.log(`   Volume: ${volume.toFixed(1)} m³`);
    console.log(`   Virtual step: ${timeStepSeconds.toFixed(0)} sec`);

    DYNAMIC_PHYSICS = {
        HEATER_W_TO_TEMP: timeStepSeconds / (airMass * AIR_HEAT_CAPACITY),
        FAN_M3H_TO_TEMP: ((timeStepSeconds / 3600) / volume) * 5,
        VENT_TO_TEMP: ((timeStepSeconds / 3600) / volume) * 3,
    
        HUMIDIFIER_TO_HUM: ((timeStepSeconds / 3600) / (volume * MAX_WATER_AT_20C)) * 100,
        
        PUMP_TO_SOIL: (timeStepSeconds / 1000) / area * 2.0,
        LIGHT_LUMEN_TO_LUX: 1 / area,
        SOIL_DRY_RATE: 1.0 * VIRTUAL_STEP_HOURS
    };
};

const getActiveActuators = async (greenhouseId) => {
    const devices = await db
        .select()
        .from(actuators)
        .where(eq(actuators.greenhouseId, greenhouseId));

    const status = {};
    devices.forEach(d => {
        status[d.type] = {
            on: d.currentState,
            power: d.currentState ? (parseFloat(d.currentValue) || 100) / 100 : 0,
            capacity: parseFloat(d.capacity) || 0
        };
    });
    return status;
};

const updateEnvironment = (devices, virtualTime) => {
    env.hour =
        virtualTime.getHours() +
        virtualTime.getMinutes() / 60 +
        virtualTime.getSeconds() / 3600;

    const isDay = env.hour >= 6 && env.hour <= 20;
   
    const outsideTemp = isDay ? OUTSIDE_TEMP_DAY : OUTSIDE_TEMP_NIGHT;
    env.temperature += (outsideTemp - env.temperature) * 0.1 * VIRTUAL_STEP_HOURS;

    if (devices.heater?.on) {
        const impact =
            devices.heater.capacity *
            devices.heater.power *
            DYNAMIC_PHYSICS.HEATER_W_TO_TEMP;

        env.temperature += impact;
        console.log(`Heater +${impact.toFixed(2)}°C`);
    }

    if (devices.fan?.on) {
        const impact =
            devices.fan.capacity *
            devices.fan.power *
            DYNAMIC_PHYSICS.FAN_M3H_TO_TEMP;

        env.temperature -= impact;
        console.log(`Fan -${impact.toFixed(2)}°C`);
    }

    if (devices.vent?.on) {
        const impact =
            devices.vent.capacity *
            devices.vent.power *
            DYNAMIC_PHYSICS.VENT_TO_TEMP;

        env.temperature -= impact;
        env.humidity -= (env.humidity - OUTSIDE_HUMIDITY) * 0.1 * devices.vent.power; 
        console.log(`Vent -${impact.toFixed(2)}°C`);
    }


    env.humidity += (OUTSIDE_HUMIDITY - env.humidity) * 0.05 * VIRTUAL_STEP_HOURS;

    if (devices.humidifier?.on) {
        const impact = 
            devices.humidifier.capacity * devices.humidifier.power * DYNAMIC_PHYSICS.HUMIDIFIER_TO_HUM;
        
        env.humidity += impact;
        console.log(`Humidifier +${impact.toFixed(2)}%`);
    }

    env.soil_moisture -= DYNAMIC_PHYSICS.SOIL_DRY_RATE;

    if (devices.pump?.on) {
        const impact =
            devices.pump.capacity *
            devices.pump.power *
            DYNAMIC_PHYSICS.PUMP_TO_SOIL;

        env.soil_moisture += impact;
        console.log(`Pump +${impact.toFixed(2)}%`);
    }

    env.soil_moisture = Math.max(0, Math.min(100, env.soil_moisture));
    env.humidity = Math.max(0, Math.min(100, env.humidity));

    let naturalLux = 0;
    if (isDay) {
        naturalLux =
            16000 *
            Math.sin(((env.hour - 6) / 14) * Math.PI);
        naturalLux = Math.max(0, naturalLux);
    }

    let artificialLux = 0;
    if (devices.grow_light?.on) {
        artificialLux =
            devices.grow_light.capacity *
            devices.grow_light.power *
            DYNAMIC_PHYSICS.LIGHT_LUMEN_TO_LUX;

        console.log(`Grow light +${artificialLux.toFixed(0)} lux`);
    }

    env.light = naturalLux + artificialLux;
};

const startSimulation = async () => {
    console.log('IoT Simulator started');

    const gh = await db.query.greenhouses.findFirst();
    if (!gh) {
        console.error('No greenhouse found');
        process.exit(1);
    }

    const area = parseFloat(gh.areaSqMeters) || 20;
    const height = parseFloat(gh.heightMeters) || 3;
    calculatePhysics(area, height);

    const allSensors = await db
        .select()
        .from(sensors)
        .where(eq(sensors.greenhouseId, gh.id));

    const sensorMap = {};
    allSensors.forEach(s => (sensorMap[s.type] = s.id));

    setInterval(async () => {
        simulatedMs += VIRTUAL_STEP_HOURS * 3600 * 1000;
        const virtualTime = new Date(
            SIMULATION_START.getTime() + simulatedMs
        );

        const devices = await getActiveActuators(gh.id);
        updateEnvironment(devices, virtualTime);

        console.log(
            `\n ${virtualTime.toLocaleTimeString()} | ` +
            `T:${env.temperature.toFixed(1)}°C | ` +
            `H:${env.humidity.toFixed(1)}% | ` +
            `S:${env.soil_moisture.toFixed(1)}% | ` +
            `L:${env.light.toFixed(0)}`
        );

        for (const [type, id] of Object.entries(sensorMap)) {
            const value = env[type];
            if (value === undefined) continue;

            await axios.post(API_URL, {
                sensorId: id,
                value: value.toFixed(2),
                timestamp: toLocalISOString(virtualTime)
            }).catch(() => {});
        }
    }, INTERVAL_MS);
};

startSimulation();