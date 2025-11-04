'use strict';
const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/front/notificationController');
const isAuthenticated = require('../../middlewares/auth-middleware');

router.get('/', isAuthenticated, notificationController.getNotifications);
router.post('/:notificationId/read', isAuthenticated, notificationController.markAsRead);
router.post('/mark-all-read', isAuthenticated, notificationController.markAllAsRead);
router.get('/unread-count', isAuthenticated, notificationController.getUnreadCount);
router.delete('/:notificationId', isAuthenticated, notificationController.deleteNotification);

module.exports = router;