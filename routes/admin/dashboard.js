const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboardController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/dashboard', adminOnly, dashboardController.showDashboard);

module.exports = router;
