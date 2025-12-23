const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  getAllUsers,
  deleteUser,
  changeUserRole,
  getAdminDashboard,
  getSystemLogs,
  getAllGreenhouses
} = require('../controllers/adminController');


router.use(protect);
router.use(adminOnly);

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Administrator panel
 */

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get global system statistics
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Stats object
 */
router.get('/dashboard', getAdminDashboard);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', getAllUsers);

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     summary: Delete a user
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete('/users/:userId', deleteUser);

/**
 * @swagger
 * /admin/users/{userId}/role:
 *   patch:
 *     summary: Change user role
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum:
 *                   - user
 *                   - admin
 *     responses:
 *       200:
 *         description: Role updated
 */
router.patch('/users/:userId/role', changeUserRole);

/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: Get global system logs (last 100 actions)
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of logs
 */
router.get('/logs', getSystemLogs);
/**
 * @swagger
 * /admin/greenhouses:
 *   get:
 *     summary: Get all greenhouses
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     description: Returns a list of all greenhouses in the system (admin access required)
 *     responses:
 *       200:
 *         description: List of greenhouses
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
 *                     description: Unique identifier of the greenhouse
 *                   name:
 *                     type: string
 *                     description: Name of the greenhouse
 *                   ownerId:
 *                     type: string
 *                     format: uuid
 *                     description: ID of the user who owns the greenhouse
 *                   location:
 *                     type: string
 *                     description: Optional location or description
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                     description: Date and time the greenhouse was created
 *       403:
 *         description: Access denied (not an admin)
 *       500:
 *         description: Internal server error
 */

router.get('/greenhouses', getAllGreenhouses);
module.exports = router;
