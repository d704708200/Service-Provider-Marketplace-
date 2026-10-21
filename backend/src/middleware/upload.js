const multer = require('multer');

// Store in memory buffer so we can stream to Cloudinary or write to local disk
const storage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF images are allowed.');
    error.statusCode = 400;
    cb(error, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB limit
  },
  fileFilter
});

const uploadSingleAvatar = (fieldName = 'avatar') => {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: {
              message: 'File size exceeds maximum allowed limit of 5MB',
              statusCode: 400,
              timestamp: new Date().toISOString()
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            message: `Upload error: ${err.message}`,
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      } else if (err) {
        return res.status(err.statusCode || 400).json({
          success: false,
          error: {
            message: err.message || 'File upload failed',
            statusCode: err.statusCode || 400,
            timestamp: new Date().toISOString()
          }
        });
      }
      next();
    });
  };
};

module.exports = {
  upload,
  uploadSingleAvatar
};
