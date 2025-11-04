const express = require('express');
const router = express.Router();
const pagesController = require('../../controllers/admin/pagesController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, pagesController.showPages);
router.post('/update', adminOnly, pagesController.updatePages);

module.exports = router;
