const { User, Friend, Notification } = require('../../models');
const { Op } = require('sequelize');

exports.getFriendSuggestions = async (req, res) => {
    const currentUserId = req.session.userId;

    try {
        // Get all friend relationships for current user
        const friendships = await Friend.findAll({
            where: {
                [Op.or]: [
                    { user_id: currentUserId },
                    { friend_id: currentUserId }
                ]
            },
            attributes: ['user_id', 'friend_id']
        });

        // Extract friend IDs
        const friendIds = new Set();
        friendships.forEach(friendship => {
            if (friendship.user_id === currentUserId) {
                friendIds.add(friendship.friend_id);
            } else {
                friendIds.add(friendship.user_id);
            }
        });

        // Add current user ID to exclude from suggestions
        friendIds.add(currentUserId);

        // Get users who are not friends
        const suggestions = await User.findAll({
            where: {
                id: { [Op.notIn]: Array.from(friendIds) },
                role: 'user',
                status: 'active'
            },
            order: [['name', 'ASC']],
            limit: 20
        });

        res.json({
            success: true,
            suggestions
        });

    } catch (error) {
        console.error('Error getting friend suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load friend suggestions'
        });
    }
};

exports.sendFriendRequest = async (req, res) => {
    const currentUserId = req.session.userId;
    const { friendId } = req.body;

    try {
        // Check if friendship already exists
        const existingFriendship = await Friend.findOne({
            where: {
                [Op.or]: [
                    { user_id: currentUserId, friend_id: friendId },
                    { user_id: friendId, friend_id: currentUserId }
                ]
            }
        });

        if (existingFriendship) {
            return res.json({
                success: false,
                message: 'Friend request already exists or you are already friends'
            });
        }

        // Create friend request
        await Friend.create({
            user_id: currentUserId,
            friend_id: friendId,
            status: 'pending',
            requested_by: currentUserId
        });

        // Get current user info for notification
        const currentUser = await User.findByPk(currentUserId, {
            attributes: ['name', 'avatar']
        });

        // Create notification for the recipient
        const notification = await Notification.create({
            user_id: friendId,
            from_user_id: currentUserId,
            type: 'friend_request',
            title: 'New Friend Request',
            message: `${currentUser.name} sent you a friend request`,
            data: {
                friend_id: currentUserId,
                friend_name: currentUser.name,
                friend_avatar: currentUser.avatar
            }
        });

        // Emit via Socket.IO
        const io = req.app.get('io');

        // Send real-time notification via Socket.IO
        if (io) {
            io.to(`user_${friendId}`).emit('newNotification', {
                id: notification.id,
                type: 'friend_request',
                title: notification.title,
                message: notification.message,
                from_user: {
                    id: currentUserId,
                    name: currentUser.name,
                    avatar: currentUser.avatar
                },
                data: {
                    friend_id: currentUserId,
                    friend_name: currentUser.name,
                    friend_avatar: currentUser.avatar
                },
                created_at: notification.created_at
            });
        }

        res.json({
            success: true,
            message: 'Friend request sent successfully'
        });

    } catch (error) {
        console.error('Error sending friend request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send friend request'
        });
    }
};

exports.respondToFriendRequest = async (req, res) => {
    const currentUserId = req.session.userId;
    const { requestId, action } = req.body; // action: 'accept' or 'reject'

    try {
        const friendRequest = await Friend.findOne({
            where: {
                requested_by: requestId,
                friend_id: currentUserId,
                status: 'pending'
            },
            include: [
                {
                    model: User,
                    as: 'requested',
                    attributes: ['id', 'name', 'avatar']
                }
            ]
        });

        if (!friendRequest) {
            return res.json({
                success: false,
                message: 'Friend request not found'
            });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'rejected';

        // Update friend request status
        await friendRequest.update({ status: newStatus });

        // If rejected, update the notification for current user (User A)
        if (action === 'reject') {
            await Notification.update(
                {
                    type: 'friend_rejected',
                    title: 'You rejected a friend request',
                    message: `You rejected ${friendRequest.requested.name}'s friend request.`,
                    is_read: true,
                    read_at: new Date()
                },
                {
                    where: {
                        user_id: currentUserId,
                        from_user_id: friendRequest.user_id,
                        type: 'friend_request'
                    }
                }
            );
        }

        // If accepted, create reverse friendship for bidirectional relationship
        if (action === 'accept') {
            await Friend.create({
                user_id: currentUserId,
                friend_id: friendRequest.user_id,
                status: 'accepted',
                requested_by: friendRequest.user_id
            });
        }

        // Get current user info
        const currentUser = await User.findByPk(currentUserId, {
            attributes: ['name', 'avatar']
        });

        // Create notification for the requester
        const notificationType = action === 'accept' ? 'friend_accepted' : 'friend_rejected';
        const notificationMessage = action === 'accept'
            ? `${currentUser.name} accepted your friend request`
            : `${currentUser.name} rejected your friend request`;

        const notification = await Notification.create({
            user_id: friendRequest.user_id,
            from_user_id: currentUserId,
            type: notificationType,
            title: action === 'accept' ? 'Friend Request Accepted' : 'Friend Request Rejected',
            message: notificationMessage,
            data: {
                friend_id: currentUserId,
                friend_name: currentUser.name,
                friend_avatar: currentUser.avatar
            }
        });

        // Emit via Socket.IO
        const io = req.app.get('io');

        // Send real-time notification
        if (io) {
            io.to(`user_${friendRequest.user_id}`).emit('newNotification', {
                id: notification.id,
                type: notificationType,
                title: notification.title,
                message: notification.message,
                from_user: {
                    id: currentUserId,
                    name: currentUser.name,
                    avatar: currentUser.avatar
                },
                data: {
                    friend_id: currentUserId,
                    friend_name: currentUser.name,
                    friend_avatar: currentUser.avatar
                },
                created_at: notification.created_at
            });

            // If accepted, update both users' friend lists
            if (action === 'accept') {
                io.to(`user_${friendRequest.user_id}`).emit('friendListUpdated');
                io.to(`user_${currentUserId}`).emit('friendListUpdated');
            }
        }

        res.json({
            success: true,
            message: `Friend request ${action}ed successfully`
        });

    } catch (error) {
        console.error('Error responding to friend request:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to respond to friend request'
        });
    }
};

exports.getFriends = async (req, res) => {
    const currentUserId = req.session.userId;

    try {
        const friends = await Friend.findAll({
            where: {
                [Op.or]: [
                    { user_id: currentUserId, status: 'accepted' },
                    { friend_id: currentUserId, status: 'accepted' }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen']
                },
                {
                    model: User,
                    as: 'friend',
                    attributes: ['id', 'name', 'avatar', 'email', 'is_online', 'last_seen']
                }
            ]
        });

        // Extract friend data
        const friendList = friends.map(friendship => {
            const friend = friendship.user_id === currentUserId
                ? friendship.Friend
                : friendship.User;

            return {
                id: friend.id,
                name: friend.name,
                avatar: friend.avatar,
                email: friend.email,
                is_online: friend.is_online,
                last_seen: friend.last_seen
            };
        });

        res.json({
            success: true,
            friends: friendList
        });

    } catch (error) {
        console.error('Error getting friends:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load friends'
        });
    }
};

exports.getPendingRequests = async (req, res) => {
    const currentUserId = req.session.userId;

    try {
        const pendingRequests = await Friend.findAll({
            where: {
                friend_id: currentUserId,
                status: 'pending'
            },
            include: [
                {
                    model: User,
                    as: 'requested',
                    attributes: ['id', 'name', 'avatar', 'email']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            requests: pendingRequests
        });

    } catch (error) {
        console.error('Error getting pending requests:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load pending requests'
        });
    }
};

exports.searchFriendSuggestions = async (req, res) => {
    try {
      const userId = req.session.userId;
      const search = req.query.search?.toLowerCase() || '';
      const suggestions = await User.getFriendSuggestions(userId);
      
      const filtered = suggestions.filter(user =>
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        user.username.toLowerCase().includes(search)||
        user.phone.includes(search)
      );
  
      res.json(filtered);
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
};