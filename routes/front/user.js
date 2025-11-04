'use strict';
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/front/userController');
const isAuthenticated = require('../../middlewares/auth-middleware');
const { uploadSingle } = require('../../middlewares/upload');

router.post('/update-profile',uploadSingle, isAuthenticated, userController.updateProfile);
router.get('/:id/profile', isAuthenticated, userController.getProfile);
router.post('/report', isAuthenticated, userController.reportUser);
router.post('/setting/account', isAuthenticated, userController.updateUserSettings);
router.post('/setting/wallpaper', isAuthenticated, userController.updateWallpaper);

router.post('/setting/theme-mode', isAuthenticated, userController.updateThemeMode);
router.post('/setting/theme-layout', isAuthenticated, userController.updateThemeLayout);
router.post('/setting/theme-color', isAuthenticated, userController.updateThemeColor);
router.get('/setting/theme-color', isAuthenticated, userController.fetchThemeColor);
router.post('/setting/theme-direction', isAuthenticated, userController.updateThemeDirection);
router.post('/setting/sidebar-layout', isAuthenticated, userController.updateSidebarLayout);
router.post('/change-password', isAuthenticated, userController.changePassword);

router.post('/update/auto-backup', isAuthenticated, userController.toggleAutoBackup);
router.post('/update/include-doc', isAuthenticated, userController.toggleIncludeDoc);
router.post('/update/include-vid', isAuthenticated, userController.toggleIncludeVid);
router.get('/fetch/system-setting', userController.fetchSystemSetting);
router.get('/check-block/:userId', isAuthenticated,userController.checkUserBlock);
router.get('/check-friend/:recipientId', isAuthenticated,userController.checkIsFriend);

module.exports = router;