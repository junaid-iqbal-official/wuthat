'use strict';

module.exports = (sequelize, DataTypes) => {
    const Block = sequelize.define(
        'Block',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            blocker_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            blocked_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            reason: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: 'blocks',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    name: 'idx_blocker_blocked',
                    fields: ['blocker_id', 'blocked_id'],
                    unique: true
                },
                {
                    name: 'idx_blocker_id',
                    fields: ['blocker_id'],
                },
                {
                    name: 'idx_blocked_id',
                    fields: ['blocked_id'],
                },
            ],
        }
    );

    Block.associate = (models) => {
        Block.belongsTo(models.User, { foreignKey: 'blocker_id', as: 'blocker' });
        Block.belongsTo(models.User, { foreignKey: 'blocked_id', as: 'blocked' });
    };

    return Block;
};