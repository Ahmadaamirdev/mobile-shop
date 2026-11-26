const cloudinary = require('cloudinary').v2;

// Configure Cloudinary if credentials are provided in environment
const isConfigured = Boolean(
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) ||
  process.env.CLOUDINARY_URL
);

if (isConfigured) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
}

/**
 * Upload an image (base64 data URL or remote URL) to Cloudinary with aggressive compression.
 * If Cloudinary credentials are not set, falls back gracefully to storing compressed data.
 */
const uploadCompressedImage = async (dataUriOrUrl, folder = 'unity_mobile/id_cards') => {
  if (!dataUriOrUrl || typeof dataUriOrUrl !== 'string') {
    return '';
  }

  // If already a remote Cloudinary URL or http URL, return it directly
  if (dataUriOrUrl.startsWith('http://') || dataUriOrUrl.startsWith('https://')) {
    return dataUriOrUrl;
  }

  if (!isConfigured) {
    console.warn('⚠️ Cloudinary is not configured in .env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Using client-compressed data directly.');
    return dataUriOrUrl;
  }

  try {
    const uploadRes = await cloudinary.uploader.upload(dataUriOrUrl, {
      folder,
      resource_type: 'image',
      format: 'webp', // WebP yields 50-80% smaller files than JPEG with high visual fidelity
      quality: 'auto:eco', // Maximum automatic compression preserving legible text/CNIC digits
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' }, // Downscale if camera photo exceeds 1200px
      ],
    });

    return uploadRes.secure_url || uploadRes.url;
  } catch (err) {
    console.error('❌ Cloudinary upload error:', err.message);
    // Fall back to original data so user record is never lost
    return dataUriOrUrl;
  }
};

module.exports = {
  cloudinary,
  isConfigured,
  uploadCompressedImage,
};
