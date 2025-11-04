const express = require('express');
const router = express.Router();
const authController = require('../../controllers/admin/authController');
const adminOnly = require('../../middlewares/admin-only');
const guestOnly = require('../../middlewares/guest-only');

router.get('/login', guestOnly, authController.showLogin);
router.post('/login', guestOnly, authController.login);

router.get('/forgot-password', guestOnly, authController.showForgetPassword);
router.post('/forgot-password', guestOnly, authController.forgotPassword);

router.get('/otp', guestOnly, authController.showOtp);
router.post('/verify-otp', guestOnly, authController.verifyOtp);

router.get('/reset-password', guestOnly, authController.showReset);
router.post('/reset-password', guestOnly, authController.resetPassword);

router.get('/logout', adminOnly, authController.logout);

module.exports = router;
