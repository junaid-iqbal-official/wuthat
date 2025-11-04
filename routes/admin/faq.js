const express = require('express');
const router = express.Router();
const faqController = require('../../controllers/admin/faqController');
const adminOnly = require('../../middlewares/admin-only');

router.get('/', adminOnly, faqController.showFaq);
router.get('/all', adminOnly, faqController.faqs);
router.post('/create', adminOnly, faqController.createFaq);
router.post('/edit', adminOnly, faqController.editFaq);
router.post('/delete', adminOnly, faqController.deleteFaq);
router.post('/status', adminOnly, faqController.updateStatus);

module.exports = router;
