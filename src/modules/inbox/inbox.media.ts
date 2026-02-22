// src/modules/inbox/inbox.media.ts - COMPLETE

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { AppError } from '../../middleware/errorHandler';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'media');

function ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}

const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        ensureUploadDir();
        cb(null, UPLOAD_DIR);
    },
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        const safeBase = path
            .basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 40);

        const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        cb(null, `${safeBase}_${unique}${path.extname(file.originalname)}`);
    },
});

const fileFilter: any = (req: Request, file: Express.Multer.File, cb: any) => {
    // WhatsApp Cloud API supported types (common)
    const allowed = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'audio/mpeg',
        'audio/ogg',
        'audio/wav',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
};

export const uploadMediaMulter = multer({
    storage,
    fileFilter,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
});

export function detectMediaType(mime: string): 'image' | 'video' | 'audio' | 'document' {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
}

export function buildPublicFileUrl(req: any, filename: string): string {
    // Works behind proxy because app.set('trust proxy', 1)
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https') as string;
    const host = req.get('host');
    return `${proto}://${host}/uploads/media/${filename}`;
}