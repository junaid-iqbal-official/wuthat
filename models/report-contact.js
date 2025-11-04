'use strict';

module.exports = (sequelize, DataTypes) => {
  const Report = sequelize.define(
    'Report', 
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      reporter_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      reported_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      report_type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM('pending', 'under_review', 'resolved', 'dismissed'),
        defaultValue: 'pending'
      },
      admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      resolved_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true
      }
    }, 
    {
      tableName: 'reports',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true,
      indexes: [
        {
          fields: ['reporter_id']
        },
        {
          fields: ['reported_user_id']
        },
        {
          fields: ['status']
        },
        {
          fields: ['report_type']
        }
      ]
    }
  );

  Report.associate = (models) => {
    Report.belongsTo(models.User, { foreignKey: 'reporter_id', as: 'reporter' });
    Report.belongsTo(models.User, { foreignKey: 'reported_user_id', as: 'reported_user' });
    Report.belongsTo(models.User, { foreignKey: 'resolved_by', as: 'resolver' });
  };

  return Report;
};