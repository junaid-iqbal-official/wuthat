'use strict';

module.exports = (sequelize, DataTypes) => {
    const CountryCode = sequelize.define(
        'CountryCode',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            code: {
                type: DataTypes.STRING(10),
                allowNull: false,
            },
            country: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            flag: {
                type: DataTypes.STRING(10),
                allowNull: true,
            },
        },
        {
            tableName: 'country_codes',
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at',
            indexes: [
                {
                    name: 'idx_code',
                    fields: ['code'],
                },
                {
                    name: 'idx_country',
                    fields: ['country'],
                },
            ],
        }
    );

    return CountryCode;
};
