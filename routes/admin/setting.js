const express = require('express');
const router = express.Router();
const settingController = require('../../controllers/admin/settingController');
const adminOnly = require('../../middlewares/admin-only');
const { upload } = require('../../middlewares/upload'); 

router.get('/general', adminOnly, settingController.showGeneralSetting);

router.post('/edit/:id', upload.fields([
  { name: 'favicon_logo_file', maxCount: 1 },
  { name: 'app_logo_file', maxCount: 1 },
  { name: 'dark_logo_file', maxCount: 1 },
  { name: 'white_logo_file', maxCount: 1 },
  { name: 'big_logo_file', maxCount: 1 }
]), adminOnly, settingController.editSettingControl);

router.post('/toggle-setting', adminOnly, settingController.toggleSetting);
router.get('/email', adminOnly, settingController.showEmailSetting);
router.get('/frontend', adminOnly, settingController.showFrontendSetting);
router.get('/media', adminOnly, settingController.showMediaSetting);
router.get('/control', adminOnly, settingController.showUserControlSetting);


module.exports = router;