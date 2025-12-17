const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  receiveTelemetry,
  getDashboard,
  updateActuator,
  addManualReading,
  getLogs,
  getStats,
  clearLogs,
  getGreenhouseSensors,
  getGreenhouseActuators,
  editActuatorConfig
} = require('../controllers/iotController');

/**
 * @swagger
 * tags:
 *   - name: IoT
 *     description: Telemetry, control, logs and stats
 */


router.post('/telemetry', receiveTelemetry);

/**
 * @swagger
 * /iot/manual:
 *   post:
 *     summary: Manually add a sensor reading (User input)
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sensorId
 *               - value
 *             properties:
 *               sensorId:
 *                 type: string
 *                 format: uuid
 *               value:
 *                 type: number
 *     responses:
 *       201:
 *         description: Reading added
 *       403:
 *         description: Access denied
 */
router.post('/manual', protect, addManualReading);

/**
 * @swagger
 * /iot/dashboard/{greenhouseId}:
 *   get:
 *     summary: Get current sensor readings
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current data
 */
router.get('/dashboard/:greenhouseId', protect, getDashboard);

/**
 * @swagger
 * /iot/actuators/{id}:
 *   patch:
 *     summary: Update actuator state (Manual Control)
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Actuator UUID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - state
 *             properties:
 *               state:
 *                 type: boolean
 *                 description: ON / OFF
 *               value:
 *                 type: number
 *                 description: Optional value (0–100% or angle)
 *     responses:
 *       200:
 *         description: State updated
 */
router.patch('/actuators/:id', protect, updateActuator);

/**
 * @swagger
 * /iot/actuators/{id}:
 *   put:
 *     summary: Edit actuator configuration (Name, Type, Capacity)
 *     tags: [IoT]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Actuator UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 description: heater, fan, grow_light, vent, pump, humidifier
 *               capacity:
 *                 type: string
 *                 description: Power consumption or throughput (e.g. "2000" Watts)
 *     responses:
 *       200:
 *         description: Configuration updated
 *       403:
 *         description: Access denied
 */
router.put('/actuators/:id', protect, editActuatorConfig);


/**
 * @swagger
 * /iot/logs/{greenhouseId}:
 *   get:
 *     summary: Get automation history logs
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of system actions
 */
router.get('/logs/:greenhouseId', protect, getLogs);

/**
 * @swagger
 * /iot/stats/{greenhouseId}:
 *   get:
 *     summary: Get system statistics (last 24h)
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Aggregated stats
 */
router.get('/stats/:greenhouseId', protect, getStats);
/**
 * @swagger
 * /iot/greenhouses/{greenhouseId}/logs:
 *   delete:
 *     summary: Clear all automation logs for a greenhouse
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Logs successfully cleared
 *       403:
 *         description: Access denied
 *       404:
 *         description: Greenhouse or logs not found
 */

router.delete('/greenhouses/:greenhouseId/logs', protect, clearLogs);
/**
 * @swagger
 * /iot/greenhouses/{greenhouseId}/sensors:
 *   get:
 *     summary: Get all sensors for a greenhouse
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of sensors
 *       403:
 *         description: Access denied
 *       404:
 *         description: Greenhouse or sensors not found
 */

/**
 * @swagger
 * /iot/greenhouses/{greenhouseId}/actuators:
 *   get:
 *     summary: Get all actuators for a greenhouse
 *     tags:
 *       - IoT
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of actuators
 *       403:
 *         description: Access denied
 *       404:
 *         description: Greenhouse or actuators not found
 */

router.get('/greenhouses/:greenhouseId/sensors', protect, getGreenhouseSensors);

router.get('/greenhouses/:greenhouseId/actuators', protect, getGreenhouseActuators);
module.exports = router;
