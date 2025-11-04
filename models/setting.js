'use strict';

module.exports = (sequelize, DataTypes) => {
  const Setting = sequelize.define(
    'Setting', 
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      label: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: true
      },
      category: {
        type: DataTypes.ENUM('general','email','frontend','media','user-control'),
        allowNull: true,
        defaultValue: 'general',
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      }
    }, 
    {
      tableName: 'settings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );

  return Setting;
};
  