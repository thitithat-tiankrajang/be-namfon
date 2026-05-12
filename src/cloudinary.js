// src/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const upload = multer({
  dest: 'tmp/',
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export async function uploadToCloudinary(filePath) {
  const result = await cloudinary.uploader.upload(filePath, {
    folder: 'rain-best',
    transformation: [
      {
        width: 2000,
        height: 2000,
        crop: 'limit',
      },
    ],
  });

  fs.unlinkSync(filePath);

  return result;
}

export async function deleteImage(pubId) {
  if (!pubId) return;

  try {
    await cloudinary.uploader.destroy(pubId);
  } catch (err) {
    console.warn('Cloudinary delete failed:', err.message);
  }
}

export { cloudinary };