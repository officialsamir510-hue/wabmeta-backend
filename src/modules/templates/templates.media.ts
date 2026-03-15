// src/modules/templates/templates.media.ts

import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../../middleware/errorHandler';
import { cloudinaryService } from '../../services/cloudinary.service';
import { metaUploadService } from '../../services/meta.upload.service';
import { metaService } from '../meta/meta.service';
import prisma from '../../config/database';

// Multer config (same as before)
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
    cb(new AppError(`Invalid file type: ${file.mimetype}`, 400), false);
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
    const { whatsappAccountId } = req.body;

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

    // Get WhatsApp account
    let account = await prisma.whatsAppAccount.findFirst({
      where: {
        ...(whatsappAccountId ? { id: whatsappAccountId } : {}),
        organizationId,
        status: 'CONNECTED',
      },
      orderBy: { isDefault: 'desc' },
    });

    if (!account) {
      account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
      });
    }

    if (!account) {
      throw new AppError('No connected WhatsApp account found', 400);
    }

    console.log('📱 Using WhatsApp account:', {
      id: account.id,
      phone: account.phoneNumber,
      wabaId: account.wabaId,
    });

    // Get access token
    const accountWithToken = await metaService.getAccountWithToken(account.id);

    if (!accountWithToken || !accountWithToken.accessToken) {
      throw new AppError('Failed to get WhatsApp credentials', 500);
    }

    // ✅ CRITICAL: Upload to Meta using Resumable Upload API
    console.log('☁️ Uploading to Meta Resumable Upload API...');

    const metaUploadResult = await metaUploadService.uploadMediaForTemplate(
      account.wabaId,
      accountWithToken.accessToken,
      file.buffer,
      file.mimetype,
      file.originalname
    );

    console.log('✅ Media uploaded to Meta:', {
      handle: metaUploadResult.handle,
    });

    // ✅ ALSO upload to Cloudinary for backup/preview
    let cloudinaryUrl = '';
    try {
      if (cloudinaryService.isConfigured()) {
        const cloudinaryResult = await cloudinaryService.uploadTemplateMedia(
          file.buffer,
          file.originalname,
          file.mimetype,
          organizationId
        );
        cloudinaryUrl = cloudinaryResult.secureUrl;
        console.log('✅ Also uploaded to Cloudinary for backup');
      }
    } catch (cloudinaryError) {
      console.warn('⚠️ Cloudinary backup upload failed, continuing with Meta handle');
    }

    return res.json({
      success: true,
      message: 'Media uploaded successfully',
      data: {
        mediaId: metaUploadResult.handle,  // ✅ Meta handle (required for template)
        handle: metaUploadResult.handle,
        url: cloudinaryUrl || '',           // Cloudinary URL (for preview)
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        wabaId: account.wabaId,
      },
    });
  } catch (error: any) {
    console.error('❌ Media upload failed:', {
      message: error.message,
      stack: error.stack,
    });

    if (error.message?.includes('Meta upload')) {
      return next(new AppError(
        'Failed to upload media to Meta. Please try again.',
        500
      ));
    }

    next(error);
  }
};
