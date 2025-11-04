const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/admin/reportController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, reportController.showReport);
router.get('/all', adminOnly, reportController.reports);
router.post('/edit', adminOnly, reportController.editReport);

module.exports = router;
