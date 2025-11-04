'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const settingsData = [
      // Email Settings
      {
        id: 1,
        key: 'mailer',
        value: 'SMTP,SendMail',
        label: 'Mailer',
        type: 'JSON',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        key: 'smtp_host',
        value: 'YOUR_HOST',
        label: 'Host',
        type: 'STRING',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        key: 'smtp_port',
        value: '587',
        label: 'Port',
        type: 'INTEGER',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        key: 'smtp_user',
        value: 'ENTER_USERNAME',
        label: 'Username',
        type: 'STRING',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 5,
        key: 'smtp_pass',
        value: 'YOUR_PASSWORD',
        label: 'Password',
        type: 'STRING',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 6,
        key: 'mail_from_name',
        value: 'no-reply',
        label: 'E-mail From Name',
        type: 'STRING',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 7,
        key: 'mail_from_email',
        value: 'ENTER_YOUR_MAIL@MAIL.COM',
        label: 'E-mail From Address',
        type: 'STRING',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 8,
        key: 'support_email',
        value: 'youremail@example.com',
        label: 'Support E-mail',
        type: 'STRING',
        category: 'email',
        created_at: new Date(),
        updated_at: new Date()
      },

      // Frontend Settings
      {
        id: 9,
        key: 'favicon_logo',
        value: null,
        label: 'Favicon Icon',
        type: 'STRING',
        category: 'frontend',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 10,
        key: 'app_logo',
        value: null,
        label: 'App Logo',
        type: 'STRING',
        category: 'frontend',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 11,
        key: 'dark_logo',
        value: null,
        label: 'Dark Logo',
        type: 'STRING',
        category: 'frontend',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 12,
        key: 'big_logo',
        value: null,
        label: 'Big Logo',
        type: 'STRING',
        category: 'frontend',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 13,
        key: 'white_logo',
        value: null,
        label: 'White Logo',
        type: 'STRING',
        category: 'frontend',
        created_at: new Date(),
        updated_at: new Date()
      },

      // General Settings
      {
        id: 14,
        key: 'app_name',
        value: 'App Name',
        label: 'App Name',
        type: 'STRING',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 15,
        key: 'app_email',
        value: 'support@yourapp.com',
        label: 'App Email',
        type: 'STRING',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 16,
        key: 'is_maintenance_mode',
        value: 'false',
        label: 'Is Maintenance Mode',
        type: 'BOOLEAN',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 17,
        key: 'maintenance_msg',
        value: 'Our app is under maintenance. Will be back in few days',
        label: 'Maintenance Message',
        type: 'STRING',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 18,
        key: 'default_mode',
        value: 'Light',
        label: 'System Default Mode',
        type: 'STRING',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 19,
        key: 'allow_customizer',
        value: 'true',
        label: 'Display Customizer',
        type: 'BOOLEAN',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 20,
        key: 'allow_voice_call',
        value: 'true',
        label: 'Allow Voice call',
        type: 'BOOLEAN',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 21,
        key: 'allow_video_call',
        value: 'true',
        label: 'Allow Video Call',
        type: 'BOOLEAN',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 22,
        key: 'allow_archive_chat',
        value: 'true',
        label: 'Allow User Archive Chats',
        type: 'BOOLEAN',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 23,
        key: 'media_send_allowed',
        value: 'true',
        label: 'Media Send Allowed',
        type: 'BOOLEAN',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 24,
        key: 'not_found_message',
        value: 'Page not found. The page you are looking for does not exist.',
        label: 'Not Found Error Message',
        type: 'STRING',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 25,
        key: 'no_internet_message',
        value: 'No internet connection. Please check your network and try again.',
        label: 'No Internet Error Message',
        type: 'STRING',
        category: 'general',
        created_at: new Date(),
        updated_at: new Date()
      },

      // Media Settings
      {
        id: 26,
        key: 'max_document_size',
        value: '10',
        label: 'Maximum Document Size (In MB)',
        type: 'INTEGER',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 27,
        key: 'max_audio_video_file_size',
        value: '10',
        label: 'Maximum audio / Video File Size (In MB)',
        type: 'INTEGER',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 28,
        key: 'multi_file_share_limit',
        value: '5',
        label: 'Multiple File Share Limit',
        type: 'TINYINT',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 29,
        key: 'image_file_size_limit',
        value: '5',
        label: 'Maximum Image File Size (In MB)',
        type: 'INTEGER',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 30,
        key: 'supported_file_formats',
        value: '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpeg,.mp3,.mp4',
        label: 'Supported File Formats',
        type: 'JSON',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 31,
        key: 'file_formats_error_message',
        value: 'This file format is not supported.',
        label: 'File Format Error Message',
        type: 'STRING',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 32,
        key: 'call_timeout_seconds',
        value: '25',
        label: 'Unanswered Call Timeout (In Seconds)',
        type: 'INTEGER',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 33,
        key: 'character_limit',
        value: '65535',
        label: 'Character Limit Per Message',
        type: 'SMALLINT',
        category: 'media',
        created_at: new Date(),
        updated_at: new Date()
      },

      // User Control Settings
      {
        id: 34,
        key: 'allow_user_block',
        value: 'true',
        label: 'Allow User Block',
        type: 'BOOLEAN',
        category: 'user-control',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 35,
        key: 'allow_user_signup',
        value: 'true',
        label: 'Allow User Signup',
        type: 'BOOLEAN',
        category: 'user-control',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 36,
        key: 'login_attempt_limit',
        value: '5',
        label: 'Login Attempt Limit',
        type: 'TINYINT',
        category: 'user-control',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 37,
        key: 'resend_otp_limit',
        value: '3',
        label: 'Resend OTP Limit',
        type: 'TINYINT',
        category: 'user-control',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 38,
        key: 'previous_passwords_blocked',
        value: 'true',
        label: 'Allow Reuse Previous Password',
        type: 'BOOLEAN',
        category: 'user-control',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 39,
        key: 'session_timeout_minutes',
        value: '60',
        label: 'Session Timeout (In Minutes)',
        type: 'INTEGER',
        category: 'user-control',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 40,
        key: 'is_email_verification',
        value: 'true',
        label: 'Required E-mail Verification',
        type: 'BOOLEAN',
        category: 'user-control',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    await queryInterface.bulkInsert('settings', settingsData, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('settings', null, {});
  }
};
