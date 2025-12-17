const IoTRepo = require('../repositories/iotRepository');
const GreenhouseRepo = require('../repositories/greenhouseRepository');
const db = require('../config/db');
const { sensors } = require('../db/schema');
const { eq } = require('drizzle-orm');
const AutomationService = require('../services/automationService');


const receiveTelemetry = async (req, res, next) => {
    try {
        const sensorId = req.body.sensorId || req.body.sensor_id;
        const value = Number(req.body.value);
        const timestamp = req.body.timestamp; 

        if (!sensorId || isNaN(value)) {
            return res.status(400).json({ message: 'Invalid data' });
        }
  
        await IoTRepo.saveReading(sensorId, value, timestamp);

        const sensor = await db.query.sensors.findFirst({ where: eq(sensors.id, sensorId) });
        
        if (sensor) {

            const timeLog = timestamp ? `[Time: ${new Date(timestamp).toLocaleTimeString()}]` : '';
            console.log(`📡 Recv ${timeLog}: ${sensor.type} = ${value}`);

            AutomationService.processTelemetry(sensor.greenhouseId, sensor.type, value, timestamp)
                .catch(err => console.error(' Auto error:', err));
        }

        res.status(201).json({ success: true });
    } catch (e) { 
        console.error(' Telemetry error:', e);
        next(e);
    }
};


const addManualReading = async (req, res, next) => {
    try {
        const { sensorId, value } = req.body;

        if (!sensorId || value === undefined) {
            return res.status(400).json({ error: 'sensorId and value are required' });
        }

        const sensor = await db.query.sensors.findFirst({
            where: eq(sensors.id, sensorId)
        });

        if (!sensor) return res.status(404).json({ error: 'Sensor not found' });

        const gh = await GreenhouseRepo.findById(sensor.greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied: You do not own this sensor' });
        }

        const readingVal = parseFloat(value);
        await IoTRepo.saveReading(sensorId, readingVal);
        
        console.log(`👤 Manual Input [User:${req.user.username}]: ${sensor.type} = ${readingVal}`);

        AutomationService.processTelemetry(sensor.greenhouseId, sensor.type, readingVal)
            .catch(err => console.error('❌ Auto error (Manual):', err));

        res.status(201).json({ message: 'Reading added manually', sensor: sensor.type, value: readingVal });
    } catch (e) { next(e); }
};

const getDashboard = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
        const gh = await GreenhouseRepo.findById(greenhouseId);
        
        if (!gh || gh.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const data = await IoTRepo.getLatestReadings(greenhouseId);
        res.json(data);
    } catch (e) { next(e); }
};


const updateActuator = async (req, res, next) => {
    try {
        const { id } = req.params; 
        const { state, value } = req.body; 

        if (state === undefined) {
            return res.status(400).json({ error: 'State (boolean) is required' });
        }
        
        const result = await IoTRepo.updateActuatorState(id, state, value, `USER:${req.user.id}`);
        
        res.json({ message: 'Actuator updated', device: result });
    } catch (e) { next(e); }
};

const editActuatorConfig = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, type, capacity } = req.body;

        const actuator = await IoTRepo.getActuatorById(id);
        if (!actuator) return res.status(404).json({ error: 'Actuator not found' });

        const gh = await GreenhouseRepo.findById(actuator.greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        const updateData = {};
        if (name) updateData.name = name;
        if (type) updateData.type = type;
        if (capacity) updateData.capacity = String(capacity);

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const updated = await IoTRepo.updateActuatorConfig(id, updateData);
        res.json({ message: 'Actuator settings updated', actuator: updated });

    } catch (e) { next(e); }
};

const getLogs = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
        
        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        const logs = await IoTRepo.getSystemLogs(greenhouseId);
        res.json(logs);
    } catch (e) { next(e); }
};

const getStats = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;

        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        const stats = await IoTRepo.getSystemStats(greenhouseId);
        
        const formattedStats = {
            period: '24h',
            actions: stats
        };

        res.json(formattedStats);
    } catch (e) { next(e); }
};
const clearLogs = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;

        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const result = await IoTRepo.clearSystemLogs(greenhouseId);
        
        console.log(`Logs cleared for GH:${greenhouseId} by User:${req.user.id}`);
        
        res.json({ 
            message: 'System logs cleared successfully',
            details: result 
        });
    } catch (e) { next(e); }
};
const getGreenhouseSensors = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
        const gh = await GreenhouseRepo.findById(greenhouseId);
        
        if (!gh || gh.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const sensors = await IoTRepo.getSensorsByGreenhouse(greenhouseId);
        res.json(sensors);
    } catch (e) { next(e); }
};


const getGreenhouseActuators = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
        const gh = await GreenhouseRepo.findById(greenhouseId);
        
        if (!gh || gh.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const actuators = await IoTRepo.getActuatorsByGreenhouse(greenhouseId);
        res.json(actuators);
    } catch (e) { next(e); }
};
module.exports = { 
    receiveTelemetry, 
    getDashboard, 
    addManualReading,
    updateActuator, 
    getLogs, 
    getStats,
    clearLogs,
    getGreenhouseSensors,
    getGreenhouseActuators,
    editActuatorConfig
};