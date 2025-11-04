'use strict';
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { Message, User, UserSettings } = require('../models');
const { Op } = require('sequelize');

async function exportMessagesToTxtZip(userId) {
  // 1. Fetch user settings
  const settings = await UserSettings.findOne({ where: { user_id: userId } });
  const includeDocs = settings?.include_doc_backup;
  const includeVideos = settings?.include_video_backup;

  // 2. Fetch all messages
  const messages = await Message.findAll({
    where: {
      [Op.or]: [{ sender_id: userId }, { recipient_id: userId }],
      content: { [Op.ne]: null },
      clear_chat_by: { [Op.eq]: null },
    },
    include: [
      {
        model: User,
        as: 'sender',
        attributes: ['id', 'name']
      },
    ],
    order: [['created_at', 'ASC']]
  });

  // 3. Split messages by type
  const textMessages = [];
  const docMessages = [];
  const videoMessages = [];

  for (const msg of messages) {
    if (msg.message_type === 'text') {
      const date = new Date(msg.created_at);
      const formattedDate = date.toLocaleDateString('en-GB');
      const formattedTime = date.toTimeString().slice(0, 5);
      const senderName = msg.sender?.name || 'Unknown';
      const line = `${formattedDate.replace(/\//g, '-')} , ${formattedTime} - ${senderName}: ${msg.content}`;
      textMessages.push(line);
    } else if (
      includeDocs &&
      msg.message_type === 'document' &&
      msg.file_url
    ) {
      docMessages.push(msg);
    } else if (
      includeVideos &&
      msg.message_type === 'video' &&
      msg.file_url
    ) {
      videoMessages.push(msg);
    }
  }

  // 4. Paths setup
  const backupDir = path.resolve(__dirname, '../public/uploads');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = Date.now();
  const txtFileName = `chat_backup_${userId}_${timestamp}.txt`;
  const zipFileName = `chat_backup_${userId}_${timestamp}.zip`;
  const txtFilePath = path.join(backupDir, txtFileName);
  const zipFilePath = path.join(backupDir, zipFileName);

  // 5. Write .txt file
  fs.writeFileSync(txtFilePath, textMessages.join('\n'), 'utf-8');

  // 6. Create ZIP
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ Archive created: ${zipFilePath} (${archive.pointer()} bytes)`);
      fs.unlinkSync(txtFilePath); // delete .txt file after zip
      resolve();
    });

    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);

    // Add .txt chat log
    archive.file(txtFilePath, { name: txtFileName });

    // Add documents
    docMessages.forEach((msg, index) => {
      const cleanFileUrl = msg.file_url.startsWith('/') ? msg.file_url.substring(1) : msg.file_url;
      const filePath = path.resolve(__dirname, '../public', cleanFileUrl); // adjust path if needed
      console.log('filePath',filePath);
      
      const fileName = path.basename(msg.file_url);
      console.log('fileName',fileName);
      
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: `doc_${index + 1}_${fileName}` });
      }
    });

    // Add videos
    videoMessages.forEach((msg, index) => {
      const cleanFileUrl = msg.file_url.startsWith('/') ? msg.file_url.substring(1) : msg.file_url;
      const filePath = path.resolve(__dirname, '../public', cleanFileUrl);
      const fileName = path.basename(msg.file_url);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: `video_${index + 1}_${fileName}` });
      }
    });

    archive.finalize();
  });

  return zipFilePath;
}

module.exports = { exportMessagesToTxtZip };