'use strict';

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    'Message',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      sender_id: { 
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      parent_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: { model: 'messages', key: 'id' },
        onDelete: 'CASCADE',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      message_type: {
        type: DataTypes.ENUM('text', 'image','sticker', 'file', 'video', 'poll', 'form', 'system', 'call', 'document', 'audio'),
        defaultValue: 'text',
      },
      file_url: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      file_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      clear_chat_by: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      // Flexible field for polls, form schema, etc.
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: 'messages',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      paranoid: true,
      deletedAt: 'deleted_at',
      indexes: [
        {
          name: 'idx_group_created_at',
          fields: ['group_id', 'created_at'],
        },
        {
          name: 'idx_recipient_created_at',
          fields: ['recipient_id', 'created_at'],
        },
        {
          name: 'idx_parent_id',
          fields: ['parent_id'],
        },
        {
          name: 'idx_sender_id',
          fields: ['sender_id'],
        },
        {
          name: 'idx_message_type',
          fields: ['message_type'],
        },
      ],
    }
  );

  Message.associate = (models) => {
    Message.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
    Message.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
    Message.belongsTo(models.User, { foreignKey: 'recipient_id', as: 'recipient' });
    Message.belongsTo(models.Message, { foreignKey: 'parent_id', as: 'parent' });
    Message.hasMany(models.MessageStatus, { foreignKey: 'message_id', as: 'statuses' });
    Message.hasMany(models.MessageReaction, { foreignKey: 'message_id', as: 'reactions', onDelete: 'CASCADE' });
  };

  return Message;
};
