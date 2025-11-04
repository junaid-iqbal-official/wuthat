'use strict';

module.exports = (io, socket, { models }) => {
  const { Notification } = models;

  // === Send Notification ===
  socket.on('sendNotification', async ({ toUserId, type, data }) => {
    if (!toUserId || !type) return;

    try {
      const notif = await Notification.create({
        user_id: toUserId,
        type,
        data: JSON.stringify(data || {}),
        status: 'unread'
      });

      io.to(`user_${toUserId}`).emit('notificationReceived', {
        id: notif.id,
        type,
        data,
        createdAt: notif.createdAt
      });

    } catch (err) {
      console.error('Error in sendNotification:', err);
    }
  });
};