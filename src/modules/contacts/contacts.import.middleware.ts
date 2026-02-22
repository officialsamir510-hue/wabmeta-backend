// src/modules/contacts/contacts.import.middleware.ts - COMPLETE
import { NextFunction, Request, Response } from 'express';
import { Readable } from 'stream';
import csv from 'csv-parser';

const normalizeIndianPhone = (value: unknown): string => {
    const raw = String(value ?? '').trim();

    let cleaned = raw.replace(/[\s\-\(\)]/g, '');
    cleaned = cleaned.replace(/[^0-9+]/g, '');

    if (cleaned.startsWith('+91')) cleaned = cleaned.slice(3);
    else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);

    if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);

    return cleaned;
};

const normalizeEmail = (value: unknown): string | undefined => {
    const s = String(value ?? '').trim();
    return s ? s : undefined;
};

const pick = (row: any, keys: string[]): string => {
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return String(row[k]);
    }
    // BOM-safe + case-insensitive fallback
    for (const rk of Object.keys(row || {})) {
        const norm = rk.replace(/^\uFEFF/, '').trim().toLowerCase();
        if (keys.map((x) => x.toLowerCase()).includes(norm)) return String(row[rk]);
    }
    return '';
};

/**
 * Makes /contacts/import accept:
 * 1) JSON object: { contacts: [...] }
 * 2) JSON array: [ ... ]  -> will be wrapped to { contacts: [...] }
 * 3) multipart/form-data with file -> parses CSV -> { contacts: [...] }
 */
export const contactsImportMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 1) If body is already array => wrap
        if (Array.isArray((req as any).body)) {
            (req as any).body = { contacts: (req as any).body };
            return next();
        }

        // 2) If body already has contacts array => just normalize minor things
        if ((req as any).body?.contacts && Array.isArray((req as any).body.contacts)) {
            (req as any).body.contacts = (req as any).body.contacts.map((c: any) => ({
                ...c,
                phone: normalizeIndianPhone(c.phone),
                email: normalizeEmail(c.email),
            }));
            return next();
        }

        // 3) If file provided -> parse CSV
        const file = (req as any).file as Express.Multer.File | undefined;
        if (!file?.buffer) return next(); // validation will throw "contacts required"

        const rows: any[] = [];
        await new Promise<void>((resolve, reject) => {
            Readable.from(file.buffer)
                .pipe(csv())
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
                    ? tagsRaw.split(',').map((t: string) => t.trim()).filter(Boolean)
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

        (req as any).body = {
            ...(req as any).body,
            contacts,
            skipDuplicates: (req as any).body?.skipDuplicates ?? true,
            groupId: (req as any).body?.groupId,
            tags: (req as any).body?.tags,
        };

        return next();
    } catch (err) {
        return next(err);
    }
};