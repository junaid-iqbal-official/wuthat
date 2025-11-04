'use strict';

module.exports = (sequelize, DataTypes) => {
  const GroupMember = sequelize.define(
    'GroupMember', 
    {
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'groups', key: 'id' },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      role: {
        type: DataTypes.ENUM('admin', 'member'),
        defaultValue: 'member'
      }
    },
    {
      tableName: 'group_members',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );

  GroupMember.associate = models => {
    GroupMember.belongsTo(models.Group, { foreignKey: 'group_id' });
    GroupMember.belongsTo(models.User, { foreignKey: 'user_id' });
  };

  return GroupMember;
};
