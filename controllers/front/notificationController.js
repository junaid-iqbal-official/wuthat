const { Notification, User } = require('../../models');

// Get notifications for current user
exports.getNotifications = async (req, res) => {
    const currentUserId = req.session.userId;
    const { page = 1, limit = 20 } = req.query;

    try {
        const offset = (page - 1) * limit;

        const { count, rows: notifications } = await Notification.findAndCountAll({
            where: {
                user_id: currentUserId,
            },
            include: [
                {
                    model: User,
                    as: 'from_user',
                    attributes: ['id', 'name', 'avatar'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Load current user instance (needed for isFriendWith)
        const currentUser = await User.findByPk(currentUserId);

        // Add isFriend flag for each notification sender
        const enrichedNotifications = await Promise.all(
            notifications.map(async (notif) => {
                if (notif.from_user) {
                    const isFriend = await currentUser.isFriendWith(notif.from_user.id);
                    return {
                        ...notif.toJSON(),
                        from_user: {
                            ...notif.from_user.toJSON(),
                            is_friend: isFriend
                        }
                    };
                }
                return notif.toJSON();
            })
        );

        const totalPages = Math.ceil(count / limit);
        const hasMore = page < totalPages;

        res.json({
            success: true,
            notifications: enrichedNotifications.filter(n => n.from_user?.is_friend === false),
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount: count,
                hasMore
            }
        });

    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load notifications'
        });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    const currentUserId = req.session.userId;
    const { notificationId } = req.params;

    try {
        const notification = await Notification.findOne({
            where: {
                id: notificationId,
                user_id: currentUserId
            }
        });

        if (!notification) {
            return res.json({
                success: false,
                message: 'Notification not found'
            });
        }

        await notification.update({
            is_read: true,
            read_at: new Date()
        });

        res.json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read'
        });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    const currentUserId = req.session.userId;

    try {
        await Notification.update(
            {
                is_read: true,
                read_at: new Date()
            },
            {
                where: {
                    user_id: currentUserId,
                    is_read: false
                }
            }
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });

    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notifications as read'
        });
    }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
    const currentUserId = req.session.userId;

    try {
        const count = await Notification.count({
            where: {
                user_id: currentUserId,
                is_read: false
            }
        });

        res.json({
            success: true,
            count
        });

    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            count: 0
        });
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    const currentUserId = req.session.userId;
    const { notificationId } = req.params;

    try {
        const result = await Notification.destroy({
            where: {
                id: notificationId,
                user_id: currentUserId
            }
        });

        if (result === 0) {
            return res.json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted'
        });

    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification'
        });
    }
};