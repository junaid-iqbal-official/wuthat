'use strict';
const express = require('express');
const router = express.Router();
const { uploadFiles } = require('../../middlewares/upload');
const messengerController = require('../../controllers/front/messengerController');
const isAuthenticated = require('../../middlewares/auth-middleware');

router.get('/messenger', isAuthenticated, messengerController.showMessenger);
router.get('/messenger/contacts', isAuthenticated, messengerController.getContacts);
router.get('/messenger/recent-chats', isAuthenticated, messengerController.getRecentChats);
router.get('/messenger/documents', isAuthenticated, messengerController.listDocuments);
router.get('/messenger/search-document', isAuthenticated, messengerController.searchDocuments);

router.get('/messages/:recipientId', isAuthenticated, messengerController.getDirectMessages);
router.get('/messages/render/:id', isAuthenticated, messengerController.renderMessageGroup);
router.post('/messages/send', isAuthenticated, uploadFiles, messengerController.sendMessage);

router.post('/chat/mute', isAuthenticated, messengerController.muteChat);
router.post('/chat/unmute', isAuthenticated, messengerController.unmuteChat);
router.post('/chat/pin', isAuthenticated, messengerController.pinConversation);
router.post('/chat/unpin', isAuthenticated, messengerController.unpinConversation);

router.post('/messages/toggle-reaction', isAuthenticated, messengerController.toggleReaction);
router.get('/messages/:messageId/reactions', isAuthenticated, messengerController.getMessageReactions);
router.post('/messages/:recipientId/search', isAuthenticated, messengerController.searchMessages);
router.get('/messages/:recipientId/context/:messageId', isAuthenticated, messengerController.getMessageContext);
router.post('/messages/:recipientId/search/advanced', isAuthenticated, messengerController.advancedSearchMessages);

router.get('/chat/export', isAuthenticated, messengerController.exportChat);
router.post('/clear-all', isAuthenticated, messengerController.clearAllChats);
router.post('/chat/archive/all', isAuthenticated, messengerController.archiveAllChats);
router.post('/chat/delete/all', isAuthenticated, messengerController.deleteAllChats);
router.get('/new-chat/search', isAuthenticated, messengerController.searchNewChat);

router.get('/search/recent-chats', isAuthenticated, messengerController.searchRecentChat);
router.get('/search/recent-calls', isAuthenticated, messengerController.searchRecentCall);
router.get('/search/contact', isAuthenticated, messengerController.searchRecentContacts);

router.get('/auth/google', isAuthenticated, messengerController.connectToDrive);
router.get('/auth/google/callback', isAuthenticated, messengerController.saveToken);

router.post('/messages/:id/star', isAuthenticated, messengerController.toggleStarMessage);
router.post('/messages/:id/edit',isAuthenticated, messengerController.editMessage);
router.post('/messages/:messageId/delete', isAuthenticated, messengerController.deleteMessage);
router.post('/messages/forward', isAuthenticated, messengerController.forwardMessage);

router.post('/contact/submit', isAuthenticated, messengerController.submitContactForm);

module.exports = router;