const { Op, Sequelize } = require("sequelize");
const bcrypt = require('bcrypt');
const { User, Message, ReportContact, UserSettings, Setting, Block, Friend } = require("../../models");
const { updateUserSetting } = require('../../utils/helper-functions');

exports.updateProfile = async (req, res) => {
  const id = req.session.userId;
  const { name, bio } = req.body;
  const avatar = req.file ? `/uploads/${req.file.filename}` : null
  
  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: true, message: "User Not Found" });
    }

    if(req.file){
      await user.update({ avatar});
    }

    await user.update({ name , bio});
    
    res.status(201).json({ success: true, message: "User Updated", avatar });
  } catch (error) {
    console.error("Error in update Profile", error);
    res.status(503).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getProfile = async (req, res) => {
  const currentUserId = req.session.userId;
  const userId = req.params.id;

  try {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'name', 'avatar', 'is_online', 'last_seen', 'phone', 'email', 'bio', 'country_code', 'username']
    });
  
    if (!user) return res.status(404).json({ error: 'User not found' });
  
    const notCleared = Sequelize.where(
      Sequelize.fn('COALESCE', Sequelize.col('clear_chat_by'), ''),
      { [Op.notLike]: `%${currentUserId}%` }
    );
  
    const betweenUsers = (extra = {}) => ({
      [Op.or]: [
        { sender_id: currentUserId, recipient_id: userId, ...extra },
        { sender_id: userId, recipient_id: currentUserId, ...extra }
      ]
    });
  
    // FETCH SHARED DOCUMENTS
    const sharedDocuments = await Message.findAll({
      where: {
        ...betweenUsers(),
        message_type: { [Op.in]: ['document', 'file'] },
        [Op.and]: [notCleared]
      },
      attributes: ['id', 'content', 'file_url', 'file_type', 'created_at', 'metadata'],
      order: [['created_at', 'DESC']],
      limit: 3 
    });
    
    // FETCH SHARED IMAGES
    const sharedImages = await Message.findAll({
      where: {
        ...betweenUsers({ message_type: 'image' }),
        [Op.and]: [notCleared]
      },
      attributes: ['id', 'file_url', 'created_at', 'metadata'],
      order: [['created_at', 'DESC']],
      limit: 6
    });
    
    // FETCH STARRED MESSAGES
    const starredMessages = await Message.findAll({
      where: {
        ...betweenUsers(),
        message_type: 'text',
        [Op.and]: [
          notCleared,
          Sequelize.literal(
            `JSON_CONTAINS(JSON_EXTRACT(metadata, '$.flags.starred_by'), '${currentUserId}', '$')`
          )
        ]
      },
      attributes: ['id', 'content', 'created_at', 'metadata'],
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'name', 'avatar']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 2
    });
    
    res.json({
      ...user.toJSON(),
      contact_info: {
        phone: user.phone,
        email: user.email,
      },
      shared_documents: sharedDocuments.map(doc => ({
        id: doc.id,
        name: doc.metadata.original_filename || 'Document',
        url: doc.file_url,
        type: doc.file_type,
        size: doc.metadata?.fileSize || null,
        date: doc.created_at
      })),
      shared_images: sharedImages.map(img => ({
        id: img.id,
        url: img.file_url,
        date: img.created_at
      })),
      starred_messages: starredMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        date: msg.created_at,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          avatar: msg.sender.avatar
        }
      }))
    });  
  } catch (error) {
    console.error('Error in getProfile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.reportUser = async (req, res) => {
  try {
    const { reportedUserId, reportType, description } = req.body;
    const reporterId = req.session.userId;

    // Validate input
    if (!reportedUserId || !reportType) {
      return res.status(404).json({ error: 'Missing required fields' });
    }

    // Check if user is reporting themselves
    if (parseInt(reportedUserId) === parseInt(reporterId)) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }

    const reportedUser = await User.findByPk(reportedUserId);
    if (!reportedUser) {
      return res.status(404).json({ error: 'Reported user not found' });
    }
    
    const recentReport = await ReportContact.findOne({
      where: {
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        created_at: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) 
        }
      }
    });

    if (recentReport) {
      return res.status(503).json({ 
        message: 'You have already reported this user recently. Please wait 24 hours before reporting again.' 
      });
    }

    if (reportType === 'other' && (!description || description.trim().length < 10)) {
      return res.status(400).json({ 
        error: 'Please provide detailed description when selecting "Other" as the reason' 
      });
    }

    // Create report
    const report = await ReportContact.create({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      report_type: reportType,
      description: description,
    });

    // Update user's report count
    await User.increment('report_count', {
      where: { id: reportedUserId }
    });

    res.json({
      success: true,
      message: 'User reported successfully. Our team will review your report.',
      reportId: report.id,
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Failed to report user' });
  }
};

exports.updateUserSettings = async (req, res) => {
  const userId = req.session.userId;
  const {
    last_seen,
    profile_pic,
    call_me,
    send_msg,
    read_receipt,
    typing_indicator,
    delete_requested
  } = req.body;

  try {
    // --- Handle Deletion Request ---
    if (delete_requested === 'request') {
      const setting = await Setting.findOne({ where: { key: 'user_account_deletion' } });
      const adminApprovalRequired = setting?.value === 'true';

      const metadata = {
        delete_requested_at: new Date()
      };

      if (adminApprovalRequired) {
        await UserSettings.upsert({
          user_id: userId,
          delete_requested: 'pending',
          metadata
        });

        return res.status(200).json({
          success: true,
          message: 'Deletion request pending admin approval'
        });
      }

      await UserSettings.upsert({
        user_id: userId,
        delete_requested: 'approved',
        metadata
      });

      req.session.destroy((err) => {
        if (err) console.error('Session destroy error:', err);
      });

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        redirect: '/login'
      });
    }

    // --- Handle Regular Settings Update ---
    const settingsData = {
      last_seen,
      profile_pic,
      call_me,
      send_msg,
      read_receipt,
      typing_indicator: typing_indicator === 'true' || typing_indicator === true
    };

    if (delete_requested !== undefined) {
      settingsData.delete_requested = delete_requested;
    }

    // Create or update user settings
    await UserSettings.upsert({ user_id: userId, ...settingsData });

    res.status(200).json({
      success: true,
      settings: settingsData,
      message: 'Privacy settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

exports.changePassword = async (req, res) => {
  const userId = req.session.userId;
  const { oldPassword, newPassword } = req.body;

  try {
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hashed });

    req.session.destroy((err) => {
      if (err) console.error('Session destroy error:', err);
    });

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.updateWallpaper = async (req, res) => {
  const userId = req.session.userId;
  const { chat_wallpaper } = req.body;

  if (!chat_wallpaper) {
    return res.status(400).json({ success: false, message: 'No wallpaper selected.' });
  }
  
  try {
    let settings = await UserSettings.findOne({ where: { user_id: userId } });
    if (!settings) {
      settings = await UserSettings.create({ user_id: userId, chat_wallpaper });
    } else {
      await settings.update({ chat_wallpaper });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating wallpaper:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }  
};

exports.updateThemeMode = async (req, res) => {
  const userId = req.session.userId;
  const { theme_mode } = req.body;

  if (!['light', 'dark'].includes(theme_mode)) {
    return res.status(400).json({ success: false, message: 'Invalid theme mode.' });
  }

  try {
    const settings = await UserSettings.findOne({ where: { user_id: userId } });
    
    if (!settings) {
      await UserSettings.create({ user_id: userId, theme_mode });
    } else {
      await settings.update({ theme_mode });
    }

    res.status(200).json({ success: true, message: 'Theme mode updated.' });
  } catch (err) {
    console.error('Error updating theme mode:', err);
    res.status(500).json({ success: false, message: 'Internal error.' });
  }
};

exports.updateThemeLayout = async (req,res) => {  
  const userId = req.session.userId;
  const { theme_layout } = req.body;

  try {

    const [settings, created] = await UserSettings.findOrCreate({
      where: { user_id: userId },
      defaults: { theme_layout : theme_layout ? theme_layout : 'default' }
    });

    if (!created) {
      settings.theme_layout = theme_layout;
      await settings.save();
    }

    return res.json({ success: true, theme_layout });
  } catch (err) {
    console.error('Theme layout save error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

exports.updateThemeColor = async (req,res) => {
  const userId = req.session.userId;
  const { theme_color, colorClass } = req.body;

  if (!theme_color) {
    return res.status(400).json({ error: 'Missing theme_color' });
  }

  await UserSettings.upsert({
    user_id: userId,
    theme_color,
    metadata: {
      color_class:colorClass
    }
  });

  res.json({ success: true });
}

exports.fetchThemeColor = async (req,res) => {
  const userId = req.session.userId;

  const settings = await UserSettings.findOne({ where: { user_id: userId } });

  res.json({
    theme_color: settings?.theme_color || '28, 157, 234',
    color_class: settings?.metadata?.color_class || 'lc-light-blue'
  });
}

exports.updateThemeDirection = async (req,res) => {
  const userId = req.session.userId;
  const { layout } = req.body; 

  try {
    await UserSettings.update(
      { theme_direction: layout },
      { where: { user_id: userId } }
    );

    res.json({ message: 'Direction updated', layout, success:true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update layout' });
  }
}

exports.updateSidebarLayout = async (req,res) => {
  const userId = req.session.userId;
  const { sidebar_layout } = req.body;

  if (!['two-column', 'three-column'].includes(sidebar_layout)) {
    return res.status(400).json({ success: false, message: 'Invalid layout value' });
  }
  
  try {
    await UserSettings.update(
      { 	theme_sidebar:sidebar_layout },
      { where: { user_id: userId } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update sidebar layout:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

// Auto backup toggle
exports.toggleAutoBackup = async (req, res) => {
  await updateUserSetting(req, res, 'auto_chat_backup', 'auto_chat_backup');
};

// Include document toggle
exports.toggleIncludeDoc = async (req, res) => {
  await updateUserSetting(req, res, 'include_doc_backup', 'include_doc_backup');
};

// Include video toggle
exports.toggleIncludeVid = async (req, res) => {
  await updateUserSetting(req, res, 'include_video_backup', 'include_video_backup');
};

exports.fetchSystemSetting = async (req,res) => {
  const settings = await Setting.findAll();
  const systemSettings = settings.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  res.json(systemSettings)
}

exports.checkUserBlock = async (req, res) => {
  const recipientId = parseInt(req.params.userId);
  const currentUserId = req.session.userId;

  try {
    // Recipient has blocked current user
    const isBlockedByRecipient = await Block.findOne({
      where: {
        blocker_id: recipientId,
        blocked_id: currentUserId,
      },
    });

    // Current user has blocked recipient
    const hasBlockedRecipient = await Block.findOne({
      where: {
        blocker_id: currentUserId,
        blocked_id: recipientId,
      },
    });

    res.json({
      isBlockedByRecipient: !!isBlockedByRecipient,
      hasBlockedRecipient: !!hasBlockedRecipient,
    });
  } catch (err) {
    console.error('Error checking block status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.checkIsFriend = async (req,res) => {
  const { recipientId } = req.params;
  const currentUserId = req.session.userId;

  try {
    const friendship = await Friend.findOne({
      where: {
        [Op.or]: [
          { user_id: currentUserId, friend_id: recipientId },
          { user_id: recipientId, friend_id: currentUserId }
        ]
      }
    });

    if (!friendship) {
      return res.json({ status: 'not_friends' });
    }

    return res.json({ status: friendship.status }); 
  } catch (err) {
    console.error("Error checking friend status:", err);
    res.status(500).json({ error: 'Internal server error' });
  }
}