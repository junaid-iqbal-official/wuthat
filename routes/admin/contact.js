const express = require('express');
const router = express.Router();
const contactController = require('../../controllers/admin/contactController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, contactController.showContact);
router.get('/all', adminOnly, contactController.getAllContacts);

module.exports = router;
