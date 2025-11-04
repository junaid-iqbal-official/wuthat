const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const db = {};

let sequelize = null;
let config = null;

// Load and validate config
try {
  config = require(__dirname + '/../config/config.js')[env];

  if (!config || !config.database || !config.username) {
    console.warn('⚠️ Invalid or missing database configuration');
    config = null;
  }
} catch (error) {
  console.warn('⚠️ Could not load config/config.js:', error.message);
}

// Initialize Sequelize only if config is valid
if (config) {
  try {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
    console.log('✅ Sequelize instance created');
  } catch (error) {
    console.warn('⚠️ Failed to create Sequelize instance:', error.message);
    sequelize = null;
  }
}

// Only load models if sequelize exists
if (sequelize) {
  const { DataTypes } = Sequelize;

  try {
    // Import Models
    db.User = require('./user')(sequelize, DataTypes);
    db.OTPLog = require('./otpLog')(sequelize, DataTypes);
    db.Message = require('./message')(sequelize, DataTypes);
    db.Group = require('./group')(sequelize, DataTypes);
    db.GroupMember = require('./group-member')(sequelize, DataTypes);
    db.PinnedConversation = require('./pinned-conversation')(sequelize, DataTypes);
    db.MessageStatus = require('./message-status')(sequelize, DataTypes);
    db.Setting = require('./setting')(sequelize, DataTypes);
    db.Faq = require('./faq')(sequelize, DataTypes);
    db.PageContent = require('./page-content')(sequelize, DataTypes);
    db.ChatWallpaper = require('./chat-wallpaper')(sequelize, DataTypes);
    db.ReportContact = require('./report-contact')(sequelize, DataTypes);
    db.UserSettings = require('./user-settings')(sequelize, DataTypes);
    db.Friend = require('./friend')(sequelize, DataTypes);
    db.GoogleToken = require('./google-token')(sequelize, DataTypes);
    db.Sticker = require('./sticker')(sequelize, DataTypes);
    db.ContactUs = require('./contact-us')(sequelize, DataTypes);
    db.ReportSetting = require('./report-setting')(sequelize, DataTypes);

    // Load all models dynamically
    fs.readdirSync(__dirname)
      .filter(file => {
        return (
          file.indexOf('.') !== 0 &&
          file !== basename &&
          file.slice(-3) === '.js' &&
          file.indexOf('.test.js') === -1
        );
      })
      .forEach(file => {
        try {
          const model = require(path.join(__dirname, file))(sequelize, DataTypes);
          db[model.name] = model;
        } catch (error) {
          console.error(`Failed to load model ${file}:`, error.message);
        }
      });

    // Setup associations
    Object.keys(db).forEach(modelName => {
      if (db[modelName].associate) {
        try {
          db[modelName].associate(db);
        } catch (error) {
          console.error(`Failed to associate ${modelName}:`, error.message);
        }
      }
    });

    console.log('✅ All models loaded successfully');
  } catch (error) {
    console.error('❌ Error loading models:', error.message);
  }
} else {
  console.warn('⚠️ Running without database connection - models not loaded');
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;