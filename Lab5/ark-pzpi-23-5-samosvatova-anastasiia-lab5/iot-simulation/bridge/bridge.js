const mqtt = require('mqtt');
const axios = require('axios');


const MQTT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const API_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/v1';

const USER_EMAIL = process.env.USER_EMAIL || 'string1';
const USER_PASS = process.env.USER_PASS || 'string';



const GREENHOUSE_ID = process.env.GREENHOUSE_ID || '8ddcdaf6-98a5-428d-af68-53fb01169bcd';


if (!GREENHOUSE_ID || !USER_EMAIL || !USER_PASS) {
    console.error("Помилка: Не передані обов'язкові змінні оточення!");
    if (!GREENHOUSE_ID) console.error("   - GREENHOUSE_ID");
    if (!USER_EMAIL) console.error("   - USER_EMAIL");
    if (!USER_PASS) console.error("   - USER_PASS");
    
    process.exit(1);
}

let authToken = null;
let sensorMap = {}; 
const TOPIC_SYSTEM_CONFIG = 'system/config';
const TOPIC_TELEMETRY = `gh/${GREENHOUSE_ID}/telemetry`;
const TOPIC_COMMAND = `gh/${GREENHOUSE_ID}/command`;

const REQUIRED_SENSORS = ['temperature', 'humidity', 'soil_moisture', 'light'];
const REQUIRED_ACTUATORS = [
    { type: 'heater', cap: 2000 }, { type: 'fan', cap: 3000 }, 
    { type: 'vent', cap: 10 }, { type: 'humidifier', cap: 500 }, 
    { type: 'pump', cap: 50 }, { type: 'grow_light', cap: 20000 }
];


async function initializeSystem() {
    try {
        console.log(`Логін...`);
        const loginResp = await axios.post(`${API_URL}/auth/login`, {
            email: USER_EMAIL, password: USER_PASS
        });
        authToken = loginResp.data.accessToken || loginResp.data.token;
        console.log(`Успішний вхід. Теплиця: ${GREENHOUSE_ID}`);

        
        const sensorsResp = await axios.get(`${API_URL}/iot/greenhouses/${GREENHOUSE_ID}/sensors`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const existingSensorTypes = sensorsResp.data.map(s => s.type);

        for (const type of REQUIRED_SENSORS) {
            if (!existingSensorTypes.includes(type)) {
                console.log(`Створення сенсору: ${type}`);
                await axios.post(`${API_URL}/sensors`, {
                    greenhouseId: GREENHOUSE_ID,
                    type: type,
                    name: `${type} Sensor`
                }, { headers: { Authorization: `Bearer ${authToken}` }});
            }
        }

        const actuatorsResp = await axios.get(`${API_URL}/iot/greenhouses/${GREENHOUSE_ID}/actuators`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const existingAct = actuatorsResp.data.map(a => a.type);

        for (const dev of REQUIRED_ACTUATORS) {
            if (!existingAct.includes(dev.type)) {
                console.log(`Створення актуатору: ${dev.type}`);
                await axios.post(`${API_URL}/actuators`, {
                    greenhouseId: GREENHOUSE_ID,
                    type: dev.type,
                    name: `Auto ${dev.type}`,
                    capacity: String(dev.cap)
                }, { headers: { Authorization: `Bearer ${authToken}` }});
            }
        }

        const finalSensors = await axios.get(`${API_URL}/iot/greenhouses/${GREENHOUSE_ID}/sensors`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        finalSensors.data.forEach(s => sensorMap[s.type] = s.id);
        
        console.log("Обладнання готове.");
        return true;

    } catch (e) {
        console.error("Помилка:", e.message);
        if (e.response && e.response.status === 404) {
            console.error("Теплиця не знайдена");
            process.exit(1);
        }
        return false;
    }
}


const client = mqtt.connect(MQTT_BROKER);

client.on('connect', async () => {
    console.log('Bridge підключений к MQTT');
    
    let ready = false;
    while (!ready) {
        ready = await initializeSystem();
        if (!ready) await new Promise(r => setTimeout(r, 5000));
    }

    client.publish(TOPIC_SYSTEM_CONFIG, JSON.stringify({ greenhouseId: GREENHOUSE_ID }), { retain: true });
    console.log(`Конфігурація відправлена на пристрій`);
    
    client.subscribe(TOPIC_TELEMETRY);
    setInterval(syncActuators, 2000);
});

client.on('message', async (topic, message) => {
    if (authToken && topic.includes('telemetry')) {
        try {
            const payload = JSON.parse(message.toString());
            for (const [type, value] of Object.entries(payload.data)) {
                const sensorId = sensorMap[type];
                if (sensorId) {
                    axios.post(`${API_URL}/iot/telemetry`, {
                        sensorId, value, timestamp: payload.timestamp
                    }, { headers: { Authorization: `Bearer ${authToken}` } }).catch(()=>{});
                }
            }
        } catch (e) { console.error(e.message); }
    }
});

async function syncActuators() {
    if (!authToken) return;
    try {
        const resp = await axios.get(`${API_URL}/iot/greenhouses/${GREENHOUSE_ID}/actuators`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const cmd = {};
        resp.data.forEach(a => {
            cmd[a.type] = { 
                on: a.currentState, 
                value: parseFloat(a.currentValue || 0),
                capacity: parseFloat(a.capacity || 0)
            };
        });
        client.publish(TOPIC_COMMAND, JSON.stringify(cmd));
    } catch (e) { }
}