'use strict';
const { Op } = require('sequelize');
const { sequelize, Sequelize, User, Message, Group, GroupMember, MessageStatus, Friend,
  MutedChat, MessageReaction, PinnedConversation, Favorite, Archive,
  Block, UserSettings, UserDelete, Call, CallParticipant, GoogleToken } = require('../models');

function getUserContacts(currentUserId, options) {
  return new Promise(async function (resolve, reject) {
    try {
      const paginate = options.paginate || false;
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;

      // Get friend IDs
      const friendIds = await Friend.findAll({
        attributes: [
          [sequelize.literal(`CASE 
            WHEN user_id = ${currentUserId} THEN friend_id 
            ELSE user_id 
          END`), 'friend_id']
        ],
        where: {
          status: 'accepted',
          [Op.or]: [
            { user_id: currentUserId },
            { friend_id: currentUserId }
          ]
        },
        raw: true
      });

      const uniqueFriendIds = [...new Set(friendIds.map(item => item.friend_id))];
      if (uniqueFriendIds.length === 0) {
        return resolve({ contacts: [], pagination: paginate ? {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasMore: false
        } : undefined });
      }

      // Get IDs of users blocked by current user
      const blockedUsers = await Block.findAll({
        where: { blocker_id: currentUserId },
        attributes: ['blocked_id'],
        raw: true
      });

      const blockedUserIds = blockedUsers.map(b => b.blocked_id);

      // Filter out blocked users from the friend list
      const visibleFriendIds = uniqueFriendIds.filter(id => !blockedUserIds.includes(id));

      if (visibleFriendIds.length === 0) {
        return resolve({ contacts: [], pagination: paginate ? {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasMore: false
        } : undefined });
      }

      // Build query options
      const queryOptions = {
        where: {
          id: {
            [Op.in]: visibleFriendIds
          }
        },
        attributes: ['id', 'name', 'avatar', 'bio', 'email', 'is_online', 'last_seen'],
        order: [['name', 'ASC']]
      };

      if (paginate) {
        queryOptions.limit = limit;
        queryOptions.offset = offset;
      }

      const friends = await User.findAll(queryOptions);

      const formattedFriends = friends.map(function (friend) {
        return {
          id: friend.id,
          name: friend.name,
          avatar: friend.avatar,
          email: friend.email,
          is_online: friend.is_online,
          last_seen: friend.last_seen,
          status: friend.bio ? friend.bio : "Hey! I'm using Chitchat."
        };
      });

      const result = {
        contacts: formattedFriends
      };

      if (paginate) {
        result.pagination = {
          currentPage: page,
          totalPages: Math.ceil(visibleFriendIds.length / limit),
          totalCount: visibleFriendIds.length,
          hasMore: (offset + limit) < visibleFriendIds.length
        };
      }

      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

async function getFriendSuggestions(currentUserId) {
  
  // Fetch all friendships
  const friendships = await Friend.findAll({
    where: {
      [Op.or]: [
        { user_id: currentUserId },
        { friend_id: currentUserId }
      ]
    },
    attributes: ['user_id', 'friend_id'],
  });

  const friendIds = new Set();
  friendships.forEach(f => {
    friendIds.add(f.user_id === currentUserId ? f.friend_id : f.user_id);
  });
  friendIds.add(currentUserId);

  const suggestions = await User.findAll({
    where: {
      id: { [Op.notIn]: Array.from(friendIds) },
      role: 'user',
      status: 'active'
    },
    raw:true,
    attributes: ['id', 'name', 'avatar', 'email', 'bio', 'is_online'],
    order: [['name', 'ASC']]
  });

  return suggestions;
}

async function getFavoritesWithTargetData(userId) {
  const { count, rows } = await Favorite.findAndCountAll({
    where: { user_id: userId },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen', 'bio']
      }
    ],
    order: [['created_at', 'DESC']]
  });

  const favoritesWithData = await Promise.all(
    rows.map(async (favorite) => {
      let targetData = null;

      if (favorite.target_type === 'user') {
        targetData = await User.findByPk(favorite.target_id, {
          attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen', 'bio']
        });
      } else if (favorite.target_type === 'group') {
        targetData = await Group.findByPk(favorite.target_id, {
          attributes: ['id', 'name', 'avatar', 'description']
        });
      }

      return {
        id: favorite.id,
        target_id: favorite.target_id,
        target_type: favorite.target_type,
        created_at: favorite.created_at,
        user: favorite.target_type === 'user' ? targetData : null,
        group: favorite.target_type === 'group' ? targetData : null
      };
    })
  );

  // Filter out deleted users/groups
  const validFavorites = favoritesWithData.filter(fav =>
    (fav.target_type === 'user' && fav.user) ||
    (fav.target_type === 'group' && fav.group)
  );

  return { count, favorites: validFavorites };
}; 

async function fetchBlockedUsers(userId, options = {}){
  const page = options.page || 1;
  const limit = options.limit || 1000; // Large limit for search
  const offset = (page - 1) * limit;

  const { count, rows } = await Block.findAndCountAll({
      where: { blocker_id: userId },
      include: [
          {
              model: User,
              as: 'blocked',
              attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen', 'bio']
          }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
  });

  const blockedUsers = rows
      .filter(b => b.blocked)
      .map(b => ({
          id: b.id,
          blocked_user: b.blocked,
          reason: b.reason,
          created_at: b.created_at
      }));

  return { blockedUsers, count };
};

async function formatLastMessage (message) {
  if (!message) return 'No messages yet';
  
  const { content, message_type, file_url } = message;
  
  switch (message_type) {
      case 'text':
          return content || 'Message';
      case 'image':
          return '📷 Photo';
      case 'video':
          return '🎥 Video';
      case 'audio':
          return '🎵 Audio';
      case 'file':
          return '📄 File';
      case 'sticker':
          return '✨ Sticker';
      default:
          return 'Message';
  }
};

async function fetchArchivedChats(userId, { page = 1, limit = 20, search = '' }) {
  const offset = (page - 1) * limit;

  const { count, rows: archives } = await Archive.findAndCountAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit,
      offset,
      raw: true
  });

  const archivedChats = await Promise.all(
      archives.map(async (archive) => {
          let targetData = null;
          let lastMessage = 'No messages yet';

          if (archive.target_type === 'user') {
              targetData = await User.findByPk(archive.target_id, {
                  attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen', 'bio'],
                  raw: true
              });

              const lastMsg = await Message.findOne({
                  where: {
                      [Op.or]: [
                          { sender_id: userId, recipient_id: archive.target_id },
                          { sender_id: archive.target_id, recipient_id: userId }
                      ]
                  },
                  order: [['created_at', 'DESC']],
                  raw: true
              });

              if (lastMsg) {
                  lastMessage = await formatLastMessage(lastMsg);
              }
          }

          return {
              id: archive.id,
              target_type: archive.target_type,
              target_id: archive.target_id,
              created_at: archive.created_at,
              target: targetData || {
                  id: archive.target_id,
                  name: archive.target_type === 'user' ? 'Unknown User' : 'Unknown Group'
              },
              last_message: lastMessage
          };
      })
  );

  return {
      archivedChats,
      pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalCount: count,
          hasMore: (page * limit) < count
      }
  };
}

async function getUserDocuments(userId, { search = '', page = 1, limit = 20, paginate = true }){
  const offset = (page - 1) * limit;

  const whereClause = {
    message_type: ['document', 'file', 'audio', 'video', 'image'],
    [Op.or]: [
      { sender_id: userId },
      { recipient_id: userId },
      {
        group_id: {
          [Op.in]: sequelize.literal(`(
            SELECT group_id FROM group_members 
            WHERE user_id = ${userId}
          )`)
        }
      }
    ],
    [Op.and]: [
      {
        [Op.or]: [
          // deleted_for is null
          sequelize.where(
            sequelize.json('metadata.deleted_for'),
            null
          ),
          // deleted_for does not contain userId
          sequelize.literal(`JSON_CONTAINS(JSON_EXTRACT(metadata, '$.deleted_for'), CAST('${userId}' AS JSON)) = 0`)
        ]
      }
    ]
  };

  const queryOptions = {
    where: whereClause,
    include: [
      { model: User, as: 'sender', attributes: ['id', 'name'] },
      { model: User, as: 'recipient', attributes: ['id', 'name'] },
      { model: Group, as: 'group', attributes: ['id', 'name'] }
    ],
    order: [['created_at', 'DESC']]
  };

  if (paginate) {
    queryOptions.limit = limit;
    queryOptions.offset = offset;
  }

  const { count, rows } = await Message.findAndCountAll(queryOptions);

  // Format documents
  const documents = rows.map(message => ({
    id: message.id,
    file_name: message.file_url?.split('/').pop() || '',
    file_url: message.file_url,
    file_type: message.file_type,
    created_at: message.created_at,
    sender: message.sender,
    recipient: message.recipient,
    group: message.group
  }));

  // Apply search filtering if needed
  const filteredDocuments = search
    ? documents.filter(doc => doc.file_name.toLowerCase().includes(search.toLowerCase()))
    : documents;

  return {
    documents: filteredDocuments,
    count: search ? filteredDocuments.length : count
  };
};

async function fetchRecentChats(
  currentUserId,
  page = 1,
  limit = 20,
  options = { paginate: true }
) {
  const offset = (page - 1) * limit;

  // 1. Load user preferences, blocks, archives, and friends
  const [mutedChats, pinnedChats, hiddenChats, blockedRecords, archivedChats, friends] = await Promise.all([
    MutedChat.findAll({ where: { user_id: currentUserId }, raw: true }),
    PinnedConversation.findAll({ where: { user_id: currentUserId }, raw: true }),
    UserDelete.findAll({
      where: { user_id: currentUserId, delete_type: 'hide_chat' },
      attributes: ['target_id', 'target_type'],
      raw: true
    }),
    // Get both blocked and blocked_by records
    Block.findAll({
      where: {
        [Op.or]: [
          { blocker_id: currentUserId },
          { blocked_id: currentUserId }
        ]
      },
      raw: true
    }),
    Archive.findAll({
      where: { user_id: currentUserId },
      attributes: ['target_id', 'target_type'],
      raw: true
    }),
    // Get accepted friends
    Friend.findAll({
      where: {
        [Op.or]: [
          { user_id: currentUserId, status: 'accepted' },
          { friend_id: currentUserId, status: 'accepted' }
        ]
      },
      raw: true
    })
  ]);

  const mutedMap = new Set(mutedChats.map(m => `${m.target_type}:${m.target_id}`));
  const pinnedMap = new Set(pinnedChats.map(p => `${p.type}:${p.target_id}`));
  const hiddenMap = new Set(hiddenChats.map(h => `${h.target_type}_${h.target_id}`));

  // Create sets for blocked users and archived conversations
  const blockedUsers = new Set();
  const archivedMap = new Set(archivedChats.map(a => `${a.target_type}:${a.target_id}`));

  // Create set for friends
  const friendIds = new Set();
  friends.forEach(friend => {
    if (friend.user_id === currentUserId) {
      friendIds.add(friend.friend_id);
    } else {
      friendIds.add(friend.user_id);
    }
  });

  // Process block records
  blockedRecords.forEach(block => {
    if (block.blocker_id === currentUserId) {
      // User blocked someone
      blockedUsers.add(block.blocked_id);
    } else if (block.blocked_id === currentUserId) {
      // User was blocked by someone
      blockedUsers.add(block.blocker_id);
    }
  });

  // Build where conditions for direct conversations - only with friends
  const directWhereConditions = {
    group_id: null,
    [Op.or]: [
      {
        sender_id: currentUserId,
        recipient_id: { [Op.in]: Array.from(friendIds) }
      },
      {
        recipient_id: currentUserId,
        sender_id: { [Op.in]: Array.from(friendIds) }
      }
    ]
  };

  // Add hidden chat condition if needed
  if (hiddenMap.size > 0) {
    directWhereConditions[Op.and] = [
      sequelize.where(
        sequelize.literal(`CASE 
          WHEN sender_id = ${currentUserId} THEN CONCAT('user_', recipient_id)
          ELSE CONCAT('user_', sender_id)
        END`),
        { [Op.notIn]: Array.from(hiddenMap) }
      )
    ];
  }

  // 2. Get direct conversations (exclude blocked and archived)
  let directConversationsQuery = {
    attributes: [
      [Sequelize.fn('DISTINCT', Sequelize.literal(`CASE 
        WHEN sender_id = ${currentUserId} THEN recipient_id 
        ELSE sender_id 
      END`)), 'partner_id'],
      [Sequelize.fn('MAX', Sequelize.col('created_at')), 'last_activity']
    ],
    where: directWhereConditions,
    group: [sequelize.literal(`CASE 
      WHEN sender_id = ${currentUserId} THEN recipient_id 
      ELSE sender_id 
    END`)],
    order: [[sequelize.fn('MAX', sequelize.col('created_at')), 'DESC']],
    raw: true
  };

  // Apply blocking filter in application layer instead of SQL
  const directConversations = await Message.findAll(directConversationsQuery);

  // Filter out blocked users and archived chats in JavaScript
  const filteredDirectConversations = directConversations.filter(dc => {
    const partnerId = dc.partner_id;

    // Skip if user is blocked
    if (blockedUsers.has(partnerId)) {
      return false;
    }

    // Skip if chat is archived
    if (archivedMap.has(`user:${partnerId}`)) {
      return false;
    }

    return true;
  });

  // 3. Get group conversations (exclude archived and hidden)
  const groupExcludeIds = [];

  // Add hidden group chats
  Array.from(hiddenMap)
    .filter(h => h.startsWith('group_'))
    .forEach(h => {
      groupExcludeIds.push(parseInt(h.replace('group_', '')));
    });

  // Add archived group chats
  Array.from(archivedMap)
    .filter(a => a.startsWith('group:'))
    .forEach(a => {
      groupExcludeIds.push(parseInt(a.replace('group:', '')));
    });

  // Get all groups the user is a member of
  const userGroups = await GroupMember.findAll({
    where: { user_id: currentUserId },
    attributes: ['group_id'],
    raw: true
  });

  const userGroupIds = userGroups.map(g => g.group_id);

  // If user is not in any groups, skip group query
  let groupConversations = [];
  if (userGroupIds.length > 0) {
    const groupWhereConditions = {
      group_id: {
        [Op.in]: userGroupIds
      }
    };

    // Add exclude condition if there are groups to exclude
    if (groupExcludeIds.length > 0) {
      groupWhereConditions.group_id[Op.notIn] = groupExcludeIds;
    }

    groupConversations = await Message.findAll({
      attributes: [
        'group_id',
        [Sequelize.fn('MAX', Sequelize.col('created_at')), 'last_activity']
      ],
      where: groupWhereConditions,
      group: ['group_id'],
      order: [[Sequelize.fn('MAX', sequelize.col('created_at')), 'DESC']],
      raw: true
    });
  }

  // 4. Merge & resolve conversations
  const allConversations = [
    ...filteredDirectConversations.map(dc => ({
      type: 'dm',
      id: dc.partner_id,
      last_activity: dc.last_activity
    })),
    ...groupConversations.map(gc => ({
      type: 'group',
      id: gc.group_id,
      last_activity: gc.last_activity
    }))
  ];

  const conversationMessages = await Promise.all(
    allConversations.map(async (conv) => {
      if (conv.type === 'dm') {
        // Additional check to ensure this is actually a friend
        if (!friendIds.has(conv.id)) {
          return null;
        }

        const latestMessage = await Message.findOne({
          where: {
            group_id: null,
            [Op.or]: [
              { sender_id: currentUserId, recipient_id: conv.id },
              { sender_id: conv.id, recipient_id: currentUserId }
            ]
          },
          include: [
            { model: User, as: 'sender', attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen'] },
            { model: User, as: 'recipient', attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen'] },
            {
              model: MessageStatus,
              as: 'statuses',
              where: { user_id: { [Op.ne]: currentUserId } },
              required: false
            }
          ],
          order: [['created_at', 'DESC']],
          paranoid: false
        });

        if (!latestMessage) return null;

        // Unread count
        const unreadMessages = await Message.findAll({
          where: {
            sender_id: conv.id,
            recipient_id: currentUserId,
            group_id: null,
            [Op.or]: [
              { clear_chat_by: null },
              Sequelize.literal(`NOT (JSON_CONTAINS(clear_chat_by, '${currentUserId}', '$'))`)
            ]
          },
          include: [{
            model: MessageStatus,
            as: 'statuses',
            where: {
              user_id: currentUserId,
              status: { [Op.ne]: 'seen' }
            },
            required: true
          }],
          paranoid: false
        });
        
        const unreadCount = unreadMessages.length;
        const msg = latestMessage.toJSON();

        return {
          ...msg,
          unreadCount,
          isMuted: mutedMap.has(`user:${conv.id}`),
          isPinned: pinnedMap.has(`user:${conv.id}`),
          chat_type: 'dm',
          chat_partner: msg.sender_id === currentUserId ? msg.recipient : msg.sender
        };
      }

      // Group chat - FIXED: Use the correct association name
      const latestGroupMsg = await Message.findOne({
        where: { group_id: conv.id },
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'name', 'avatar']
          },
          {
            model: Group,
            as: 'group',
            attributes: ['id', 'name', 'avatar'],
          }
        ],
        order: [['created_at', 'DESC']],
        paranoid: false
      });

      if (!latestGroupMsg) return null;

      // Get unread count for group messages
      const lastSeenMessage = await MessageStatus.findOne({
        where: {
          user_id: currentUserId,
          message_id: {
            [Op.in]: sequelize.literal(
              `(SELECT id FROM messages WHERE group_id = ${conv.id})`
            )
          }
        },
        order: [['message_id', 'DESC']],
        raw: true
      });

      let unreadCount = 0;
      if (lastSeenMessage) {
        unreadCount = await Message.count({
          where: {
            group_id: conv.id,
            id: { [Op.gt]: lastSeenMessage.message_id }
          }
        });
      } else {
        // If user has never seen any messages, count all messages in group
        unreadCount = await Message.count({
          where: { group_id: conv.id }
        });
      }

      const msg = latestGroupMsg.toJSON();

      return {
        ...msg,
        unreadCount,
        isMuted: mutedMap.has(`group:${conv.id}`),
        isPinned: pinnedMap.has(`group:${conv.id}`),
        chat_type: 'group',
        group: msg.group
      };
    })
  );

  // Filter out nulls
  let validMessages = conversationMessages.filter(Boolean);

  // Sort pinned first, then by recency
  validMessages.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  // Handle cleared/deleted messages
  const cleanedMessages = validMessages.map(msg => {
    if (msg.clear_chat_by) {
      try {
        const clearedBy = typeof msg.clear_chat_by === 'string'
          ? JSON.parse(msg.clear_chat_by)
          : msg.clear_chat_by;

        if (clearedBy.includes(currentUserId)) {
          return {
            ...msg,
            content: 'This message was cleared',
            file_url: null,
            file_type: null,
            message_type: 'system',
            metadata: null,
            is_cleared: true
          };
        }
      } catch { }
    }

    if (msg.deleted_at) {
      return {
        ...msg,
        content: 'This message was deleted',
        file_url: null,
        file_type: null,
        message_type: 'system',
        metadata: null,
        is_deleted: true
      };
    }

    return msg;
  });

  // Paginate if enabled
  const finalMessages = options.paginate
    ? cleanedMessages.slice(offset, offset + limit)
    : cleanedMessages;

  return {
    messages: finalMessages,
    pagination: options.paginate
      ? {
        currentPage: page,
        totalPages: Math.ceil(cleanedMessages.length / limit),
        totalCount: cleanedMessages.length,
        hasMore: (page * limit) < cleanedMessages.length
      }
      : null
  };
};

async function fetchRecentCalls (currentUserId, { paginate = true, page = 1, limit = 20 } = {}){
  const offset = (page - 1) * limit;

  const baseConditions = {
    [Op.or]: [
      { initiator_id: currentUserId },
      { receiver_id: currentUserId },
    ],
    status: 'ended',
  };

  const queryOptions = {
    where: baseConditions,
    include: [
      {
        model: User,
        as: 'initiator',
        attributes: ['id', 'name', 'avatar', 'is_online'],
      },
      {
        model: User,
        as: 'receiver',
        attributes: ['id', 'name', 'avatar', 'is_online'],
      },
      {
        model: CallParticipant,
        as: 'participants',
        attributes: ['id', 'user_id', 'status', 'joined_at', 'left_at'],
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar', 'is_online'],
        }]
      },
    ],
    order: [['ended_at', 'DESC']],
    distinct: true
  };

  if (paginate) {
    queryOptions.limit = parseInt(limit);
    queryOptions.offset = parseInt(offset);
  }

  const { count, rows: calls } = await Call.findAndCountAll(queryOptions);

  // Grouping logic
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const thisWeek = new Date(today); thisWeek.setDate(thisWeek.getDate() - 7);
  const thisMonth = new Date(today); thisMonth.setMonth(thisMonth.getMonth() - 1);

  const groupedCalls = calls.reduce((acc, call) => {
    const callDate = new Date(call.ended_at);
    let groupName;

    if (callDate >= today) groupName = 'Today';
    else if (callDate >= yesterday) groupName = 'Yesterday';
    else if (callDate >= thisWeek) groupName = 'This Week';
    else if (callDate >= thisMonth) groupName = 'This Month';
    else groupName = 'Older';

    if (!acc[groupName]) acc[groupName] = [];

    const isIncoming = call.receiver_id === currentUserId;
    const otherUser = isIncoming ? call.initiator : call.receiver;
    const isMissed = call.duration === 0 && isIncoming &&
      call.participants.find(p => p.user_id == currentUserId)?.status !== 'declined';

    acc[groupName].push({
      id: call.id,
      user: otherUser,
      callType: call.call_type,
      callMode: call.call_mode,
      isIncoming,
      isMissed,
      isGroup: call.call_mode === 'group',
      participants: call.participants,
      timestamp: call.ended_at,
      duration: call.duration,
      exactDate: callDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      exactTime: callDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });

    return acc;
  }, {});

  return {
    calls: groupedCalls,
    pagination: paginate ? {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      offset,
      hasMore: (page * limit) < count
    } : null
  };
};

async function getMessageReactionCounts(messageId, currentUserId) {
  try {
    const reactions = await MessageReaction.findAll({
      where: { message_id: messageId },
      include: [{
        model: User,
        attributes: ['id', 'name']
      }],
      order: [['created_at', 'ASC']],
      raw: true
    });

    // Group reactions by emoji
    const reactionGroups = {};

    reactions.forEach(reaction => {
      if (!reactionGroups[reaction.emoji]) {
        reactionGroups[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          userReacted: false,
          users: []
        };
      }

      reactionGroups[reaction.emoji].count++;
      reactionGroups[reaction.emoji].users.push({
        id: reaction['User.id'],
        name: reaction['User.name']
      });

      if (reaction.user_id === currentUserId) {
        reactionGroups[reaction.emoji].userReacted = true;
      }
    });

    // Convert to array and sort by first occurrence
    return Object.values(reactionGroups).map(group => ({
      emoji: group.emoji,
      count: group.count,
      userReacted: group.userReacted,
      users: group.users // Useful for showing who reacted
    }));

  } catch (error) {
    console.error('Error getting reaction counts:', error);
    return [];
  }
}

async function updateUserSetting(req, res, settingField, bodyField = null) {
  const userId = req.session.userId;
  const requestField = bodyField || settingField;
  const settingValue = req.body[requestField];

  if (typeof settingValue === 'undefined') {
    return res.status(400).json({
      success: false,
      message: `Missing parameter: ${requestField}`
    });
  }

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const [setting, created] = await UserSettings.findOrCreate({
      where: { user_id: userId },
      defaults: { [settingField]: settingValue }
    });

    if (!created) {
      setting[settingField] = settingValue;
      await setting.save();
    }

    // Special handling for auto-backup disable
    if (settingField === 'auto_chat_backup' && settingValue === false) {
      const deleted = await GoogleToken.destroy({
        where: { user_id: userId }
      });
      console.log(`GoogleToken deleted for user ${userId}: ${deleted}`);
    }

    res.json({ success: true, [requestField]: settingValue });
  } catch (err) {
    console.error(`Update ${settingField} error:`, err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Utills Function

function timeSince(date) {
  if (!date) return '';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  for (let [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
  }
  return 'Just now';
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return `${secs} sec`;
  } else if (secs === 0) {
    return `${mins} min`;
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')} min`;
  }
}

function getFileTypeFromMime(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'document';
  if (mimetype.includes('document') || mimetype.includes('text') ||
    mimetype.includes('sheet') || mimetype.includes('presentation')) return 'document';
  return 'file';
}

function getDefaultContentForFileType(fileType) {
  const defaults = {
    'image': '📷 Photo',
    'video': '🎥 Video',
    'audio': '🎤 Voice message',
    'document': '📄 Document',
    'file': '📎 File'
  };
  return defaults[fileType] || '📎 File';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function groupMessagesBySender(messages, currentUser) {
  if (!messages || messages.length === 0) {
    return [];
  }

  const grouped = [];
  let currentGroup = null;

  messages.forEach((message, index) => {
    const isCurrentUser = message.sender_id === currentUser.id;
    const messageClass = isCurrentUser ? 'replies' : 'sent';

    const shouldStartNewGroup = !currentGroup ||
      currentGroup.sender_id !== message.sender_id ||
      (currentGroup.sender_id === message.sender_id && isMessageTimeGapLarge(currentGroup.lastMessageTime, message.created_at));

    if (shouldStartNewGroup) {
      if (currentGroup) {
        grouped.push(currentGroup);
      }
      currentGroup = {
        sender_id: message.sender_id,
        sender: {
          id: message.sender.id,
          name: message.sender.name,
          avatar: message.sender.avatar
        },
        messageClass: messageClass,
        messages: [formatMessageForDisplay(message)],
        created_at: message.created_at,
        lastMessageTime: message.created_at,
        groupId: `group_${message.sender_id}_${Date.now()}_${index}`
      };
    } else {
      // Add to existing group (only happens if same sender + within time limit)
      if (currentGroup && currentGroup.sender_id === message.sender_id) {
        currentGroup.messages.push(formatMessageForDisplay(message));
        currentGroup.lastMessageTime = message.created_at;
      }
    }

    // Add the last group
    if (index === messages.length - 1 && currentGroup) {
      grouped.push(currentGroup);
    }
  });

  return grouped;
}

function groupMessagesByDate(messageGroups) {
  if (!messageGroups || messageGroups.length === 0) {
    return [];
  }

  const dateGroups = {};

  messageGroups.forEach(group => {
    const messageDate = new Date(group.created_at);
    const dateKey = getDateKey(messageDate);

    if (!dateGroups[dateKey]) {
      dateGroups[dateKey] = {
        dateLabel: formatDateLabel(messageDate),
        dateKey: dateKey,
        messageGroups: []
      };
    }

    dateGroups[dateKey].messageGroups.push(group);
  });

  // Sort by date
  return Object.values(dateGroups).sort((a, b) => {
    return new Date(a.dateKey) - new Date(b.dateKey);
  });
}

function getDateKey(date) {
  return date.toISOString().split('T')[0];
}

function formatDateLabel(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const messageDate = new Date(date);

  // Normalize dates to compare just the date part
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const msgDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

  if (msgDate.getTime() === todayDate.getTime()) {
    return 'Today';
  } else if (msgDate.getTime() === yesterdayDate.getTime()) {
    return 'Yesterday';
  } else {
    const daysDiff = Math.floor((todayDate - msgDate) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 6 && daysDiff > 1) {
      return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return messageDate.toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    }
  }
}

function formatMessageForDisplay(message) {
  return {
    id: message.id,
    content: message.content,
    message_type: message.message_type,
    file_url: message.file_url,
    created_at: message.created_at,
    recipient_id: message.recipient_id,
    statuses: message.statuses,
    metadata: message.metadata,
    reactions: message.reactions || [],
    repliedMessage: message.dataValues.repliedMessage || null
  };
}

function isMessageTimeGapLarge(earlierTime, laterTime, thresholdMinutes = 5) {
  if (!earlierTime || !laterTime) return true;

  const earlier = new Date(earlierTime);
  const later = new Date(laterTime);

  // Check for invalid dates
  if (isNaN(earlier.getTime()) || isNaN(later.getTime())) return true;

  const diffMinutes = (later - earlier) / (1000 * 60);
  return Math.abs(diffMinutes) > thresholdMinutes;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();

  return `${day}-${month}-${year}`
}

function formatTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12
  minutes = minutes < 10 ? '0' + minutes : minutes;

  return `${hours}:${minutes} ${ampm}`;
}

function formatDateForFilename(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}`;
}

function formatFilename(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
}

function parseJsonArray(input) {
  if (Array.isArray(input)) return input;
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = {
  getUserContacts,
  getFriendSuggestions,
  getFavoritesWithTargetData,
  fetchBlockedUsers,
  fetchArchivedChats,
  getUserDocuments,
  fetchRecentChats,
  fetchRecentCalls,
  getMessageReactionCounts,
  updateUserSetting,

  timeSince,
  formatDuration,
  getFileTypeFromMime,
  getDefaultContentForFileType,
  formatFileSize,
  groupMessagesBySender,
  groupMessagesByDate,
  formatDateLabel,
  formatDate,
  formatTime,
  formatDateForFilename,
  formatFilename,
  parseJsonArray
}
