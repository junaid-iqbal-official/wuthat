'use strict';

// Import feature handlers
const chatHandlers = require('./chat');
const presenceHandlers = require('./presence');
const callHandlers = require('./calls');
const friendHandlers = require('./friends');
const notificationHandlers = require('./notifications');

// Shared in-memory state
const state = require('./state');

// DB models & utils
const { sequelize, User, GroupMember, Message, MessageStatus, Call, CallParticipant, Friend, Notification } = require('../models');
const { Op } = require('sequelize');

module.exports = function initSockets(io) {
  io.on('connection', (socket) => {
    
    const context = {
      models: { User, GroupMember, Message, MessageStatus, Call, CallParticipant, Friend, Notification, Op },
      sequelize,
      state
    };

    // Attach feature-specific handlers
    chatHandlers(io, socket, context);
    presenceHandlers(io, socket, context);
    callHandlers(io, socket, context);
    friendHandlers(io, socket, context);
    notificationHandlers(io, socket, context);
  });
};
