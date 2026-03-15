// src/services/meta.upload.service.ts

import axios from 'axios';
import FormData from 'form-data';

export class MetaUploadService {
  /**
   * Upload media using Meta's Resumable Upload API
   * Returns a handle that can be used in templates
   */
  async uploadMediaForTemplate(
    wabaId: string,
    accessToken: string,
    file: Buffer,
    mimeType: string,
    filename: string
  ): Promise<{ handle: string }> {
    try {
      console.log('📤 Uploading to Meta Resumable Upload API:', {
        wabaId,
        filename,
        size: file.length,
        mimeType,
      });

      // ✅ Step 1: Create upload session
      const sessionResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${wabaId}/uploads`,
        {
          file_name: filename,
          file_length: file.length,
          file_type: mimeType,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const uploadSessionId = sessionResponse.data.id;

      console.log('✅ Upload session created:', uploadSessionId);

      // ✅ Step 2: Upload file data
      const uploadResponse = await axios.post(
        `https://graph.facebook.com/v21.0/${uploadSessionId}`,
        file,
        {
          headers: {
            'Authorization': `OAuth ${accessToken}`,
            'file_offset': '0',
            'Content-Type': 'application/octet-stream',
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      const mediaHandle = uploadResponse.data.h;

      if (!mediaHandle) {
        throw new Error('No media handle returned from Meta upload');
      }

      console.log('✅ Media uploaded to Meta:', {
        handle: mediaHandle,
        sessionId: uploadSessionId,
      });

      return { handle: mediaHandle };
    } catch (error: any) {
      console.error('❌ Meta upload failed:', {
        message: error.message,
        response: error.response?.data,
      });

      throw new Error(`Meta upload failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

export const metaUploadService = new MetaUploadService();
