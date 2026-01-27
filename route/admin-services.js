const express = require('express');
const router = express.Router();
const { getAllServices, updateServiceStatus } = require('../controller/AdminServicesController');

// Admin Services Routes
router.get('/admin/services', getAllServices);
router.put('/admin/services/:serviceId', updateServiceStatus);

module.exports = router;







