const express = require('express');
const router = express.Router();
const deleteAccountController = require('../../controllers/admin/deleteAccountController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, deleteAccountController.showDeleteAccount);
router.get('/all', adminOnly, deleteAccountController.deletedAccounts);

module.exports = router;
