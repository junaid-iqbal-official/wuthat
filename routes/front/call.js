'use strict';
const express = require('express');
const router = express.Router();
const callController = require('../../controllers/front/callController');
const isAuthenticated = require('../../middlewares/auth-middleware');

router.post('/initiate', isAuthenticated, callController.initiateCall);
router.post('/answer', isAuthenticated, callController.answerCall);
router.post('/decline', isAuthenticated, callController.declineCall);
router.post('/end', isAuthenticated, callController.endCall);
router.get('/history', isAuthenticated, callController.getCallHistory);

module.exports = router;