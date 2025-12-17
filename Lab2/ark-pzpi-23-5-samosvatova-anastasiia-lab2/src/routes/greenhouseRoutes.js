const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware'); 
const { 
    createGreenhouse, 
    getMyGreenhouses, 
    updateGreenhouse, 
    deleteGreenhouse,
    addDevice, 
    getCrops, 
    createCrop,
    updateCrop,
    deleteCrop,
    setCrop 
} = require('../controllers/greenhouseController');

router.use(protect);

/**
 * @swagger
 * tags:
 *   - name: Greenhouses
 *     description: Management of greenhouses, devices, and crops
 */

/**
 * @swagger
 * /greenhouses:
 *   get:
 *     summary: Get list of my greenhouses
 *     tags: [Greenhouses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's greenhouses
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   location:
 *                     type: string
 *                   areaSqMeters:
 *                     type: number
 *                   heightMeters:
 *                     type: number
 *                   activeCropId:
 *                     type: string
 *                     format: uuid
 *
 *   post:
 *     summary: Create a new greenhouse
 *     tags: [Greenhouses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *               areaSqMeters:
 *                 type: number
 *                 description: Planting area in square meters (important for irrigation calculation)
 *                 example: 12.5
 *               heightMeters:
 *                 type: number
 *                 description: Greenhouse height in meters (important for air volume calculation)
 *                 example: 3.0
 *     responses:
 *       201:
 *         description: Greenhouse successfully created
 */
router.post('/', createGreenhouse);
router.get('/', getMyGreenhouses);

/**
 * @swagger
 * /greenhouses/{greenhouseId}:
 *   put:
 *     summary: Update greenhouse details
 *     tags: [Greenhouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *               areaSqMeters:
 *                 type: number
 *               heightMeters:
 *                 type: number
 *     responses:
 *       200:
 *         description: Greenhouse updated
 *
 *   delete:
 *     summary: Delete greenhouse
 *     tags: [Greenhouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Greenhouse deleted
 */
router.put('/:greenhouseId', updateGreenhouse);
router.delete('/:greenhouseId', deleteGreenhouse);

/**
 * @swagger
 * /greenhouses/{greenhouseId}/devices:
 *   post:
 *     summary: Add a sensor or actuator to a greenhouse
 *     tags: [Greenhouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - name
 *               - type
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [sensor, actuator]
 *                 description: Device type (sensor or actuator)
 *               name:
 *                 type: string
 *                 description: Device name (e.g., "Main Pump")
 *               type:
 *                 type: string
 *                 description: ENUM type (temperature, humidity, pump, fan, etc.)
 *               unit:
 *                 type: string
 *                 description: Measurement unit (only for sensors)
 *               capacity:
 *                 type: integer
 *                 description: Capacity in ml/sec (only for actuator type=pump)
 *     responses:
 *       201:
 *         description: Device added
 */
router.post('/:greenhouseId/devices', addDevice);

/**
 * @swagger
 * /greenhouses/crops:
 *   get:
 *     summary: Get list of crop types
 *     tags: [Crops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of crops with parameters
 *   post:
 *     summary: Create a new crop (Plant profile)
 *     tags: [Crops]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               idealTempMin:
 *                 type: number
 *               idealTempMax:
 *                 type: number
 *               idealSoilMoistureMin:
 *                 type: number
 *               idealSoilMoistureMax:
 *                 type: number
 *               idealAirHumidityMin:
 *                 type: number
 *               idealAirHumidityMax:
 *                 type: number
 *               idealLightLevel:
 *                 type: integer
 *                 description: Lux level
 *               requiredDayHours:
 *                 type: integer
 *               waterNeedFactor:
 *                 type: integer
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Crop successfully created
 */
router.get('/crops', getCrops);
router.post('/crops', adminOnly, createCrop);

/**
 * @swagger
 * /greenhouses/crops/{cropId}:
 *   put:
 *     summary: Update crop parameters
 *     tags: [Crops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cropId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               idealTempMin:
 *                 type: number
 *               idealTempMax:
 *                 type: number
 *               idealSoilMoistureMin:
 *                 type: number
 *               idealSoilMoistureMax:
 *                 type: number
 *               idealAirHumidityMin:
 *                 type: number
 *               idealAirHumidityMax:
 *                 type: number
 *               idealLightLevel:
 *                 type: integer
 *               requiredDayHours:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Crop updated
 *
 *   delete:
 *     summary: Delete crop from the list
 *     tags: [Crops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cropId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Crop deleted
 */
router.put('/crops/:cropId', adminOnly, updateCrop);
router.delete('/crops/:cropId', adminOnly, deleteCrop);

/**
 * @swagger
 * /greenhouses/{greenhouseId}/crop:
 *   put:
 *     summary: Set active crop for a greenhouse
 *     tags: [Greenhouses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: greenhouseId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cropId
 *             properties:
 *               cropId:
 *                 type: string
 *                 format: uuid
 *                 description: Crop ID from the list
 *     responses:
 *       200:
 *         description: Crop set and automation updated
 */
router.put('/:greenhouseId/crop', setCrop);

module.exports = router;
