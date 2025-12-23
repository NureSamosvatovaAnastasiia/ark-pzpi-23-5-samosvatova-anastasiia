const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const greenhouseRoutes = require('./greenhouseRoutes');
const iotRoutes = require('./iotRoutes');
const notificationRoutes = require('./notificationRoutes');
const adminRoutes = require('./adminRoutes');

router.use('/auth', authRoutes);
router.use('/greenhouses', greenhouseRoutes);
router.use('/iot', iotRoutes);
router.use('/notifications', notificationRoutes);

router.use('/admin', adminRoutes);

module.exports = router;