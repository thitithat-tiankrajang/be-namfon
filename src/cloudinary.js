// src/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage: images go into "rain-best/" folder, auto-format webp, max 2000px
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'rain-best',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'],
    transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },  // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Helper: delete a Cloudinary asset by public_id (used when replacing/deleting)
export async function deleteImage(pubId) {
  if (!pubId) return;
  try {
    await cloudinary.uploader.destroy(pubId);
  } catch (err) {
    console.warn('Cloudinary delete failed:', err.message);
  }
}

export { cloudinary };
