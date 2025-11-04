'use strict';

module.exports = (io, socket, { models, sequelize, state }) => {
  const { Message, MessageStatus, Op } = models;

  // === Typing Events ===
  socket.on('typing', ({ senderId, receiverId }) => {
    io.to(`user_${receiverId}`).emit('showTyping', { senderId });
  });

  socket.on('stopTyping', ({ senderId, receiverId }) => {
    io.to(`user_${receiverId}`).emit('hideTyping', { senderId });
  });

  // === Delivery ===
  socket.on('messageDelivered', async ({ messageId, senderId }) => {
    const userId = socket.userId;
    if (!userId || !messageId) return;
    
    const [affectedCount] = await MessageStatus.update(
      { status: 'delivered' },
      { where: { message_id: messageId, user_id: userId, status: 'sent' } }
    );

    if (affectedCount > 0) {
      io.to(`user_${senderId}`).emit('messageStatusUpdated', {
        messageId,
        status: 'delivered'
      });
    }
  });

  // === Seen ===
  socket.on('messageSeen', async ({ messageIds, senderId }) => {
    if (!Array.isArray(messageIds) || !socket.userId) return;

    await MessageStatus.update(
      { status: 'seen' },
      {
        where: {
          message_id: messageIds,
          user_id: socket.userId,
          status: { [Op.ne]: 'seen' }
        }
      }
    );

    messageIds.forEach(messageId => {
      io.to(`user_${senderId}`).emit('messageStatusUpdated', {
        messageId,
        status: 'seen'
      });
    });
  });

  // === Clear Chat (per user) ===
  socket.on('clear-chat-for-me', async ({ senderId, receiverId }) => {
    if (!senderId || !receiverId) return;

    try {
      const currentUserId = parseInt(senderId);
      const otherUserId = parseInt(receiverId);

      const messages = await Message.findAll({
        where: {
          [Op.or]: [
            { sender_id: currentUserId, recipient_id: otherUserId },
            { sender_id: otherUserId, recipient_id: currentUserId }
          ]
        },
      });

      let updatedCount = 0;

      for (const message of messages) {
        let clearChatBy = message.clear_chat_by || [];

        if (typeof clearChatBy === 'string') {
          try {
            clearChatBy = JSON.parse(clearChatBy);
          } catch {
            clearChatBy = [];
          }
        }

        if (!Array.isArray(clearChatBy)) clearChatBy = [];

        if (!clearChatBy.includes(currentUserId)) {
          clearChatBy.push(currentUserId);

          await message.update(
            { clear_chat_by: JSON.stringify(clearChatBy) },
          );
          updatedCount++;
        }
      }

      socket.emit('chat-cleared-for-sender', {
        success: true,
        receiverId,
        updatedCount
      });
    } catch (error) {
      console.error('Error in clearChatForMe:', error);
    }
  });
};