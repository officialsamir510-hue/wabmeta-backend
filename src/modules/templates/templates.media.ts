// src/modules/templates/templates.media.ts

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../../middleware/errorHandler';
import { metaApi } from '../meta/meta.api';
import { metaService } from '../meta/meta.service';
import prisma from '../../config/database';

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'video/mp4',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Allowed: JPG, PNG, MP4, PDF', 400), false);
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

/**
 * Handle media upload for WhatsApp Template Headers
 * Uses 'any' for req to avoid middleware type compatibility issues with multer & custom user properties
 */
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
      size: file.size,
      mime: file.mimetype,
    });

    // Get WhatsApp account
    let account = await prisma.whatsAppAccount.findFirst({
      where: {
        id: whatsappAccountId || undefined,
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

    // Decrypt token using metaService (not metaApi as indicated in the user's snippet, because it's in service)
    const accountWithToken = await metaService.getAccountWithToken(account.id);
    if (!accountWithToken) {
      throw new AppError('Failed to get WhatsApp account credentials', 500);
    }

    // Upload to Meta
    console.log('☁️ Uploading to Meta...');
    const uploadResult = await metaApi.uploadMedia(
      account.phoneNumberId,
      accountWithToken.accessToken,
      file.buffer,
      file.mimetype,
      file.originalname
    );

    console.log('✅ Media uploaded to Meta:', uploadResult.id);

    return res.json({
      success: true,
      message: 'Media uploaded successfully',
      data: {
        mediaId: uploadResult.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  } catch (error: any) {
    console.error('❌ Media upload failed:', error);
    next(error);
  }
};
