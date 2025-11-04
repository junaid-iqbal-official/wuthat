const express = require('express');
const router = express.Router();
const userController = require('../../controllers/admin/userController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, userController.showUser);
router.get('/all', adminOnly, userController.getAllUsers);
router.post('/create', adminOnly, userController.createUser);
router.post('/delete', adminOnly, userController.deleteUser);
router.post('/edit', adminOnly, userController.editUser);
router.post('/status', adminOnly, userController.updateStatus);

module.exports = router;
