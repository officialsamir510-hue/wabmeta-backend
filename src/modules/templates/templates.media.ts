// src/modules/templates/templates.media.ts

import { Response, NextFunction } from 'express';
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
    fileSize: 16 * 1024 * 1024, // 16MB max
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

    // Validation
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
      requestedAccountId: whatsappAccountId,
    });

    // Find WhatsApp account
    let account = null;

    if (whatsappAccountId) {
      account = await prisma.whatsAppAccount.findFirst({
        where: {
          id: whatsappAccountId,
          organizationId,
          status: 'CONNECTED',
        },
      });
    }

    if (!account) {
      account = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });
    }

    if (!account) {
      throw new AppError(
        'No connected WhatsApp account found. Please connect your WhatsApp Business account first.',
        400
      );
    }

    console.log('📱 Using WhatsApp account for upload:', {
      id: account.id,
      phone: account.phoneNumber,
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,  // ✅ ADD THIS
    });

    // Get decrypted access token
    const accountWithToken = await metaService.getAccountWithToken(account.id);

    if (!accountWithToken || !accountWithToken.accessToken) {
      throw new AppError(
        'Failed to get WhatsApp credentials. Please reconnect your WhatsApp account.',
        500
      );
    }

    // Upload to Meta
    console.log('☁️ Uploading to Meta Cloud API...');

    const uploadResult = await metaApi.uploadMedia(
      account.phoneNumberId,
      accountWithToken.accessToken,
      file.buffer,
      file.mimetype,
      file.originalname
    );

    if (!uploadResult || !uploadResult.id) {
      throw new AppError('Meta upload failed - no media ID returned', 500);
    }

    console.log('✅ Media uploaded to Meta:', {
      mediaId: uploadResult.id,
      filename: file.originalname,
    });

    return res.json({
      success: true,
      message: 'Media uploaded successfully',
      data: {
        mediaId: uploadResult.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        wabaId: account.wabaId,           // ✅ ADD THIS
        phoneNumberId: account.phoneNumberId,  // ✅ ADD THIS
        whatsappAccountId: account.id,    // ✅ ADD THIS
      },
    });
  } catch (error: any) {
    console.error('❌ Media upload failed:', {
      message: error.message,
      metaError: error.metaError,
      response: error.response?.data,
    });

    // Handle Meta-specific errors
    const metaError = error.metaError || error.response?.data?.error;
    if (metaError) {
      return next(new AppError(
        `Meta upload error: ${metaError.message || metaError.error_user_msg || 'Unknown error'}`,
        400
      ));
    }

    next(error);
  }
};
