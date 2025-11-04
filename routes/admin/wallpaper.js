const express = require('express');
const router = express.Router();
const wallpaperController = require('../../controllers/admin/wallpaperController');
const adminOnly = require('../../middlewares/admin-only');
const { upload } = require('../../middlewares/upload');

router.get('/', adminOnly, wallpaperController.showWallpaper);
router.get('/all', adminOnly, wallpaperController.getAllWallpapers);
router.post('/create', adminOnly, upload.single('wallpaper'), wallpaperController.createWallpaper);
router.post('/edit', adminOnly, upload.single('wallpaper'), wallpaperController.editWallpaper);
router.post('/delete', adminOnly, wallpaperController.deleteWallpaper);
router.post('/status', adminOnly, wallpaperController.updateStatus);

module.exports = router;
