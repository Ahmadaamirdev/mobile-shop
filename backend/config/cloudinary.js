const cloudinary = require('cloudinary').v2;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB decoded limit
const ALLOWED_DATA_URI_RE = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/i;

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

const createValidationError = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
};

/**
 * Validate and upload an image (base64 data URL or Cloudinary HTTPS URL) with compression.
 * Blocks SVG/HTML data URIs, oversized payloads, and arbitrary external/internal URLs (SSRF).
 */
const uploadCompressedImage = async (dataUriOrUrl, folder = 'unity_mobile/id_cards') => {
  if (!dataUriOrUrl) return '';
  if (typeof dataUriOrUrl !== 'string') {
    throw createValidationError('Invalid image payload.');
  }

  const trimmed = dataUriOrUrl.trim();
  if (!trimmed) return '';

  // Allow only trusted Cloudinary HTTPS URLs if already uploaded
  if (trimmed.startsWith('https://res.cloudinary.com/')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    throw createValidationError('External image URLs are not permitted. Please upload a valid image file.');
  }

  // Strictly validate base64 image MIME type (blocks SVG, HTML, scripts, executables)
  const match = trimmed.match(ALLOWED_DATA_URI_RE);
  if (!match) {
    throw createValidationError('Invalid image format. Only JPEG, PNG, and WEBP images are allowed.');
  }

  const base64Body = match[2];
  const estimatedBytes = Math.floor((base64Body.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw createValidationError('Image file exceeds maximum allowed size of 5 MB.');
  }

  if (!isConfigured) {
    console.warn('⚠️ Cloudinary is not configured. Storing validated client-compressed image.');
    return trimmed;
  }

  try {
    const uploadRes = await cloudinary.uploader.upload(trimmed, {
      folder,
      resource_type: 'image',
      format: 'webp',
      quality: 'auto:eco',
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
      ],
    });

    return uploadRes.secure_url || uploadRes.url;
  } catch (err) {
    console.error('❌ Cloudinary upload error:', err.message);
    return trimmed;
  }
};

module.exports = {
  cloudinary,
  isConfigured,
  uploadCompressedImage,
};
