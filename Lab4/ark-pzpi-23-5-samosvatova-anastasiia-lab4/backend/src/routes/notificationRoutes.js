const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getNotifications, markRead } = require('../controllers/notificationController');

// Усі маршрути захищені
router.use(protect);

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Alerts and system messages
 */

/**
 * @swagger
 * /notifications/{greenhouseId}:
 *   get:
 *     summary: Get all notifications for a greenhouse
 *     tags: [Notifications]
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
 *         description: List of notifications
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
 *                   message:
 *                     type: string
 *                   severity:
 *                     type: string
 *                     enum: [INFO, WARNING, CRITICAL]
 *                   isRead:
 *                     type: boolean
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 */
router.get('/:greenhouseId', getNotifications);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/:id/read', markRead);

module.exports = router;
