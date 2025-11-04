'use strict';

module.exports = (sequelize, DataTypes) => {
    const UserSetting = sequelize.define("UserSetting", {
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        last_seen: {
            type: DataTypes.ENUM("Everybody", "Nobody", "My contacts"),
            defaultValue: "Everybody",
        },
        profile_pic: {
            type: DataTypes.ENUM("Everybody", "Nobody", "My contacts"),
            defaultValue: "Everybody",
        },
        call_me: {
            type: DataTypes.ENUM("Everybody", "Nobody", "My contacts"),
            defaultValue: "Everybody",
        },
        send_msg: {
            type: DataTypes.ENUM("Everybody", "Nobody", "My contacts"),
            defaultValue: "Everybody",
        },
        read_receipt: {
            type: DataTypes.ENUM("Everybody", "Nobody", "My contacts"),
            defaultValue: "Everybody",
        },
        typing_indicator: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        delete_requested: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            allowNull: true,
            defaultValue: null,
        },
        chat_wallpaper: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'none'
        },
        theme_mode: {
            type: DataTypes.ENUM('light', 'dark'),
            defaultValue: null,
        },
        theme_layout: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'default'
        },
        theme_color: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '28, 157, 234'// default to original
        },
        theme_direction: {
            type: DataTypes.ENUM('ltr', 'rtl'),
            allowNull: false,
            defaultValue: 'ltr',
        },
        theme_sidebar: {
            type: DataTypes.ENUM('two-column','three-column'),
            allowNull: false,
            defaultValue: 'three-column',
        },
        auto_chat_backup: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        include_doc_backup: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        include_video_backup: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {
                color_class: "lc-light-blue"
            }
        },
    },
    {
        tableName: 'user_settings',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['user_id']
            }
        ]
    }
    );

    UserSetting.associate = (models) => {
        UserSetting.belongsTo(models.User, {
            as: 'User',
            foreignKey: 'user_id'
        });
    };
  
    return UserSetting;
  };
  