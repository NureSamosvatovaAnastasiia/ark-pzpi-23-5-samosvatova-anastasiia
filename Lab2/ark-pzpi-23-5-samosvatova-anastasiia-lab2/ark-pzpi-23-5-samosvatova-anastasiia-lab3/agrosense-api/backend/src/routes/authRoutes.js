const express = require('express');
const router = express.Router();
const { register, login, verifyEmail } = require('../controllers/authController');

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: User authentication management
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User successfully created
 *       409:
 *         description: Email already in use
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/verify:
 *   post:
 *     summary: Verify email using a code
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email successfully verified
 *       400:
 *         description: Invalid verification code
 */
router.post('/verify', verifyEmail);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login to the system (get JWT token)
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *                 user:
 *                   type: object
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account not activated
 */
router.post('/login', login);

module.exports = router;
