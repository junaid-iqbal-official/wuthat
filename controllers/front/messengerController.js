const { Op } = require('sequelize');
const { google } = require('googleapis');
const { User, Message, MessageStatus, Friend,
  MutedChat, MessageReaction, PinnedConversation, Favorite, Archive,
  Block, UserSettings, UserDelete, GoogleToken, Sticker, ChatWallpaper, PageContent, 
  ContactUs, ReportSetting, Faq } = require('../../models');
const { getUserContacts, getFriendSuggestions, getUserDocuments, fetchRecentChats, 
  fetchRecentCalls, getMessageReactionCounts, timeSince, formatDuration, getFileTypeFromMime,
  getDefaultContentForFileType, formatFileSize, groupMessagesBySender, groupMessagesByDate, formatDateLabel,
  formatDate, formatTime, formatDateForFilename, formatFilename, parseJsonArray } = require('../../utils/helper-functions');
const getOAuthClient = require('../../config/googleAuth');

exports.showMessenger = async (req, res) => {
  const currentUserId = req.session.userId;

  try {
    
    const settings = await UserSettings.findOne({
      where:{
        user_id : currentUserId
      },
      raw: true
    });

    const result = await getUserContacts(currentUserId, { paginate: false });
    const suggestions = await getFriendSuggestions(currentUserId);

    const stickers = await Sticker.findAll({
      where: {
        status : {
          [Op.eq]: true
        }
      },
      attributes:['sticker','metadata'],
      raw:true
    });

    const wallpapers = await ChatWallpaper.findAll({
      where: {
        is_active : {
          [Op.eq]: true
        }
      },
      attributes:['wallpaper','metadata'],
      raw:true
    });

    const privacy_page = await PageContent.findOne({
      where: { slug: "privacy-policy" , status: true},
      attributes: ["id", "title", "slug", "content"], // Only request safe fields
    });

    const terms_page = await PageContent.findOne({
      where: { slug: "terms-and-conditions" , status: true},
      attributes: ["id", "title", "slug", "content"], // Only request safe fields
    });

    const reportTypes = await ReportSetting.findAll({
      raw:true
    });

    const faqs = await Faq.findAll({
      where: {
        status:true
      },
      raw:true
    });

    const theme_mode = settings.theme_mode ? settings.theme_mode : res.locals.default_mode
    
    res.render('front/messenger/index', {
      layout: 'front/layouts/messenger',
      title: 'Messenger',
      settings,
      currentUserId,
      stickers,
      wallpapers,
      privacy_page,
      terms_page,
      faqs,
      theme_mode,
      newFriends: suggestions,
      chatContact: result.contacts,
      reportTypes
    });
    
  } catch (error) {
    console.error('Error in showMessenger:', error);
    res.status(500).render('error', { message: 'Failed to load messenger' });
  }
};

exports.getContacts = async function (req, res) {
  const currentUserId = req.session.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const result = await getUserContacts(currentUserId, {
      paginate: true,
      page: page,
      limit: limit
    });

    res.status(200).json({
      success: true,
      contacts: result.contacts,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Error in getContacts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load contacts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.getRecentChats = async (req, res) => {
  try {
    const currentUserId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const { messages, pagination } = await fetchRecentChats(currentUserId, page, limit, { paginate: true });

    res.status(200).json({
      success: true,
      chats: messages,
      pagination
    });
  } catch (err) {
    console.error('getRecentChats error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.pinConversation = async (req, res) => {
  const { type, targetId } = req.body; // type: 'dm' or 'channel'
  const userId = req.session.userId;

  try {
    const [pin, created] = await PinnedConversation.findOrCreate({
      where: { user_id: userId, type, target_id: targetId },
      defaults: { pinned_at: new Date() }
    });

    res.status(200).json({ success: true, message: created ? 'Pinned successfully' : 'Already pinned' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to pin conversation' });
  }
};

exports.unpinConversation = async (req, res) => {
  const { type, targetId } = req.body;
  const userId = req.session.userId;

  try {
    await PinnedConversation.destroy({
      where: { user_id: userId, type, target_id: targetId }
    });

    res.status(200).json({ success: true, message: 'Unpinned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to unpin conversation' });
  }
};

exports.muteChat = async (req, res) => {
  try {
    const { target_id, target_type, duration } = req.body;
    const userId = req.session.userId;

    let mutedUntil = null;
    const now = new Date();

    if (duration === '1h') {
      mutedUntil = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    } else if (duration === '8h') {
      mutedUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    } else if (duration === '1w') {
      mutedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else if (duration === 'forever') {
      mutedUntil = new Date('2100-01-01T00:00:00Z');
    } else {
      return res.status(400).json({ success: false, message: 'Invalid mute duration.' });
    }

    await MutedChat.upsert({
      user_id: userId,
      target_id,
      target_type,
      muted_until: mutedUntil
    });

    res.status(200).json({ success: true, message: 'Chat muted successfully.' });

  } catch (error) {
    console.error('Error in muteChat:', error);
    res.status(500).json({ success: false, message: 'Failed to mute chat.', error: error.message });
  }
};

exports.unmuteChat = async (req, res) => {
  const { target_id, target_type } = req.body;
  const userId = req.session.userId;

  await MutedChat.destroy({
    where: { user_id: userId, target_id, target_type }
  });

  res.status(200).json({ success: true, message: 'Chat unmuted.' });
};

exports.sendMessage = async (req, res) => {
  const senderId = req.session.userId;

  // Use different sources depending on content type
  const isFormData = req.is('multipart/form-data');
  const data = isFormData ? req.body : req.body;

  // Handle multiple files
  const files = req.files || [];
  const singleFile = req.file;

  const {
    recipientId,
    groupId,
    content,
    message_type = 'text',
    metadata = null,
    file_type = null,
  } = data;

  const replyTo = data.reply_to ? parseInt(data.reply_to) : null;

  // Basic validation
  if (!senderId || (!recipientId && !groupId)) {
    return res.status(400).json({ error: 'Missing recipient or group.' });
  }

  if (message_type === 'text' && !content && !files.length && !singleFile) {
    return res.status(400).json({ error: 'Text message content or file is required.' });
  }

  // Check if the recipient has blocked the sender
  const isBlocked = await Block.findOne({
    where: {
      blocker_id: recipientId, // recipient is the blocker
      blocked_id: senderId,    // sender is the one blocked
    },
  });

  if (isBlocked) {
    return res.status(403).json({
      is_block: true,
      error: "You are blocked by the user. Cannot send message.",
    });
  }

  try {
    let messages = [];

    // Check if this chat was previously hidden by the user
    let targetType, targetId;

    if (groupId) {
      targetType = 'group';
      targetId = groupId;
    } else if (recipientId) {
      targetType = 'user';
      targetId = recipientId;
    }

    // If this is a chat that was previously hidden, remove the hide record
    if (targetType && targetId) {
      await UserDelete.destroy({
        where: {
          user_id: senderId,
          target_id: targetId,
          target_type: targetType,
          delete_type: 'hide_chat'
        }
      });
    }

    // Handle multiple files (create separate message for each file)
    if (files && files.length > 0) {
      for (const file of files) {
        const fileType = getFileTypeFromMime(file.mimetype);
        const message = await Message.create({
          sender_id: senderId,
          recipient_id: recipientId || null,
          group_id: groupId || null,
          content: content || getDefaultContentForFileType(fileType),
          message_type: fileType,
          metadata: {
            original_filename: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
            is_multiple: files.length > 1,
            file_index: messages.length,
            reply_to:replyTo || null
          },
          file_url: `/uploads/${file.filename}`,
          file_type: file.mimetype,
        });
        messages.push(message);
      }
    }
    // Handle single file
    else if (singleFile) {
      const fileType = getFileTypeFromMime(singleFile.mimetype);
      const message = await Message.create({
        sender_id: senderId,
        recipient_id: recipientId || null,
        group_id: groupId || null,
        content: content || getDefaultContentForFileType(fileType),
        message_type: fileType,
        metadata: {
          original_filename: singleFile.originalname,
          file_size: singleFile.size,
          mime_type: singleFile.mimetype,
          reply_to:replyTo || null
        },
        file_url: `/uploads/${singleFile.filename}`,
        file_type: singleFile.mimetype,
      });
      messages.push(message);
    }
    // Handle stickers
    else if (message_type === 'sticker') {
      const message = await Message.create({
        sender_id: senderId,
        recipient_id: recipientId || null,
        group_id: groupId || null,
        content: content || 'Sticker',
        message_type: 'sticker',
        file_url: `${data.file_url}`,
        file_type: message_type,
        metadata:{
          reply_to:replyTo || null
        },
      });
      messages.push(message);
            
    }
    // Handle text message
    else {
      const message = await Message.create({
        sender_id: senderId,
        recipient_id: recipientId || null,
        group_id: groupId || null,
        content: content || null,
        message_type,
        metadata:{
          reply_to:replyTo || null
        },
        file_url: null,
        file_type,
      });
      messages.push(message);
    }
    // Create message statuses for all messages
    for (const message of messages) {
      const recipients = [];

      if (recipientId) {
        recipients.push(recipientId);
      } else if (groupId) {
        const members = await GroupMember.findAll({
          where: {
            group_id: groupId,
            user_id: { [Op.ne]: senderId },
          },
          attributes: ['user_id'],
          raw: true,
        });
        members.forEach(m => recipients.push(m.user_id));
      }

      // Bulk create message statuses
      const statusData = recipients.map(uid => ({
        message_id: message.id,
        user_id: uid,
        status: 'sent',
      }));

      await MessageStatus.bulkCreate(statusData);
    }

    // Load full messages with associations
    const fullMessages = await Promise.all(
      messages.map(message =>
        Message.findByPk(message.id, {
          include: [
            { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] },
            { model: User, as: 'recipient', attributes: ['id', 'name', 'avatar'], required: false },
          ],
        })
      )
    );

    const enhancedMessages = await Promise.all(
      fullMessages.map(async (message) => {
        if (message.metadata && message.metadata.reply_to) {
          try {
            const repliedMessage = await Message.findByPk(message.metadata.reply_to, {
              include: [
                { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] }
              ]
            });
            
            if (repliedMessage) {
              // Add replied message data to the message object
              message.dataValues.repliedMessage = {
                id: repliedMessage.id,
                sender_id: repliedMessage.sender_id,
                content: repliedMessage.content,
                message_type: repliedMessage.message_type,
                sender: {
                  id: repliedMessage.sender.id,
                  name: repliedMessage.sender.name,
                  avatar: repliedMessage.sender.avatar
                }
              };
            }
          } catch (error) {
            console.error('Error fetching replied message:', error);
          }
        }
        return message;
      })
    );

    // Emit via Socket.IO
    const io = req.app.get('io');

    for (const fullMessage of fullMessages) {
      if (recipientId) {
        io.to(`user_${senderId}`).emit('newDirectMessage', fullMessage);
        io.to(`user_${recipientId}`).emit('newDirectMessage', fullMessage);
        io.to(`user_${senderId}`).emit('messageStatusUpdated', {
          messageId: fullMessage.id,
          status: 'sent',
        });
      } else if (groupId) {
        io.to(`group_${groupId}`).emit('newGroupMessage', fullMessage);
      }
    }

    return res.status(200).json({
      success: true,
      messages: enhancedMessages,
      count: enhancedMessages.length
    });
  } catch (err) {
    console.error('❌ Error in sendMessage:', err);
    return res.status(500).json({ error: 'Server error sending message' });
  }
};

exports.getDirectMessages = async (req, res) => {
  const recipientId = parseInt(req.params.recipientId);
  const currentUser = res.locals.user;
  const offset = parseInt(req.query.offset) || 0;
  const limit = parseInt(req.query.limit) || 20;
  const isScrollRequest = req.query.scroll === '1';
  const cacheKey = req.query.cache || null;
  
  try {
    // Parallel queries for better performance
    const [
      user,
      muteEntry,
      favoriteEntry,
      archiveEntry,
      blockEntry,
      friendEntry,
      userSetting
    ] = await Promise.all([
      User.findByPk(recipientId),
      MutedChat.findOne({
        where: {
          user_id: currentUser.id,
          target_id: recipientId,
          target_type: 'user'
        }
      }),
      Favorite.findOne({
        where: {
          user_id: currentUser.id,
          target_id: recipientId,
          target_type: 'user'
        }
      }),
      Archive.findOne({
        where: {
          user_id: currentUser.id,
          target_id: recipientId,
          target_type: 'user'
        }
      }),
      Block.findOne({
        where: {
          [Op.or]: [
            {blocker_id: currentUser.id,blocked_id: recipientId},
            {blocker_id: recipientId, blocked_id: currentUser.id}
          ]
        }
      }),
      Friend.findOne({
        where: {
          [Op.or]: [
            {user_id: currentUser.id, friend_id: recipientId},
            {user_id: recipientId, friend_id: currentUser.id},
          ],
          status: 'accepted'
        }
      }),
      UserSettings.findOne({
        where: {
          user_id: recipientId
        },
        raw: true
      }),
    ]);

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Create enhanced user object with status properties
    const userWithStatus = {
      ...user.toJSON(),
      isFavorite: !!favoriteEntry,
      isArchived: !!archiveEntry,
      isBlocked: !!blockEntry,
      isMuted: !!muteEntry,
      isFriend: !!friendEntry
    };

    // Get all messages first (without clear_chat_by filtering)
    const allMessages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: currentUser.id, recipient_id: recipientId },
          { sender_id: recipientId, recipient_id: currentUser.id },
        ]
      },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'name', 'avatar']
      }, {
        model: MessageStatus,
        as: 'statuses',
        attributes: ['id', 'user_id', 'status']
      }, {
        model: MessageReaction,
        as: 'reactions',
        include: [{
          model: User,
          attributes: ['id', 'name']
        }]
      }],
      order: [['created_at', 'DESC']],
      offset,
      limit,
    });

    // Extract reply_to message IDs from metadata
    const replyToIds = allMessages
    .map(msg => {
      try {
        return typeof msg.metadata === 'string' ? JSON.parse(msg.metadata).reply_to : msg.metadata?.reply_to;
      } catch (err) {
        console.error("Failed to parse metadata for message:", msg.id, err);
        return null;
      }
    })
    .filter(id => id); // Remove null/undefined

    const uniqueReplyToIds = [...new Set(replyToIds)];

    const replyMessages = await Message.findAll({
      where: {
        id: {
          [Op.in]: uniqueReplyToIds
        }
      },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'name', 'avatar']
      }]
    });    

    const replyMap = {};
    replyMessages.forEach(msg => {
      replyMap[msg.id] = msg;
    });

    allMessages.forEach(msg => {
      let replyToId = null;
    
      try {
        const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
        replyToId = metadata?.reply_to;
      } catch (err) {
        console.error("Error parsing metadata for message:", msg.id, err);
      }
    
      if (replyToId && replyMap[replyToId]) {
        msg.dataValues.repliedMessage = replyMap[replyToId];
      }
    });    

    // Filter out messages that the current user has cleared
    const messages = allMessages.filter(message => {
      if (!message.clear_chat_by) return true;
      
      try {
        // Parse clear_chat_by if it's a string
        const clearedBy = typeof message.clear_chat_by === 'string' 
          ? JSON.parse(message.clear_chat_by) 
          : message.clear_chat_by;
        
        // Check if current user ID is in the clearedBy array
        return !clearedBy.includes(currentUser.id);
      } catch (error) {
        console.error('Error parsing clear_chat_by:', error);
        return true; // Return message if there's an error parsing
      }
    });

    if (isScrollRequest && messages.length === 0) {
      return res.send('');
    }

    messages.reverse();

    const responseHeaders = {
      'X-Message-Count': messages.length.toString(),
      'X-Has-More': (messages.length === limit).toString(),
      'X-Cache-Timestamp': Date.now().toString()
    };

    Object.keys(responseHeaders).forEach(header => {
      res.set(header, responseHeaders[header]);
    });

    if (isScrollRequest) {
      const groupedMessages = groupMessagesBySender(messages, currentUser);
      const dateGroupedMessages = groupMessagesByDate(groupedMessages);

      res.render('front/messenger/components/partial-chat', {
        layout: false,
        user: userWithStatus,
        dateGroupedMessages,
        currentUser,
        scroll: req.query.scroll,
        timeSince,
        formatDuration,
        formatDateLabel,
        formatFileSize,
        userSetting,
        metadata: {
          offset: offset,
          limit: limit,
          hasMore: messages.length === limit,
          messageCount: messages.length
        }
      });
    } else {
      const groupedMessages = groupMessagesBySender(messages, currentUser);
      const dateGroupedMessages = groupMessagesByDate(groupedMessages);

      res.render('front/messenger/components/chat', {
        layout: false,
        user: userWithStatus,
        dateGroupedMessages,
        currentUser,
        timeSince,
        formatDuration,
        formatDateLabel,
        formatFileSize,
        isMuted: userWithStatus.isMuted, // Use from userWithStatus
        userSetting,
        metadata: {
          offset: offset,
          limit: limit,
          hasMore: messages.length === limit,
          messageCount: messages.length,
          conversationId: recipientId,
          cacheTimestamp: Date.now()
        }
      });
    }
  } catch (err) {
    console.error('Error loading chat:', err);
    res.status(500).send('Error loading chat box');
  }
};

exports.renderMessageGroup = async (req, res) => {
  const messageId = parseInt(req.params.id);
  const currentUser = res.locals.user;

  try {
    const message = await Message.findByPk(messageId, {
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] },
        {
          model: MessageStatus,
          as: 'statuses',
          attributes: ['id', 'user_id', 'status']
        },
        {
          model: MessageReaction,
          as: 'reactions',
          include: [{
            model: User,
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    if (!message) return res.status(404).send('');

    // Extract reply_to message id from this message's metadata
    let replyToId = null;
    try {
      const metadata = typeof message.metadata === 'string'
        ? JSON.parse(message.metadata)
        : message.metadata;
      replyToId = metadata?.reply_to;
    } catch (err) {
      console.error("Failed to parse metadata for message:", message.id, err);
    }

    // If message is a reply, fetch the replied-to message
    if (replyToId) {
      const repliedMessage = await Message.findByPk(replyToId, {
        include: [
          { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] }
        ]
      });

      if (repliedMessage) {
        message.dataValues.repliedMessage = repliedMessage;
      }
    }

    // Create a single message array for grouping
    const grouped = groupMessagesBySender([message], currentUser);
    const dateGrouped = groupMessagesByDate(grouped);

    res.render('front/messenger/components/partial-chat', {
      layout: false,
      dateGroupedMessages: dateGrouped,
      currentUser,
      user: message.sender,
      scroll: true,
      timeSince,
      formatDuration,
      formatDateLabel,
      formatFileSize
    });
  } catch (err) {
    console.error('Error rendering message partial:', err);
    res.status(500).send('');
  }
};

exports.toggleReaction = async (req, res) => {
  const userId = req.session.userId;
  const { messageId, emoji } = req.body;

  // Validation
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!messageId || !emoji) {
    return res.status(400).json({ error: 'Message ID and emoji are required' });
  }

  // Validate emoji (basic validation - you can make this more strict)
  if (typeof emoji !== 'string' || emoji.length > 10) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }

  try {
    // Check if message exists and user has access to it
    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user has access to this message (either sender or recipient)
    if (message.sender_id !== userId && message.recipient_id !== userId) {
      // For group messages, check if user is in the group
      if (message.group_id) {
        const { GroupMember } = require('../models'); // Adjust path as needed
        const membership = await GroupMember.findOne({
          where: {
            group_id: message.group_id,
            user_id: userId
          }
        });

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Check if reaction already exists
    const existingReaction = await MessageReaction.findOne({
      where: {
        message_id: messageId,
        user_id: userId,
        emoji: emoji
      }
    });

    let action, reaction;

    if (existingReaction) {
      // Remove existing reaction
      await existingReaction.destroy();
      action = 'removed';
      reaction = existingReaction;
    } else {
      // Add new reaction

      const existingDifferentReaction = await MessageReaction.findOne({
        where: {
          message_id: messageId,
          user_id: userId,
        }
      });

      if (!existingDifferentReaction) {
        reaction = await MessageReaction.create({
          message_id: messageId,
          user_id: userId,
          emoji: emoji
        });
      } else {
        reaction = await existingDifferentReaction.update({
          message_id: messageId,
          user_id: userId,
          emoji: emoji
        });
      }
      action = 'added';
    }

    // Get updated reaction counts for real-time updates
    const reactionCounts = await getMessageReactionCounts(messageId, userId);

    // Emit socket event for real-time updates
    const io = req.app.get('io');

    // Determine recipients for the socket event
    if (message.recipient_id) {
      // Direct message - notify sender and recipient
      io.to(`user_${message.sender_id}`).emit('reactionUpdate', {
        messageId: parseInt(messageId),
        emoji: emoji,
        action: action,
        userId: userId,
        reactionCounts: reactionCounts
      });

      io.to(`user_${message.recipient_id}`).emit('reactionUpdate', {
        messageId: parseInt(messageId),
        emoji: emoji,
        action: action,
        userId: userId,
        reactionCounts: reactionCounts
      });
    } else if (message.group_id) {
      // Group message - notify all group members
      io.to(`group_${message.group_id}`).emit('reactionUpdate', {
        messageId: parseInt(messageId),
        emoji: emoji,
        action: action,
        userId: userId,
        reactionCounts: reactionCounts
      });
    }

    return res.status(200).json({
      success: true,
      action: action,
      reaction: {
        id: reaction.id,
        message_id: messageId,
        user_id: userId,
        emoji: emoji
      },
      reactionCounts: reactionCounts
    });

  } catch (error) {
    console.error('Error toggling reaction:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getMessageReactions = async (req, res) => {
  const userId = req.session.userId;
  const { messageId } = req.params;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Check if message exists and user has access
    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check access (same logic as toggle reaction)
    if (message.sender_id !== userId && message.recipient_id !== userId) {
      if (message.group_id) {
        const { GroupMember } = require('../models');
        const membership = await GroupMember.findOne({
          where: {
            group_id: message.group_id,
            user_id: userId
          }
        });

        if (!membership) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const reactionCounts = await getMessageReactionCounts(messageId, userId);

    return res.status(200).json({
      success: true,
      reactions: reactionCounts
    });

  } catch (error) {
    console.error('Error getting message reactions:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.searchMessages = async (req, res) => {
  const recipientId = parseInt(req.params.recipientId);
  const currentUser = res.locals.user;
  const { query, limit = 50 } = req.body;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 2 characters'
    });
  }

  try {
    const user = await User.findByPk(recipientId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Search messages in this conversation
    const messages = await Message.findAll({
      where: {
        [Op.and]: [
          // Messages between current user and recipient
          {
            [Op.or]: [
              { sender_id: currentUser.id, recipient_id: recipientId },
              { sender_id: recipientId, recipient_id: currentUser.id },
            ],
          },
          // Content contains search query
          {
            content: {
              [Op.like]: `%${query.trim()}%` // Case-insensitive search
            }
          },
          // Only text messages (exclude system messages, etc.)
          {
            message_type: 'text'
          }
        ]
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatar']
        }
      ],
      order: [['created_at', 'DESC']], // Most recent first
      limit: parseInt(limit)
    });

    const allmessages = messages.filter(message => {
      if (!message.clear_chat_by) return true;

      try {
        // Parse clear_chat_by if it's a string
        const clearedBy = typeof message.clear_chat_by === 'string'
          ? JSON.parse(message.clear_chat_by)
          : message.clear_chat_by;

        // Check if current user ID is in the clearedBy array
        return !clearedBy.includes(currentUser.id);
      } catch (error) {
        console.error('Error parsing clear_chat_by:', error);
        return true; // Return message if there's an error parsing
      }
    });
    
    // Format results for frontend
    const results = allmessages.map(message => ({
      id: message.id,
      content: message.content,
      created_at: message.created_at,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        avatar: message.sender.avatar
      }
    }));

    res.status(200).json({
      success: true,
      results: results,
      count: results.length,
      query: query
    });

  } catch (err) {
    console.error('Error searching messages:', err);
    res.status(500).json({
      success: false,
      error: 'Error searching messages'
    });
  }
};

exports.getMessageContext = async (req, res) => {
  const recipientId = parseInt(req.params.recipientId);
  const messageId = parseInt(req.params.messageId);
  const currentUser = res.locals.user;
  const contextSize = 20; // Messages before and after the target message

  try {
    // Parallel queries for better performance
    const [
      user,
      muteEntry,
      favoriteEntry,
      archiveEntry,
      blockEntry,
      targetMessage
    ] = await Promise.all([
      User.findByPk(recipientId),
      MutedChat.findOne({
        where: {
          user_id: currentUser.id,
          target_id: recipientId,
          target_type: 'user'
        }
      }),
      Favorite.findOne({
        where: {
          user_id: currentUser.id,
          target_id: recipientId,
          target_type: 'user'
        }
      }),
      Archive.findOne({
        where: {
          user_id: currentUser.id,
          target_id: recipientId,
          target_type: 'user'
        }
      }),
      Block.findOne({
        where: {
          blocker_id: currentUser.id,
          blocked_id: recipientId
        }
      }),
      // Find the target message
      Message.findOne({
        where: {
          id: messageId,
          [Op.or]: [
            { sender_id: currentUser.id, recipient_id: recipientId },
            { sender_id: recipientId, recipient_id: currentUser.id },
          ],
        }
      })
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!targetMessage) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Create enhanced user object with status properties
    const userWithStatus = {
      ...user.toJSON(),
      isFavorite: !!favoriteEntry,
      isArchived: !!archiveEntry,
      isBlocked: !!blockEntry,
      isMuted: !!muteEntry
    };

    // Get messages around the target message
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: currentUser.id, recipient_id: recipientId },
          { sender_id: recipientId, recipient_id: currentUser.id },
        ],
        // Get messages within a time range around the target message
        created_at: {
          [Op.between]: [
            new Date(targetMessage.created_at.getTime() - (7 * 24 * 60 * 60 * 1000)), // 7 days before
            new Date(targetMessage.created_at.getTime() + (7 * 24 * 60 * 60 * 1000))  // 7 days after
          ]
        }
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatar']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'name', 'avatar'],
          required: false
        },
        {
          model: MessageStatus,
          as: 'statuses',
          attributes: ['id', 'user_id', 'status']
        },
        {
          model: MessageReaction,
          as: 'reactions',
          include: [{
            model: User,
            attributes: ['id', 'name']
          }]
        }
      ],
      order: [['created_at', 'DESC']], // Latest first for processing
      limit: contextSize * 2 // Get enough messages around the target
    });

    if (messages.length === 0) {
      return res.json({
        success: false,
        error: 'No context messages found'
      });
    }

    // Reverse messages to show oldest first for display
    messages.reverse();

    // Group messages using existing helper functions
    const groupedMessages = groupMessagesBySender(messages, currentUser);
    const dateGroupedMessages = groupMessagesByDate(groupedMessages);

    // Calculate offset (approximate)
    const allMessagesCount = await Message.count({
      where: {
        [Op.or]: [
          { sender_id: currentUser.id, recipient_id: recipientId },
          { sender_id: recipientId, recipient_id: currentUser.id },
        ],
      }
    });

    const targetIndex = messages.findIndex(m => m.id === messageId);
    const approximateOffset = Math.max(0, allMessagesCount - messages.length - targetIndex);

    // Render the chat HTML
    const html = await new Promise((resolve, reject) => {
      req.app.render('front/messenger/components/chat', {
        layout: false,
        user: userWithStatus, // Use the enhanced user object
        dateGroupedMessages,
        currentUser,
        timeSince,
        formatDuration,
        formatDateLabel,
        formatFileSize,
        isMuted: userWithStatus.isMuted, // Use from userWithStatus for consistency
        currentUserId: req.session.userId,
        assetPath: res.locals.assetPath,
        metadata: {
          offset: approximateOffset,
          limit: messages.length,
          hasMore: approximateOffset > 0,
          messageCount: messages.length,
          conversationId: recipientId,
          cacheTimestamp: Date.now(),
          targetMessageId: messageId
        }
      }, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });

    res.status(200).json({
      success: true,
      html: html,
      messageCount: messages.length,
      offset: approximateOffset,
      hasMore: approximateOffset > 0,
      targetMessageId: messageId,
      userStatus: {
        isFavorite: userWithStatus.isFavorite,
        isArchived: userWithStatus.isArchived,
        isBlocked: userWithStatus.isBlocked,
        isMuted: userWithStatus.isMuted
      }
    });

  } catch (err) {
    console.error('Error getting message context:', err);
    res.status(500).json({
      success: false,
      error: 'Error loading message context'
    });
  }
};

exports.advancedSearchMessages = async (req, res) => {
  const recipientId = parseInt(req.params.recipientId);
  const currentUser = res.locals.user;
  const {
    query,
    messageType = 'text',
    dateFrom,
    dateTo,
    senderId,
    limit = 50,
    offset = 0
  } = req.body;

  if (!query || query.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Search query must be at least 2 characters'
    });
  }

  try {
    const user = await User.findByPk(recipientId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Build where conditions
    const whereConditions = {
      [Op.and]: [
        // Messages between current user and recipient
        {
          [Op.or]: [
            { sender_id: currentUser.id, recipient_id: recipientId },
            { sender_id: recipientId, recipient_id: currentUser.id },
          ],
        },
        // Content contains search query
        {
          content: {
            [Op.like]: `%${query.trim()}%`
          }
        }
      ]
    };

    // Add optional filters
    if (messageType && messageType !== 'all') {
      whereConditions[Op.and].push({ message_type: messageType });
    }

    if (dateFrom) {
      whereConditions[Op.and].push({
        created_at: { [Op.gte]: new Date(dateFrom) }
      });
    }

    if (dateTo) {
      whereConditions[Op.and].push({
        created_at: { [Op.lte]: new Date(dateTo) }
      });
    }

    if (senderId) {
      whereConditions[Op.and].push({ sender_id: parseInt(senderId) });
    }

    // Search messages with filters
    const messages = await Message.findAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatar']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Get total count for pagination
    const totalCount = await Message.count({
      where: whereConditions
    });

    // Format results
    const results = messages.map(message => ({
      id: message.id,
      content: message.content,
      message_type: message.message_type,
      file_url: message.file_url,
      created_at: message.created_at,
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        avatar: message.sender.avatar
      }
    }));

    res.status(200).json({
      success: true,
      results: results,
      count: results.length,
      totalCount: totalCount,
      hasMore: (offset + limit) < totalCount,
      query: query,
      filters: {
        messageType,
        dateFrom,
        dateTo,
        senderId
      }
    });

  } catch (err) {
    console.error('Error in advanced search:', err);
    res.status(500).json({
      success: false,
      error: 'Error searching messages'
    });
  }
};

exports.listDocuments = async (req, res) => {
  const currentUserId = req.session.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const { documents, count } = await getUserDocuments(currentUserId, { page, limit, paginate: true });

    res.status(200).json({
      success: true,
      documents,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        totalCount: count,
        hasMore: (page * limit) < count
      }
    });

  } catch (error) {
    console.error('Error in listDocuments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load documents'
    });
  }
};

exports.exportChat = async (req,res) => {
  try {
    const { recipientId } = req.query;
    const currentUserId = req.session.userId;

    const currentUser = await User.findByPk(currentUserId)

    if (!recipientId) {
      return res.status(400).json({ error: 'Recipient ID is required' });
    }

    // Get recipient user details
    const recipient = await User.findByPk(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Get messages between users with status information
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: currentUserId, recipient_id: recipientId },
          { sender_id: recipientId, recipient_id: currentUserId }
        ],
        message_type: 'text', // Only get text messages
        content: { [Op.ne]: null }, // Exclude empty messages
        clear_chat_by: { [Op.eq ]: null }
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name']
        },
      ],
      order: [['created_at', 'ASC']]
    });

    // Generate text content with the specified format
    let textContent = `Chat Conversation between ${currentUser.name} and ${recipient.name}\n`;
    textContent += `Exported on: ${formatDate(new Date())}\n`;
    textContent += '='.repeat(60) + '\n\n';

    if (messages.length === 0) {
      textContent += 'No text messages found in this conversation.\n';
    } else {
      messages.forEach(message => {
        const messageDate = new Date(message.created_at);
        const dateStr = formatDate(messageDate);
        const timeStr = formatTime(messageDate);
        const senderName = message.sender.name;
        
        textContent += `${dateStr}, ${timeStr} - ${senderName}: ${message.content}\n`;
      });
    }

    // Set response headers for file download
    const filename = `chat_${formatFilename(currentUser.name)}_${formatFilename(recipient.name)}_${formatDateForFilename(new Date())}.txt`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain');
    
    // Send the text content
    res.send(textContent);

  } catch (error) {
    console.error('Text export error:', error);
    res.status(500).json({ error: 'Failed to export chat' });
  }
}

exports.clearAllChats = async (req, res) => {
  const currentUserId = req.session.userId;;

  try {
    // Fetch all messages where the user is either the sender or recipient
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: currentUserId },
          { recipient_id: currentUserId }
        ]
      }
    });

    // Update clear_chat_by field to include the current user
    const updatePromises = messages.map(async message => {
      let clearedBy = [];

      if (message.clear_chat_by) {
        try {
          clearedBy = typeof message.clear_chat_by === 'string'
            ? JSON.parse(message.clear_chat_by)
            : message.clear_chat_by;
        } catch (e) {
          clearedBy = [];
        }
      }

      if (!clearedBy.includes(currentUserId)) {
        clearedBy.push(currentUserId);
        await message.update({ clear_chat_by: clearedBy });
      }
    });

    await Promise.all(updatePromises);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Failed to clear all chats:', error);
    return res.status(500).json({ error: 'Failed to clear all chats' });
  }
};

exports.archiveAllChats = async (req, res) => {
  const userId = req.session.userId;

  try {
    // Fetch all messages involving the user
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { recipient_id: userId }
        ]
      },
      attributes: ['sender_id', 'recipient_id', 'group_id']
    });

    const userTargets = new Set();
    const groupTargets = new Set();

    for (const msg of messages) {
      if (msg.group_id) {
        groupTargets.add(msg.group_id);
      } else {
        const otherUserId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
        if (otherUserId) userTargets.add(otherUserId);
      }
    }

    const createArchiveRecord = (targetId, targetType) => (
      Archive.findOrCreate({
        where: {
          user_id: userId,
          target_id: targetId,
          target_type: targetType
        }
      })
    );

    const archivePromises = [
      ...[...userTargets].map(id => createArchiveRecord(id, 'user')),
      ...[...groupTargets].map(id => createArchiveRecord(id, 'group'))
    ];

    const results = await Promise.all(archivePromises);
    const archivedCount = results.filter(([record, created]) => created).length;

    return res.json({ success: true, archivedCount });
  } catch (error) {
    console.error('Error archiving all chats:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteAllChats = async (req, res) => {
  const userId = parseInt(req.session.userId);

  try {
    // Step 1: Fetch all messages where the user is either sender or recipient
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { sender_id: userId },
          { recipient_id: userId }
        ]
      },
      attributes: ['id', 'sender_id', 'recipient_id', 'clear_chat_by']
    });

    // Track unique users the current user has interacted with
    const interactedUserIds = new Set();

    // Step 2: Update clear_chat_by and collect interaction targets
    const updatePromises = messages.map(async (msg) => {
      const clearedBy = parseJsonArray(msg.clear_chat_by);
      const updates = {};

      // Add userId to clear_chat_by if not already present
      if (!clearedBy.includes(userId)) {
        updates.clear_chat_by = JSON.stringify([...clearedBy, userId]);
      }

      // Determine the other user in the conversation
      const otherUserId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id;
      if (otherUserId) {
        interactedUserIds.add(otherUserId);
      }

      // Update message if needed
      if (Object.keys(updates).length > 0) {
        await msg.update(updates);
      }
    });

    await Promise.all(updatePromises);

    // Step 3: Create UserDelete records for each unique interaction
    const deletePromises = Array.from(interactedUserIds).map(async (targetId) => {
      const existing = await UserDelete.findOne({
        where: {
          user_id: userId,
          target_id: targetId,
          target_type: 'user'
        }
      });

      if (!existing) {
        await UserDelete.create({
          user_id: userId,
          target_id: targetId,
          target_type: 'user',
          delete_type: 'hide_chat'
        });
      }
    });

    await Promise.all(deletePromises);

    return res.json({
      success: true,
      message: 'All chats deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting all chats:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.searchDocuments = async (req, res) => {
  const currentUserId = req.session.userId;
  const search = req.query.search?.toLowerCase() || '';

  try {
    const { documents } = await getUserDocuments(currentUserId, { search, paginate: false });

    res.status(200).json(documents);

  } catch (error) {
    console.error('Error in searchDocuments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search documents'
    });
  }
};

exports.searchNewChat = async (req, res) => {
  const currentUserId = req.session.userId;
  const searchTerm = req.query.q || '';
  const type = req.query.type || 'chat'; // 'chat', 'call', or 'friend'

  try {
    let contacts = [];

    if (type === 'friend') {
      // Fetch friend suggestions (users who are not yet friends)
      const suggestions = await getFriendSuggestions(currentUserId); 
      contacts = suggestions;
    } else {
      // Fetch current contacts (for chat or call)
      const contactsData = await getUserContacts(currentUserId, { paginate: false });
      contacts = contactsData.contacts;
    }

    // Filter by name
    const filteredContacts = contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    res.status(200).json({
      success: true,
      contacts: filteredContacts
    });

  } catch (error) {
    console.error('Error in searchNewChat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search contacts'
    });
  }
};

exports.searchRecentChat = async ( req,res) => {
  try {
    const currentUserId = req.session.userId;
    const searchTerm = req.query.search?.trim() || '';

    const { messages } = await fetchRecentChats(currentUserId, 1, 1000, { paginate: false });

    // Apply LIKE-style filtering here (similar to searchNewChat)
    const filteredMessages = messages.filter(msg => {
      const name = msg.chat_type === 'dm'
        ? msg.chat_partner?.name?.toLowerCase()
        : msg.group?.name?.toLowerCase();

      return name && name.includes(searchTerm);
    });

    res.status(200).json({
      success: true,
      chats: filteredMessages
    });
  } catch (err) {
    console.error('searchRecentChats error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

exports.searchRecentCall = async ( req,res) => {
  try {
    const currentUserId = req.session.userId;
    const searchTerm = req.query.search?.trim() || '';

    // Fetch all recent calls (no pagination)
    const { calls } = await fetchRecentCalls(currentUserId, { paginate: false });

    // Filter user names from grouped calls
    const filteredGrouped = {};

    Object.entries(calls).forEach(([group, callList]) => {

      const matched = callList.filter(call =>{
        return call.user?.name?.toLowerCase().includes(searchTerm)
      });

      if (matched.length > 0) {
        filteredGrouped[group] = matched;
      }
    });
    
    res.json({
      success: true,
      data: filteredGrouped
    });
    
  } catch (err) {
    console.error('searchRecentCall error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

exports.searchRecentContacts = async (req,res) => {
  try {
    const currentUserId = req.session.userId;
    const searchTerm = req.query.search?.trim() || '';

    // Fetch current contacts (for chat or call)
    const contactsData = await getUserContacts(currentUserId, { paginate: false });

    // Filter by name
    const filteredContacts = contactsData.contacts.filter(contact =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    res.status(200).json({
      success: true,
      contacts: filteredContacts
    });
  } catch (err) {
    console.error('searchRecentChats error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

exports.connectToDrive = async (req, res) => {
  const userId = req.session.userId;

  if (!userId) return res.status(401).send('Unauthorized');

  // Check if user already connected Google Drive
  const existingToken = await GoogleToken.findOne({ where: { user_id: userId } });

  if (existingToken) {
    // Already connected, skip OAuth
    return res.send('Google Drive already connected');
  }

  //  Not connected yet — initiate OAuth flow
  const oAuth2Client = getOAuthClient();
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent', // ensures refresh_token is returned
  });

  res.redirect(url);
};

exports.saveToken = async (req,res) => {
  const code = req.query.code;
  const oAuth2Client = getOAuthClient();

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Get Google email (optional)
    const oauth2 = google.oauth2({ version: 'v2', auth: oAuth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    const userId = req.session.userId; // must exist!

    // Save tokens to DB
    await GoogleToken.upsert({
      user_id:userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      google_email: profile.email,
    });

    res.redirect('/messenger?connectedDrive=true');
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).send('Google Authentication Failed');
  }
}

exports.toggleStarMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const { starred } = req.body; // boolean: true to star, false to unstar
    const currentUserId = req.session.userId;
    
    if (!currentUserId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const message = await Message.findByPk(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    const existingMetadata = message.metadata || {};
    const existingFlags = existingMetadata.flags || {};
    const starredBy = existingFlags.starred_by || [];

    if (starred) {
      // Star the message
      if (!starredBy.includes(currentUserId)) {
        const updatedStarredBy = [...starredBy, currentUserId];
        
        const updatedMetadata = {
          ...existingMetadata,
          flags: {
            ...existingFlags,
            starred_by: updatedStarredBy
          }
        };

        await message.update({ metadata: updatedMetadata });
        return res.json({ success: true, action: 'starred', message: "Message starred" });
      }
      return res.json({ success: true, action: 'already_starred', message: "Message already starred" });
      
    } else {
      // Unstar the message
      if (starredBy.includes(currentUserId)) {
        const updatedStarredBy = starredBy.filter(id => id !== currentUserId);
        
        const updatedFlags = {
          ...existingFlags,
          starred_by: updatedStarredBy.length > 0 ? updatedStarredBy : undefined
        };

        // Clean up empty flags object
        const updatedMetadata = {
          ...existingMetadata,
          flags: Object.keys(updatedFlags).length > 0 ? updatedFlags : undefined
        };

        await message.update({ metadata: updatedMetadata });
        return res.json({ success: true, action: 'unstarred', message: "Message unstarred" });
      }
      return res.json({ success: true, action: 'already_unstarred', message: "Message already unstarred" });
    }

  } catch (err) {
    console.error("Error toggling star message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.editMessage = async (req,res) => {
  try {
    const messageId = req.params.id;
    const { content } = req.body;
    const userId = req.session.userId;

    const message = await Message.findByPk(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    await message.update({
      content,
      metadata: {
        ...(message.metadata || {}),
        edited: true
      }
    });

    const io = req.app.get('io');
    const recipientId = message.recipient_id;

    if (io && recipientId) {
      io.to(`user_${recipientId}`).emit("messageEdit", {
        messageId: messageId,
        content
      });
    }

    res.json({ success: true, message: "Message updated" });
  } catch (err) {
    console.error("Edit failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

exports.deleteMessage = async (req, res) => {
  const messageId = parseInt(req.params.messageId);
  const userId = req.session.userId;
  const deleteType = req.body.type;

  try {
    const message = await Message.findByPk(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Always clone metadata as a plain object
    let metadata = {};
    if (message.metadata && typeof message.metadata === 'object') {
      metadata = { ...message.metadata };
    }

    if (deleteType === "delete-for-me") {
      metadata.deleted_for = Array.isArray(metadata.deleted_for)
        ? [...metadata.deleted_for]
        : [];

      if (!metadata.deleted_for.includes(userId)) {
        metadata.deleted_for.push(userId);
      }

      // Replace entire metadata object
      message.setDataValue('metadata', metadata);

    } else if (deleteType === "delete-for-everyone") {
      if (message.sender_id !== userId) {
        return res.status(403).json({ message: "Only the sender can delete for everyone." });
      }

      const io = req.app.get('io');
      const recipientId = message.recipient_id;

      if (io && recipientId) {
        io.to(`user_${recipientId}`).emit("messageDeleteForEveryone", {
          messageId: messageId,
          senderId: userId,
          deletedByName: req.session.userName || 'Someone'
        });
      }

      metadata.deleted_by = userId;
      metadata.deleted_for = [
        ...(Array.isArray(metadata.deleted_for) ? metadata.deleted_for : []),
        message.sender_id,
        message.recipient_id
      ];

      //   Replace entire metadata object
      message.setDataValue('metadata', metadata);

    } else {
      return res.status(400).json({ message: "Invalid delete type." });
    }

    await message.save();

    return res.json({
      success: true,
      deleteType,
      message: "Message deleted successfully."
    });

  } catch (err) {
    console.error("Error deleting message:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.forwardMessage = async (req,res) => {
  const senderId = req.session.userId;
  const { messageId, recipientIds } = req.body;

  if (!senderId || !messageId || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return res.status(400).json({ error: "Missing messageId or recipientIds." });
  }

  try {
    const original = await Message.findByPk(messageId);

    if (!original) {
      return res.status(404).json({ error: "Original message not found." });
    }

    const messages = [];

    // List of keys to keep from original metadata
    const fileRelatedKeys = [
      'file_size',
      'mime_type',
      'file_index',
      'is_multiple',
      'original_filename'
    ];

    // Build filtered metadata
    const fileMetadata = {};
    for (const key of fileRelatedKeys) {
      if (original.metadata && key in original.metadata) {
        fileMetadata[key] = original.metadata[key];
      }
    }

    for (const recipientId of recipientIds) {
      const forwardedMessage = await Message.create({
        sender_id: senderId,
        recipient_id: recipientId,
        group_id: null,
        content: original.content,
        message_type: original.message_type,
        file_url: original.file_url,
        file_type: original.file_type,
        metadata: {
          ...fileMetadata,
          is_forwarded: true,
          original_message_id: original.id,
          original_sender_id: original.sender_id
        }
      });

      // Create status entry
      await MessageStatus.create({
        message_id: forwardedMessage.id,
        user_id: recipientId,
        status: 'sent',
      });

      messages.push(forwardedMessage);
    }

    // Fetch full message with associations
    const fullMessages = await Promise.all(
      messages.map(msg =>
        Message.findByPk(msg.id, {
          include: [
            { model: User, as: 'sender', attributes: ['id', 'name', 'avatar'] },
            { model: User, as: 'recipient', attributes: ['id', 'name', 'avatar'], required: false },
          ]
        })
      )
    );

    // Emit via socket.io
    const io = req.app.get('io');
    for (const fullMessage of fullMessages) {
      io.to(`user_${senderId}`).emit('newDirectMessage', fullMessage);
      io.to(`user_${fullMessage.recipient_id}`).emit('newDirectMessage', fullMessage);
      io.to(`user_${senderId}`).emit('messageStatusUpdated', {
        messageId: fullMessage.id,
        status: 'sent',
      });
    }

    return res.status(200).json({ success: true, count: fullMessages.length, messages: fullMessages });

  } catch (error) {
    console.error("❌ Error forwarding message:", error);
    return res.status(500).json({ error: "Internal server error while forwarding message." });
  }
}

exports.submitContactForm = async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).send('All fields are required');
  }

  try {
    await ContactUs.create({
      name,
      email,
      subject,
      message,
      created_at: new Date(),
    });

    return res.status(200).json({ success:true, message: 'Your Form Submit Successfully.' });
  } catch (error) {
    console.error('Error saving contact message:', error);
    return res.status(500).send('Internal Server Error');
  }
};