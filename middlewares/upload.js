'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const loadSystemSettings = async () => {
  const settingsModulePath = require.resolve('../utils/system-settings');
  delete require.cache[settingsModulePath];
  const freshModule = require('../utils/system-settings');
  return await freshModule.loadSystemSettings();
};
let settings;

// MIME type to extension map
const mimeToExtension = {
  // Images
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',

  // Audio
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/m4a': 'm4a',

  // Video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/avi': 'avi',
  'video/mov': 'mov',
  'video/wmv': 'wmv',
  'video/mkv': 'mkv',

  // Documents
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
};

// Dynamically fetch file size limits (in bytes)
async function getDynamicFileSizeLimits() {
  settings = await loadSystemSettings();

  return {
    image: (parseInt(settings.image_file_size_limit) || 5) * 1024 * 1024,
    audio: (parseInt(settings.max_audio_video_file_size) || 10) * 1024 * 1024,
    video: (parseInt(settings.max_audio_video_file_size) || 10) * 1024 * 1024,
    document: (parseInt(settings.max_document_size) || 10) * 1024 * 1024,
    file: 25 * 1024 * 1024, // fallback for unknown types
  };
}

// Determine file category from MIME type
const getTypePrefix = (mimetype) => {
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  if (
    mimetype === 'application/pdf' ||
    mimetype.includes('document') ||
    mimetype.includes('text') ||
    mimetype.includes('sheet') ||
    mimetype.includes('presentation')
  ) {
    return 'document';
  }
  return 'file';
};

// Format bytes to readable size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Ensure upload directory exists
const uploadDir = './public/uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = mimeToExtension[file.mimetype] || path.extname(file.originalname) || '.bin';
    const typePrefix = getTypePrefix(file.mimetype);
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);

    cb(null, `${typePrefix}-${timestamp}-${randomString}.${ext}`);
  }
});

// Validate MIME type
const fileFilter = (req, file, cb) => {
  const allowedMimes = Object.keys(mimeToExtension);

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(settings.file_formats_error_message), false);
  }
};

// Base Multer instance (with max global limit)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB (max across types)
    files: 10 // Max files at once
  }
});

// Upload middleware: multiple files + dynamic size validation
const uploadFiles = async (req, res, next) => {
  const fileSizeLimits = await getDynamicFileSizeLimits();
  const fileLimit = parseInt(settings.multi_file_share_limit) || 10;
  const uploadMultiple = upload.array('files', fileLimit);
  
  uploadMultiple(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large. Maximum size depends on file type.',
          details: fileSizeLimits
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: `Too many files. Maximum ${fileLimit} files allowed.`
        });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    // Check each uploaded file's actual size vs its type-specific limit
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileType = getTypePrefix(file.mimetype);
        const maxSize = fileSizeLimits[fileType] || fileSizeLimits.file;

        if (file.size > maxSize) {
          // Remove the oversized file
          fs.unlinkSync(file.path);

          return res.status(400).json({
            error: `${file.originalname} exceeds size limit for ${fileType} files (${formatFileSize(maxSize)})`
          });
        }
      }
    }

    next();
  });
};

// Upload middleware: single file (no type-specific validation)
// const uploadSingle = upload.single('file');

// Dynamic single file upload middleware
const uploadSingle = async (req, res, next) => {
  const fileSizeLimits = await getDynamicFileSizeLimits();
  const dynamicUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
      fileSize: Math.max(...Object.values(fileSizeLimits)), // fallback global limit
      files: 1
    }
  }).single('file');

  dynamicUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large. Maximum size depends on file type.',
          details: fileSizeLimits
        });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    // Per-type size validation
    if (req.file) {
      const file = req.file;
      const fileType = getTypePrefix(file.mimetype);
      const maxSize = fileSizeLimits[fileType] || fileSizeLimits.file;
      
      if (file.size > maxSize) {
        fs.unlinkSync(file.path);
        return res.status(400).json({
          error: `${file.originalname} exceeds size limit for ${fileType} files (${formatFileSize(maxSize)})`
        });
      }
    }

    next();
  });
};

module.exports = {
  upload,
  uploadFiles,
  uploadSingle,
  mimeToExtension,
  getTypePrefix,
  formatFileSize
};