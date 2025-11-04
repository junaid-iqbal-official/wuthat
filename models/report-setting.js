'use strict';

module.exports = (sequelize, DataTypes) => {
  const ReportSetting = sequelize.define(
    'ReportSetting', 
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      }
    }, 
    {
      tableName: 'report_settings',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return ReportSetting;
};
  