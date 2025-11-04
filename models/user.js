'use strict';

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country_code: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('admin', 'user'),
        defaultValue: 'user',
      },
      email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      last_login: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_online: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      last_seen: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('active', 'deactive'),
        defaultValue: 'active',
      },
      report_count: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      bio:{
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue:"Hey! I'm using chat app."
      },
    },
    {
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
    }
  );

  User.associate = (models) => {

    User.belongsToMany(models.Group, {
      through: models.GroupMember,
      foreignKey: 'user_id',
      otherKey: 'group_id',
    });

    User.hasMany(models.MessageStatus, {
      foreignKey: 'user_id'
    });

    // Friend associations
    User.hasMany(models.Friend, {
      as: 'friend_requests',
      foreignKey: 'user_id'
    });

    User.hasMany(models.Friend, {
      as: 'received_friend_requests',
      foreignKey: 'friend_id'
    });

    User.hasMany(models.Friend, {
      as: 'sent_friend_requests',
      foreignKey: 'requested_by'
    });

    // Notification associations
    User.hasMany(models.Notification, {
      as: 'notifications',
      foreignKey: 'user_id'
    });

    User.hasMany(models.Notification, {
      as: 'sent_notifications',
      foreignKey: 'from_user_id'
    });
  };

  User.prototype.isFriendWith = async function (userId) {
    const { Friend } = sequelize.models;
    const { Op } = require('sequelize');

    const friendship = await Friend.findOne({
      where: {
        [Op.or]: [
          { user_id: this.id, friend_id: userId, status: 'accepted' },
          { user_id: userId, friend_id: this.id, status: 'accepted' }
        ]
      }
    });

    return !!friendship;
  };

  User.prototype.hasPendingRequestFrom = async function (userId) {
    const { Friend } = sequelize.models;

    const request = await Friend.findOne({
      where: {
        user_id: userId,
        friend_id: this.id,
        status: 'pending'
      }
    });

    return !!request;
  };

  User.prototype.hasSentRequestTo = async function (userId) {
    const { Friend } = sequelize.models;

    const request = await Friend.findOne({
      where: {
        user_id: this.id,
        friend_id: userId,
        status: 'pending'
      }
    });

    return !!request;
  };

  User.prototype.getUnreadNotificationCount = async function () {
    const { Notification } = sequelize.models;

    const count = await Notification.count({
      where: {
        user_id: this.id,
        is_read: false
      }
    });

    return count;
  };

  User.prototype.markAllNotificationsAsRead = async function () {
    const { Notification } = sequelize.models;

    await Notification.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          user_id: this.id,
          is_read: false
        }
      }
    );
  };

  // Static methods
  User.getFriendSuggestions = async function (userId, limit = 20) {
    const { Op } = require('sequelize');
    const { Friend } = sequelize.models;

    // Get all friend relationships for current user
    const friendships = await Friend.findAll({
      where: {
        [Op.or]: [
          { user_id: userId },
          { friend_id: userId }
        ]
      },
      attributes: ['user_id', 'friend_id']
    });

    // Extract friend IDs
    const friendIds = new Set();
    friendships.forEach(friendship => {
      if (friendship.user_id === userId) {
        friendIds.add(friendship.friend_id);
      } else {
        friendIds.add(friendship.user_id);
      }
    });

    // Add current user ID to exclude from suggestions
    friendIds.add(userId);

    // Get users who are not friends
    const suggestions = await User.findAll({
      where: {
        id: { [Op.notIn]: Array.from(friendIds) },
        role: 'user',
        status: 'active'
      },
      attributes: ['id', 'name', 'avatar','bio', 'username', 'phone', 'email', 'is_online'],
      order: [['name', 'ASC']],
      limit: limit
    });

    return suggestions;
  };

  return User;
};