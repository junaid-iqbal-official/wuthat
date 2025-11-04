'use strict';
const express = require('express');
const router = express.Router();
const chatActionController = require('../../controllers/front/chatActionController');
const isAuthenticated = require('../../middlewares/auth-middleware');

router.get('/favorites', isAuthenticated, chatActionController.getFavorites);
router.post('/favorite', isAuthenticated, chatActionController.toggleFavorite);
router.post('/archive', isAuthenticated, chatActionController.toggleArchive);
router.post('/delete', isAuthenticated, chatActionController.deleteChat);
router.post('/block', isAuthenticated, chatActionController.toggleBlock);
router.get('/block', isAuthenticated, chatActionController.getBlockedUsers);
router.post('/unblock', isAuthenticated, chatActionController.unblockUser);
router.get('/archive', isAuthenticated, chatActionController.getArchivedChats);
router.post('/unarchive', isAuthenticated, chatActionController.unarchiveChat);
router.get('/search-favorite', isAuthenticated, chatActionController.searchFavorites);
router.get('/search-block-contact', isAuthenticated, chatActionController.searchBlockContact);
router.get('/search-archive-chat', isAuthenticated, chatActionController.searchArchiveChat);
router.post('/unfriend', isAuthenticated, chatActionController.unfriend);

module.exports = router;