'use strict';
const express = require('express');
const router = express.Router();
const friendController = require('../../controllers/front/friendController');
const isAuthenticated = require('../../middlewares/auth-middleware');

router.get('/', isAuthenticated, friendController.getFriends);
router.get('/suggestions', isAuthenticated, friendController.getFriendSuggestions);
router.post('/send-request', isAuthenticated, friendController.sendFriendRequest);
router.post('/respond', isAuthenticated, friendController.respondToFriendRequest);
router.get('/pending', isAuthenticated, friendController.getPendingRequests);
router.get('/search-friend', isAuthenticated, friendController.searchFriendSuggestions);

module.exports = router;