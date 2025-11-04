const express = require('express');
const router = express.Router();
const stickerController = require('../../controllers/admin/stickerController');
const adminOnly = require('../../middlewares/admin-only');
const { upload } = require('../../middlewares/upload');

router.get('/', adminOnly, stickerController.showSticker);
router.get('/all', adminOnly, stickerController.getAllStickers);
router.post('/create', adminOnly, upload.single('sticker'), stickerController.createSticker);
router.post('/edit', adminOnly, upload.single('sticker'), stickerController.editSticker);
router.post('/delete', adminOnly, stickerController.deleteSticker);
router.post('/status', adminOnly, stickerController.updateStatus);

module.exports = router;
