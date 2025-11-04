'use strict';

module.exports = (io, socket, { models }) => {
  const { Friend, User } = models;

  // === Send Friend Request ===
  socket.on('sendFriendRequest', async ({ fromUserId, toUserId }) => {
    if (!fromUserId || !toUserId) return;

    try {
      const [request, created] = await Friend.findOrCreate({
        where: { user_id: fromUserId, friend_id: toUserId },
        defaults: { status: 'pending' }
      });

      if (!created) return;

      io.to(`user_${toUserId}`).emit('friendRequestReceived', {
        fromUserId,
        toUserId
      });

    } catch (err) {
      console.error('Error in sendFriendRequest:', err);
    }
  });

  // === Accept Friend Request ===
  socket.on('acceptFriendRequest', async ({ fromUserId, toUserId }) => {
    try {
      await Friend.update(
        { status: 'accepted' },
        { where: { user_id: fromUserId, friend_id: toUserId } }
      );

      io.to(`user_${fromUserId}`).emit('friendRequestAccepted', { toUserId });
      io.to(`user_${toUserId}`).emit('friendRequestAccepted', { fromUserId });

    } catch (err) {
      console.error('Error in acceptFriendRequest:', err);
    }
  });

  // === Remove Friend ===
  socket.on('removeFriend', async ({ userId, friendId }) => {
    try {
      await Friend.destroy({
        where: {
          [models.Op.or]: [
            { user_id: userId, friend_id: friendId },
            { user_id: friendId, friend_id: userId }
          ]
        }
      });

      io.to(`user_${friendId}`).emit('friendRemoved', { userId });
      io.to(`user_${userId}`).emit('friendRemoved', { friendId });

    } catch (err) {
      console.error('Error in removeFriend:', err);
    }
  });
};
