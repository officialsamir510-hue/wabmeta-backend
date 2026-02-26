"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactsImportMiddleware = void 0;
const stream_1 = require("stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const normalizeIndianPhone = (value) => {
    const raw = String(value ?? '').trim();
    let cleaned = raw.replace(/[\s\-\(\)]/g, '');
    cleaned = cleaned.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('+91'))
        cleaned = cleaned.slice(3);
    else if (cleaned.startsWith('91') && cleaned.length === 12)
        cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0') && cleaned.length === 11)
        cleaned = cleaned.slice(1);
    return cleaned;
};
const normalizeEmail = (value) => {
    const s = String(value ?? '').trim();
    return s ? s : undefined;
};
const pick = (row, keys) => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null)
            return String(row[k]);
    }
    // BOM-safe + case-insensitive fallback
    for (const rk of Object.keys(row || {})) {
        const norm = rk.replace(/^\uFEFF/, '').trim().toLowerCase();
        if (keys.map((x) => x.toLowerCase()).includes(norm))
            return String(row[rk]);
    }
    return '';
};
/**
 * Makes /contacts/import accept:
 * 1) JSON object: { contacts: [...] }
 * 2) JSON array: [ ... ]  -> will be wrapped to { contacts: [...] }
 * 3) multipart/form-data with file -> parses CSV -> { contacts: [...] }
 */
const contactsImportMiddleware = async (req, res, next) => {
    try {
        // 1) If body is already array => wrap
        if (Array.isArray(req.body)) {
            req.body = { contacts: req.body };
            return next();
        }
        // 2) If body already has contacts array => just normalize minor things
        if (req.body?.contacts && Array.isArray(req.body.contacts)) {
            req.body.contacts = req.body.contacts.map((c) => ({
                ...c,
                phone: normalizeIndianPhone(c.phone),
                email: normalizeEmail(c.email),
            }));
            return next();
        }
        // 3) If file provided -> parse CSV
        const file = req.file;
        if (!file?.buffer)
            return next(); // validation will throw "contacts required"
        const rows = [];
        await new Promise((resolve, reject) => {
            stream_1.Readable.from(file.buffer)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => rows.push(row))
                .on('end', () => resolve())
                .on('error', (err) => reject(err));
        });
        const contacts = rows
            .map((row) => {
            const phoneRaw = pick(row, ['phone', 'mobile', 'number', 'phone_number', 'phonenumber', 'phone number']);
            const firstName = pick(row, ['firstName', 'first_name', 'firstname', 'name', 'full_name', 'fullname']);
            const lastName = pick(row, ['lastName', 'last_name', 'lastname']);
            const email = pick(row, ['email', 'mail']);
            const tagsRaw = pick(row, ['tags', 'tag']);
            const tags = tagsRaw
                ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
                : undefined;
            return {
                phone: normalizeIndianPhone(phoneRaw),
                firstName: String(firstName || '').trim() || undefined,
                lastName: String(lastName || '').trim() || undefined,
                email: normalizeEmail(email),
                tags,
            };
        })
            .filter((c) => c.phone);
        req.body = {
            ...req.body,
            contacts,
            skipDuplicates: req.body?.skipDuplicates ?? true,
            groupId: req.body?.groupId,
            tags: req.body?.tags,
        };
        return next();
    }
    catch (err) {
        return next(err);
    }
};
exports.contactsImportMiddleware = contactsImportMiddleware;
//# sourceMappingURL=contacts.import.middleware.js.map