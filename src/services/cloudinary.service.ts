// src/services/cloudinary.service.ts

import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export class CloudinaryService {
  /**
   * Upload template media to Cloudinary
   */
  async uploadTemplateMedia(
    file: Buffer,
    filename: string,
    mimeType: string,
    organizationId: string
  ): Promise<{
    url: string;
    secureUrl: string;
    publicId: string;
    format: string;
    resourceType: string;
  }> {
    return new Promise((resolve, reject) => {
      const folder = `${config.cloudinary.folder}/${organizationId}`;
      
      // Determine resource type
      let resourceType: 'image' | 'video' | 'raw' = 'image';
      if (mimeType.startsWith('video/')) {
        resourceType = 'video';
      } else if (mimeType === 'application/pdf') {
        resourceType = 'raw';
      }

      // Upload stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          public_id: `${Date.now()}_${filename.split('.')[0]}`,
          overwrite: false,
          use_filename: true,
          unique_filename: true,
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload failed:', error);
            reject(new Error(`Cloudinary upload failed: ${error.message}`));
          } else if (result) {
            console.log('✅ Uploaded to Cloudinary:', {
              url: result.secure_url,
              publicId: result.public_id,
              format: result.format,
            });

            resolve({
              url: result.url,
              secureUrl: result.secure_url,
              publicId: result.public_id,
              format: result.format || '',
              resourceType: result.resource_type || resourceType,
            });
          } else {
            reject(new Error('No result from Cloudinary'));
          }
        }
      );

      // Write buffer to stream
      uploadStream.end(file);
    });
  }

  /**
   * Delete media from Cloudinary
   */
  async deleteMedia(publicId: string, resourceType: 'image' | 'video' | 'raw' = 'image'): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      console.log('✅ Deleted from Cloudinary:', publicId);
    } catch (error: any) {
      console.error('❌ Cloudinary delete failed:', error);
      throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
    }
  }
}

export const cloudinaryService = new CloudinaryService();
