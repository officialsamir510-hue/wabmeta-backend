"use strict";
// src/modules/inbox/inbox.media.ts - COMPLETE
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMediaMulter = void 0;
exports.detectMediaType = detectMediaType;
exports.buildPublicFileUrl = buildPublicFileUrl;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const UPLOAD_DIR = path_1.default.join(process.cwd(), 'uploads', 'media');
function ensureUploadDir() {
    if (!fs_1.default.existsSync(UPLOAD_DIR)) {
        fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        ensureUploadDir();
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const safeBase = path_1.default
            .basename(file.originalname, path_1.default.extname(file.originalname))
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 40);
        const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        cb(null, `${safeBase}_${unique}${path_1.default.extname(file.originalname)}`);
    },
});
const fileFilter = (req, file, cb) => {
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
    if (allowed.includes(file.mimetype))
        return cb(null, true);
    return cb(new Error(`File type not allowed: ${file.mimetype}`));
};
exports.uploadMediaMulter = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB
});
function detectMediaType(mime) {
    if (mime.startsWith('image/'))
        return 'image';
    if (mime.startsWith('video/'))
        return 'video';
    if (mime.startsWith('audio/'))
        return 'audio';
    return 'document';
}
function buildPublicFileUrl(req, filename) {
    // Works behind proxy because app.set('trust proxy', 1)
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https');
    const host = req.get('host');
    return `${proto}://${host}/uploads/media/${filename}`;
}
//# sourceMappingURL=inbox.media.js.map