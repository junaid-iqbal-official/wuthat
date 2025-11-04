'use strict';
const cron = require('node-cron');
const fs = require('fs');
const { UserSettings, GoogleToken } = require('../models');
const { exportMessagesToTxtZip } = require('../services/backupService');
const { uploadFileToDrive } = require('../services/driveService');

function start() {
  cron.schedule('0 2 * * *', async () => { // runs every 2 A.M

    try {
      // Get only users who have connected their Google Drive
      const tokens = await GoogleToken.findAll({ attributes: ['user_id'] });

      for (const token of tokens) {
        const userId = token.user_id;

        //  Double-check that auto-backup is still ON for this user
        const setting = await UserSettings.findOne({
          where: { user_id: userId },
          attributes: ['auto_chat_backup']
        });

        if (!setting || !setting.auto_chat_backup) {
          console.log(`Skipping user ${userId}: auto backup is off`);
          continue;
        }

        try {
          const filePath = await exportMessagesToTxtZip(userId);
        
          // Check file exists and size > 0
          const exists = fs.existsSync(filePath);
          const stats = exists ? fs.statSync(filePath) : null;
        
          if (!exists || stats.size === 0) {
            console.error(` ZIP file for user ${userId} is invalid or empty`);
            continue;
          }
        
          await uploadFileToDrive(userId, filePath);
          console.log(`✅ Backup complete for user ${userId}`);
        
          fs.unlinkSync(filePath); // Only delete AFTER successful upload
        } catch (err) {
          console.error(` Backup failed for user ${userId}:`, err.message);
        }
        
      }
    } catch (err) {
      console.error('Cron job failed:', err.message);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });
}

module.exports = { start };
