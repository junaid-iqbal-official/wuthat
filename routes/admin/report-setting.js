const express = require('express');
const router = express.Router();
const reportSettingController = require('../../controllers/admin/reportSettingController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, reportSettingController.showReportSetting);
router.get('/all', adminOnly, reportSettingController.reports);
router.post('/create', adminOnly, reportSettingController.createReport);
router.post('/edit', adminOnly, reportSettingController.editReport);
router.post('/delete', adminOnly, reportSettingController.deleteReport);

module.exports = router;
