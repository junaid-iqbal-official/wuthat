const { Message, Favorite, Archive, UserDelete, Block, Friend, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { getFavoritesWithTargetData,fetchBlockedUsers,fetchArchivedChats } = require('../../utils/helper-functions');

exports.getFavorites = async (req, res) => {
    const currentUserId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
  
    try {
      const { count, favorites } = await getFavoritesWithTargetData(currentUserId);
  
      // Pagination
      const offset = (page - 1) * limit;
      const paginatedFavorites = favorites.slice(offset, offset + limit);
  
      res.json({
        success: true,
        favorites: paginatedFavorites,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(favorites.length / limit),
          totalCount: count,
          hasMore: (page * limit) < favorites.length
        }
      });
  
    } catch (error) {
      console.error('Error in getFavorites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to load favorites'
      });
    }
};
  
exports.toggleFavorite = async (req, res) => {
    const currentUserId = req.session.userId;
    const { targetId, targetType } = req.body;

    try {
        // Validate input
        if (!targetId || !targetType || !['user', 'group'].includes(targetType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid target ID or type'
            });
        }

        // Check if already favorited
        const existingFavorite = await Favorite.findOne({
            where: {
                user_id: currentUserId,
                target_id: targetId,
                target_type: targetType
            }
        });

        let isFavorite = false;

        if (existingFavorite) {
            // Remove from favorites
            await existingFavorite.destroy();
            isFavorite = false;
        } else {
            // Add to favorites
            await Favorite.create({
                user_id: currentUserId,
                target_id: targetId,
                target_type: targetType
            });
            isFavorite = true;
        }

        res.json({
            success: true,
            isFavorite,
            message: isFavorite ? 'Added to favorites' : 'Removed from favorites'
        });

    } catch (error) {
        console.error('Error in toggleFavorite:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle favorite'
        });
    }
};

exports.toggleArchive = async (req, res) => {
    const userId = req.session.userId;
    const { targetId, targetType = 'user' } = req.body;

    if (!targetId) {
        return res.status(400).json({ error: 'Target ID is required' });
    }

    try {
        // Check if already archived
        const existingArchive = await Archive.findOne({
            where: {
                user_id: userId,
                target_id: targetId,
                target_type: targetType
            }
        });

        if (existingArchive) {
            // Remove from archive
            await existingArchive.destroy();
            return res.json({
                success: true,
                action: 'unarchived',
                message: 'Chat restored from archive'
            });
        } else {
            // Add to archive
            await Archive.create({
                user_id: userId,
                target_id: targetId,
                target_type: targetType
            });
            return res.json({
                success: true,
                action: 'archived',
                message: 'Chat archived'
            });
        }
    } catch (error) {
        console.error('Error toggling archive:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteChat = async (req, res) => {
    const userId = req.session.userId;
    const { targetId, targetType = 'user', deleteType = 'hide_chat' } = req.body;

    if (!targetId) {
        return res.status(400).json({ error: 'Target ID is required' });
    }

    try {
        // Check if already deleted
        const existingDelete = await UserDelete.findOne({
            where: {
                user_id: userId,
                target_id: targetId,
                target_type: targetType
            }
        });

        if (existingDelete) {
            return res.json({
                success: true,
                message: 'Chat already deleted'
            });
        }

        // Mark as deleted for this user
        await UserDelete.create({
            user_id: userId,
            target_id: targetId,
            target_type: targetType,
            delete_type: deleteType
        });

        // Convert IDs to numbers for consistency
        const currentUserId = parseInt(userId);
        const otherUserId = parseInt(targetId);

        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { sender_id: currentUserId, recipient_id: otherUserId },
                    { sender_id: otherUserId, recipient_id: currentUserId }
                ]
            }
        });

        let updatedCount = 0;

        for (const message of messages) {
            let clearChatBy = message.clear_chat_by || [];

            // If it's a string, parse it as JSON
            if (typeof clearChatBy === 'string') {
                try {
                    clearChatBy = JSON.parse(clearChatBy);
                } catch (e) {
                    clearChatBy = [];
                }
            }

            // Ensure it's an array
            if (!Array.isArray(clearChatBy)) {
                clearChatBy = [];
            }

            // If current user hasn't cleared this message yet, add them
            if (!clearChatBy.includes(currentUserId)) {
                clearChatBy.push(currentUserId);

                // Use JSON.stringify to ensure proper JSON format
                await message.update(
                    { clear_chat_by: JSON.stringify(clearChatBy) }
                );

                updatedCount++;
            }
        }

        return res.json({
            success: true,
            message: 'Chat deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting chat:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.toggleBlock = async (req, res) => {
    const userId = req.session.userId;
    const { targetId, reason = null } = req.body;

    if (!targetId) {
        return res.status(400).json({ error: 'User ID to block is required' });
    }

    if (userId === parseInt(targetId)) {
        return res.status(400).json({ error: 'You cannot block yourself' });
    }

    try {
        // Check if already blocked
        const existingBlock = await Block.findOne({
            where: {
                blocker_id: userId,
                blocked_id: targetId
            }
        });

        if (existingBlock) {
            // Unblock user
            await existingBlock.destroy();
            return res.json({
                success: true,
                action: 'unblocked',
                message: 'User unblocked successfully'
            });
        } else {
            // Block user
            await Block.create({
                blocker_id: userId,
                blocked_id: targetId,
                reason: reason
            });
            return res.json({
                success: true,
                action: 'blocked',
                message: 'User blocked successfully'
            });
        }
    } catch (error) {
        console.error('Error toggling block:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.getChatStatus = async (req, res) => {
    const userId = req.session.userId;
    const { targetId, targetType = 'user' } = req.params;

    try {
        const [favorite, archive, block, userDelete] = await Promise.all([
            Favorite.findOne({
                where: { user_id: userId, target_id: targetId, target_type: targetType }
            }),
            Archive.findOne({
                where: { user_id: userId, target_id: targetId, target_type: targetType }
            }),
            targetType === 'user' ? Block.findOne({
                where: { blocker_id: userId, blocked_id: targetId }
            }) : null,
            UserDelete.findOne({
                where: { user_id: userId, target_id: targetId, target_type: targetType }
            })
        ]);

        return res.json({
            success: true,
            status: {
                isFavorited: !!favorite,
                isArchived: !!archive,
                isBlocked: !!block,
                isDeleted: !!userDelete,
                favoriteId: favorite?.id,
                archiveId: archive?.id,
                blockId: block?.id,
                deleteId: userDelete?.id
            }
        });
    } catch (error) {
        console.error('Error getting chat status:', error);
        return res.status(500).json({ error: 'Server error' });
    }
};

exports.getBlockedUsers = async (req, res) => {
    const currentUserId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    try {
        const { blockedUsers, count } = await fetchBlockedUsers(currentUserId, { page, limit });

        res.json({
            success: true,
            blocked: blockedUsers,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                totalCount: count,
                hasMore: (page * limit) < count
            }
        });

    } catch (error) {
        console.error('Error fetching blocked users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load blocked users'
        });
    }
};

exports.unblockUser = async (req, res) => {
    const currentUserId = req.session.userId;
    const { userId } = req.body;

    try {
        // Find and delete the block record
        const blockRecord = await Block.findOne({
            where: {
                blocker_id: currentUserId,
                blocked_id: userId
            }
        });

        if (!blockRecord) {
            return res.status(404).json({
                success: false,
                message: 'Block record not found'
            });
        }

        await blockRecord.destroy();

        res.json({
            success: true,
            message: 'User unblocked successfully'
        });

    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unblock user'
        });
    }
};

exports.getArchivedChats = async (req, res) => {
    const currentUserId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    try {

        const { archivedChats, pagination } = await fetchArchivedChats(currentUserId, { page, limit });

        res.json({
            success: true,
            archived: archivedChats,
            pagination
        });

    } catch (error) {
        console.error('Error fetching archived chats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load archived chats'
        });
    }
};

exports.unarchiveChat = async (req, res) => {
    const currentUserId = req.session.userId;
    const { targetId, targetType } = req.body;

    try {
        // Find and delete the archive record
        const archiveRecord = await Archive.findOne({
            where: {
                user_id: currentUserId,
                target_id: targetId,
                target_type: targetType
            }
        });

        if (!archiveRecord) {
            return res.status(404).json({
                success: false,
                message: 'Archive record not found'
            });
        }

        await archiveRecord.destroy();

        res.json({
            success: true,
            message: 'Chat unarchived successfully'
        });

    } catch (error) {
        console.error('Error unarchiving chat:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to unarchive chat'
        });
    }
};

exports.searchFavorites = async (req, res) => {
    try {
      const userId = req.session.userId;
      const search = req.query.search?.toLowerCase() || '';
  
      const { favorites } = await getFavoritesWithTargetData(userId);
  
      const filteredFavorites = favorites.filter(fav => {
        if (fav.target_type === 'user') {
          const { name, email } = fav.user;
          return (
            name?.toLowerCase().includes(search) ||
            email?.toLowerCase().includes(search)
          );
        } else if (fav.target_type === 'group') {
          const { name, description } = fav.group;
          return (
            name?.toLowerCase().includes(search) ||
            (description && description.toLowerCase().includes(search))
          );
        }
        return false;
      });
  
      res.json(filteredFavorites);
  
    } catch (err) {
      console.error('Favorite search error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
};

exports.searchBlockContact = async (req, res) => {
    const userId = req.session.userId;
    const search = req.query.search?.toLowerCase() || '';

    try {
        const { blockedUsers } = await fetchBlockedUsers(userId);

        const filtered = blockedUsers.filter(b => {
            const name = b.blocked_user.name?.toLowerCase() || '';
            const email = b.blocked_user.email?.toLowerCase() || '';
            return name.includes(search) || email.includes(search);
        });

        res.json(filtered);

    } catch (error) {
        console.error('Blocked Contacts search error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.searchArchiveChat = async (req, res) => {
    const userId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search?.toLowerCase() || '';

    try {
        
        const { archivedChats } = await fetchArchivedChats(userId, { page, limit, search });

        // Filter by search string
        const filtered = archivedChats.filter(chat => {
            const name = chat.target?.name?.toLowerCase() || '';
            const email = chat.target?.email?.toLowerCase() || '';
            return name.includes(search) || email.includes(search);
        });

        res.json(filtered);

    } catch (error) {
        console.error('Archive Chat search error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.unfriend = async (req, res) => {
    const userId = req.session.userId;
    const { targetId, targetType } = req.body;

    try {
        // Validate input
        if (!targetId || !targetType) {
            return res.status(400).json({ 
                success: false, 
                message: 'Target ID and type are required' 
            });
        }

        if (targetType !== 'user') {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid target type. Only user unfriending is supported' 
            });
        }

        // Check if friendship exists
        const friendship = await Friend.findOne({
            where: {
                [Op.or]: [
                    { user_id: userId, friend_id: targetId },
                    { user_id: targetId, friend_id: userId }
                ],
                status: 'accepted'
            }
        });

        if (!friendship) {
            return res.status(404).json({ 
                success: false, 
                message: 'Friendship not found or already removed' 
            });
        }

        // Define common conditions
        const friendConditions = [
            { user_id: userId, friend_id: targetId },
            { user_id: targetId, friend_id: userId }
        ];
  
        const messageConditions = [
            { sender_id: userId, recipient_id: targetId },
            { sender_id: targetId, recipient_id: userId }
        ];
    
        const favoriteArchiveConditions = [
            { 
                user_id: userId, 
                target_id: targetId, 
                target_type: 'user' 
            },
            { 
                user_id: targetId, 
                target_id: userId, 
                target_type: 'user' 
            }
        ];
  
        const blockConditions = [
            { blocker_id: userId, blocked_id: targetId },
            { blocker_id: targetId, blocked_id: userId }
        ];
        // Use transaction to ensure data consistency
        await sequelize.transaction(async (transaction) => {
            
            // Execute all destruction operations in parallel
            await Promise.all([
                Friend.destroy({
                    where: { [Op.or]: friendConditions },
                    transaction
                }),
                Message.destroy({
                    where: { [Op.or]: messageConditions },
                    transaction
                }),
                Favorite.destroy({
                    where: { [Op.or]: favoriteArchiveConditions },
                    transaction
                }),
                Archive.destroy({
                    where: { [Op.or]: favoriteArchiveConditions },
                    transaction
                }),
                Block.destroy({
                    where: { [Op.or]: blockConditions },
                    transaction
                }),
            ]);
        });

        const io = req.app.get('io');
        
        io.to(`user_${targetId}`).emit('friend_removed', {userId,targetId});

        res.status(200).json({
            success: true,
            action: 'unfriend',
            message: 'Friend removed successfully'
        });

    } catch (error) {
        console.error('Error unfriending user:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};