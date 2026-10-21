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

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadImage
};
