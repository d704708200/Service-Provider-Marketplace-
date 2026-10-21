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
    // Diagnostic logging for multipart headers in non-production or debug mode (safe: no secrets)
    const contentType = req.headers['content-type'] || '';
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_UPLOAD) {
      const hasBoundary = contentType.includes('boundary=');
      console.log(`[Upload Diagnostic] Method: ${req.method} | Path: ${req.originalUrl || req.url} | Content-Type: ${contentType.substring(0, 80)} | Has Boundary: ${hasBoundary}`);
    }

    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request: Content-Type must be multipart/form-data with a valid boundary',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!contentType.includes('boundary=')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request: Multipart boundary missing from Content-Type header. Do not manually set Content-Type: multipart/form-data; let the browser/client generate it.',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

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
        const errMsg = err.message || 'File upload failed';
        const isMalformedHeader = errMsg.toLowerCase().includes('malformed part header') || errMsg.toLowerCase().includes('boundary not found');
        return res.status(err.statusCode || 400).json({
          success: false,
          error: {
            message: isMalformedHeader
              ? 'Malformed multipart payload. Please verify that the client generates a valid boundary and standard form-data headers.'
              : errMsg,
            statusCode: err.statusCode || 400,
            timestamp: new Date().toISOString()
          }
        });
      }
      next();
    });
  };
};

const uploadSingleKYCDocument = (fieldName = 'document') => {
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request: Content-Type must be multipart/form-data with a valid boundary',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    if (!contentType.includes('boundary=')) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request: Multipart boundary missing from Content-Type header.',
          statusCode: 400,
          timestamp: new Date().toISOString()
        }
      });
    }

    const uploadMiddleware = upload.single(fieldName);
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Document file size exceeds maximum allowed limit of 5MB',
              statusCode: 400,
              timestamp: new Date().toISOString()
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            message: `Document upload error: ${err.message}`,
            statusCode: 400,
            timestamp: new Date().toISOString()
          }
        });
      } else if (err) {
        return res.status(err.statusCode || 400).json({
          success: false,
          error: {
            message: err.message || 'Document upload failed',
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
  uploadSingleAvatar,
  uploadSingleKYCDocument
};
