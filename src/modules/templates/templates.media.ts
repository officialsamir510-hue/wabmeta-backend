// src/modules/templates/templates.media.ts

import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../../middleware/errorHandler';
import { cloudinaryService } from '../../services/cloudinary.service';

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'video/mp4',
    'video/3gpp',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}. Allowed: JPG, PNG, MP4, PDF`, 400), false);
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB
  },
});

// ============================================
// UPLOAD HANDLER
// ============================================

export const uploadTemplateMedia = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const file = req.file;
    const organizationId = req.user?.organizationId;

    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    if (!organizationId) {
      throw new AppError('Organization context required', 400);
    }

    console.log('📤 Uploading template media:', {
      filename: file.originalname,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      mime: file.mimetype,
      organizationId,
    });

    // ✅ Upload to Cloudinary
    console.log('☁️ Uploading to Cloudinary...');

    const uploadResult = await cloudinaryService.uploadTemplateMedia(
      file.buffer,
      file.originalname,
      file.mimetype,
      organizationId
    );

    console.log('✅ Media uploaded to Cloudinary:', {
      url: uploadResult.secureUrl,
      publicId: uploadResult.publicId,
    });

    return res.json({
      success: true,
      message: 'Media uploaded successfully',
      data: {
        mediaId: uploadResult.secureUrl,  // ✅ Return public HTTPS URL
        url: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        format: uploadResult.format,
        resourceType: uploadResult.resourceType,
      },
    });
  } catch (error: any) {
    console.error('❌ Media upload failed:', {
      message: error.message,
      stack: error.stack,
    });

    if (error.message?.includes('Cloudinary')) {
      return next(new AppError(
        'Failed to upload media to cloud storage. Please try again.',
        500
      ));
    }

    next(error);
  }
};
