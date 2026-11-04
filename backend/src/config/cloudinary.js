const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

/**
 * Upload an image buffer or file path to Cloudinary or fallback to local disk storage
 * @param {Object} file - Multer file object ({ buffer, originalname, mimetype, size } or { path })
 * @param {Object} options - { folder, public_id }
 * @returns {Promise<{ url: string, public_id: string, storage: 'cloudinary' | 'local' }>}
 */
const uploadImage = async (file, options = {}) => {
  const folder = options.folder || 'marketplace/avatars';

  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
          transformation: [
            { width: 800, height: 800, crop: 'limit', quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve({
            url: result.secure_url || result.url,
            public_id: result.public_id,
            storage: 'cloudinary'
          });
        }
      );

      if (file.buffer) {
        uploadStream.end(file.buffer);
      } else if (file.path) {
        fs.createReadStream(file.path).pipe(uploadStream);
      } else {
        reject(new Error('No file buffer or path provided to uploadStream'));
      }
    });
  }

  // Local storage fallback when Cloudinary credentials are not configured
  const subFolder = options.folder ? options.folder.replace(/^marketplace\//, '') : 'avatars';
  const uploadsDir = path.join(__dirname, '../../uploads', subFolder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = path.extname(file.originalname || '') || '.jpg';
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
  const filename = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${cleanExt}`;
  const filePath = path.join(uploadsDir, filename);

  if (file.buffer) {
    fs.writeFileSync(filePath, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, filePath);
  } else {
    throw new Error('No file buffer or path provided to save file locally');
  }

  // URL returned relative or absolute served via Express static
  const relativeUrl = `/uploads/${subFolder}/${filename}`;

  return {
    url: relativeUrl,
    public_id: filename,
    storage: 'local'
  };
};

/**
 * Upload an image or document (including PDF) buffer or file path to Cloudinary or fallback to local disk storage
 * @param {Object} file - Multer file object ({ buffer, originalname, mimetype, size } or { path })
 * @param {Object} options - { folder, public_id, resource_type, allowed_formats }
 * @returns {Promise<{ url: string, public_id: string, storage: 'cloudinary' | 'local' }>}
 */
const uploadDocument = async (file, options = {}) => {
  const folder = options.folder || 'marketplace/documents';
  const isPdf = (file.mimetype || '').toLowerCase().includes('pdf') ||
                (file.originalname || '').toLowerCase().endsWith('.pdf');

  if (isCloudinaryConfigured()) {
    return new Promise((resolve, reject) => {
      const uploadStreamOptions = {
        folder,
        resource_type: isPdf ? 'raw' : 'auto'
      };

      if (!isPdf) {
        uploadStreamOptions.allowed_formats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
      }

      if (options.public_id) {
        uploadStreamOptions.public_id = options.public_id;
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadStreamOptions,
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve({
            url: result.secure_url || result.url,
            public_id: result.public_id,
            storage: 'cloudinary'
          });
        }
      );

      if (file.buffer) {
        uploadStream.end(file.buffer);
      } else if (file.path) {
        fs.createReadStream(file.path).pipe(uploadStream);
      } else {
        reject(new Error('No file buffer or path provided to uploadStream'));
      }
    });
  }

  // Local storage fallback when Cloudinary credentials are not configured
  const subFolder = options.folder ? options.folder.replace(/^marketplace\//, '') : 'documents';
  const uploadsDir = path.join(__dirname, '../../uploads', subFolder);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const ext = path.extname(file.originalname || '') || (isPdf ? '.pdf' : '.jpg');
  const cleanExt = ext.startsWith('.') ? ext : `.${ext}`;
  const filename = `cert-${Date.now()}-${Math.round(Math.random() * 1e9)}${cleanExt}`;
  const filePath = path.join(uploadsDir, filename);

  if (file.buffer) {
    fs.writeFileSync(filePath, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, filePath);
  } else {
    throw new Error('No file buffer or path provided to save file locally');
  }

  const relativeUrl = `/uploads/${subFolder}/${filename}`;

  return {
    url: relativeUrl,
    public_id: filename,
    storage: 'local'
  };
};

/**
 * Safely delete an asset from Cloudinary or local uploads
 * @param {string} publicId
 * @param {string} resourceType - 'image' | 'raw' | 'auto'
 */
const deleteAsset = async (publicId, resourceType = 'auto') => {
  if (!publicId) return;

  if (isCloudinaryConfigured()) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    } catch (err) {
      console.warn('[Cloudinary deleteAsset warning]:', err.message);
    }
    return;
  }

  // Check local uploads directory
  try {
    const searchDirs = [
      path.join(__dirname, '../../uploads/documents'),
      path.join(__dirname, '../../uploads/certifications'),
      path.join(__dirname, '../../uploads/kyc_documents'),
      path.join(__dirname, '../../uploads/avatars')
    ];
    for (const dir of searchDirs) {
      const targetPath = path.join(dir, publicId);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        break;
      }
    }
  } catch (err) {
    console.warn('[Local deleteAsset warning]:', err.message);
  }
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadImage,
  uploadDocument,
  deleteAsset
};
