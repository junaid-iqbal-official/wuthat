'use strict';

module.exports = (io, socket, { models, state }) => {
  const { User, GroupMember, MessageStatus, Message, Friend } = models;

  // === Join user room & groups ===
  socket.on('joinUserRoom', async (userId) => {
    if (!userId) return;

    socket.userId = userId;
    socket.join(`user_${userId}`);

    // Track connections
    if (!state.connectedUsers.has(userId)) {
      state.connectedUsers.set(userId, new Set());
    }
    state.connectedUsers.get(userId).add(socket.id);

    console.log(`👤 User ${userId} joined room (${socket.id})`);

    // First socket → mark online
    if (state.connectedUsers.get(userId).size === 1) {
      await User.update({ is_online: true }, { where: { id: userId } });
      io.emit('userOnline', { userId });
    }

    // Join group rooms
    const groupIds = await GroupMember.findAll({ where: { user_id: userId }, attributes: ['group_id'], raw: true });
    groupIds.map(g => `group_${g.group_id}`).forEach(room => socket.join(room));

    setHeartbeatTimeout(userId);

    // Deliver pending messages
    const undelivered = await MessageStatus.findAll({
      where: { user_id: userId, status: 'sent' },
      include: [{ model: Message, as: 'message' }]
    });

    const ids = undelivered.map(ms => ms.message_id);

    if (ids.length > 0) {
      await MessageStatus.update({ status: 'delivered' }, {
        where: { user_id: userId, message_id: ids, status: 'sent' }
      });

      for (const status of undelivered) {
        io.to(`user_${status.message.sender_id}`).emit('messageStatusUpdated', {
          messageId: status.message_id,
          userId,
          status: 'delivered'
        });
      }
    }
  });

  // === Heartbeat ===
  socket.on('heartbeat', (userId) => {
    setHeartbeatTimeout(userId);
  });

  // === Disconnect ===
  socket.on('disconnect', async () => {
    const userId = socket.userId;
    if (!userId) return;

    const sockets = state.connectedUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        state.connectedUsers.delete(userId);
        clearTimeout(state.userHeartbeatMap.get(userId));
        state.userHeartbeatMap.delete(userId);

        const now = new Date();
        await User.update({ is_online: false, last_seen: now }, { where: { id: userId } });

        io.emit('userOffline', { userId, lastSeen: now });

        notifyFriends(userId, false);
      }
    }

    console.log(`🔌 Disconnected: ${socket.id}`);
  });

  // === Notify Friends ===
  async function notifyFriends(userId, isOnline) {
    try {
      const friendships = await Friend.findAll({
        where: {
          [models.Op.or]: [
            { user_id: userId, status: 'accepted' },
            { friend_id: userId, status: 'accepted' }
          ]
        }
      });

      friendships.forEach(f => {
        const friendId = f.user_id === userId ? f.friend_id : f.user_id;
        io.to(`user_${friendId}`).emit('friendStatusUpdate', {
          userId,
          isOnline,
          lastSeen: isOnline ? null : new Date()
        });
      });
    } catch (err) {
      console.error('Error notifying friends:', err);
    }
  }

  // === Heartbeat timeout ===
  function setHeartbeatTimeout(userId) {
    if (state.userHeartbeatMap.has(userId)) {
      clearTimeout(state.userHeartbeatMap.get(userId));
    }

    const timeout = setTimeout(async () => {
      const sockets = state.connectedUsers.get(userId);
      if (sockets) {
        sockets.forEach(sid => {
          const sock = io.sockets.sockets.get(sid);
          if (sock) sock.disconnect(true);
        });
        state.connectedUsers.delete(userId);
      }

      state.userHeartbeatMap.delete(userId);

      const now = new Date();
      await User.update({ is_online: false, last_seen: now }, { where: { id: userId } });
      io.emit('userOffline', { userId, lastSeen: now });

    }, 60000);

    state.userHeartbeatMap.set(userId, timeout);
  }
};