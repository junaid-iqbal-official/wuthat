const express = require('express');
const router = express.Router();
const accountController = require('../../controllers/admin/accountController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, accountController.showAccount);
router.post('/update-profile', adminOnly, accountController.updateProfile);
router.post('/change-password', adminOnly, accountController.changePassword);

module.exports = router;