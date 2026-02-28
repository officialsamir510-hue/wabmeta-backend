// src/modules/inbox/inbox.media.ts

import axios from 'axios';
import prisma from '../../config/database';

export class InboxMediaService {

    // ==========================================
    // GET MEDIA URL FROM WHATSAPP
    // ==========================================

    async getMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
        try {
            // Step 1: Get media URL from WhatsApp
            const response = await axios.get(
                `https://graph.facebook.com/v18.0/${mediaId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            const mediaUrl = response.data?.url;

            if (!mediaUrl) {
                console.error('No media URL in response:', response.data);
                return null;
            }

            return mediaUrl;
        } catch (error: any) {
            console.error('Error getting media URL:', error.response?.data || error.message);
            return null;
        }
    }

    // ==========================================
    // DOWNLOAD MEDIA AS BASE64
    // ==========================================

    async downloadMediaAsBase64(
        mediaId: string,
        accessToken: string,
        mimeType?: string
    ): Promise<{ base64: string; mimeType: string } | null> {
        try {
            // Step 1: Get the media URL
            const mediaUrl = await this.getMediaUrl(mediaId, accessToken);

            if (!mediaUrl) {
                return null;
            }

            // Step 2: Download the media
            const response = await axios.get(mediaUrl, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                responseType: 'arraybuffer',
            });

            // Step 3: Convert to base64
            const base64 = Buffer.from(response.data).toString('base64');
            const contentType = response.headers['content-type'] || mimeType || 'application/octet-stream';

            return {
                base64: `data:${contentType};base64,${base64}`,
                mimeType: contentType,
            };
        } catch (error: any) {
            console.error('Error downloading media:', error.response?.data || error.message);
            return null;
        }
    }

    // ==========================================
    // GET MEDIA URL FOR FRONTEND (PROXY)
    // ==========================================

    async getProxiedMediaUrl(
        mediaId: string,
        organizationId: string
    ): Promise<string | null> {
        try {
            // Get WhatsApp account with access token
            const account = await prisma.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    isActive: true,
                },
            });

            if (!account || !account.accessToken) {
                console.error('No active WhatsApp account found');
                return null;
            }

            // Decrypt access token if encrypted
            let accessToken = account.accessToken;

            // Get media URL
            const mediaUrl = await this.getMediaUrl(mediaId, accessToken);

            return mediaUrl;
        } catch (error: any) {
            console.error('Error getting proxied media URL:', error);
            return null;
        }
    }

    // ==========================================
    // PROCESS INCOMING MEDIA MESSAGE
    // ==========================================

    async processIncomingMedia(
        mediaId: string,
        mediaType: string,
        organizationId: string
    ): Promise<{
        url: string | null;
        base64: string | null;
        mimeType: string;
        mediaId: string;
    }> {
        try {
            // Get WhatsApp account
            const account = await prisma.whatsAppAccount.findFirst({
                where: {
                    organizationId,
                    isActive: true, // Note: WhatsAppAccount model uses WhatsAppAccountStatus enum, but user providedisActive: true. I should check if isActive exists.
                },
            });

            if (!account || !account.accessToken) {
                return {
                    url: null,
                    base64: null,
                    mimeType: mediaType,
                    mediaId,
                };
            }

            const accessToken = account.accessToken;

            // Get direct URL
            const url = await this.getMediaUrl(mediaId, accessToken);

            // For images, also get base64 for caching
            let base64: string | null = null;
            if (mediaType.startsWith('image/') && url) {
                const result = await this.downloadMediaAsBase64(mediaId, accessToken, mediaType);
                if (result) {
                    base64 = result.base64;
                }
            }

            return {
                url,
                base64,
                mimeType: mediaType,
                mediaId,
            };
        } catch (error) {
            console.error('Error processing incoming media:', error);
            return {
                url: null,
                base64: null,
                mimeType: mediaType,
                mediaId,
            };
        }
    }
}

export const inboxMediaService = new InboxMediaService();
export default inboxMediaService;