"use strict";
// src/modules/campaigns/campaigns.upload.service.ts - COMPLETE FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.campaignUploadService = exports.CampaignUploadService = void 0;
const stream_1 = require("stream");
const csv_parser_1 = __importDefault(require("csv-parser"));
const uuid_1 = require("uuid");
const campaigns_socket_1 = require("./campaigns.socket");
const database_1 = __importDefault(require("../../config/database"));
class CampaignUploadService {
    // ----------------------------
    // Helpers
    // ----------------------------
    getValueByPossibleHeaders(row, headers) {
        // direct match
        for (const h of headers) {
            if (row[h] !== undefined && row[h] !== null)
                return String(row[h]);
        }
        // fallback: case-insensitive + BOM safe
        const keys = Object.keys(row || {});
        for (const key of keys) {
            const k = key.replace(/^\uFEFF/, '').trim().toLowerCase();
            if (headers.map(h => h.toLowerCase()).includes(k)) {
                return String(row[key]);
            }
        }
        return '';
    }
    normalizeIndianPhone(value) {
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
    }
    isValidIndian10Digit(phone10) {
        return /^[6-9]\d{9}$/.test(phone10);
    }
    normalizeEmail(value) {
        const s = String(value ?? '').trim();
        if (!s)
            return undefined;
        // basic email check
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
        return ok ? s : undefined;
    }
    // ----------------------------
    // Process CSV
    // ----------------------------
    async processCsvFile(fileBuffer, userId, organizationId) {
        const uploadId = (0, uuid_1.v4)();
        const rows = [];
        const validationResults = [];
        return new Promise((resolve, reject) => {
            const stream = stream_1.Readable.from(fileBuffer);
            let totalRows = 0;
            let processedRows = 0;
            let validRows = 0;
            let invalidRows = 0;
            let duplicateRows = 0;
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                rows.push(row);
                totalRows++;
            })
                .on('end', async () => {
                console.log(`📊 CSV parsed: ${totalRows} rows`);
                // Emit initial progress
                campaigns_socket_1.campaignSocketService?.emitCsvUploadProgress?.(userId, {
                    uploadId,
                    progress: 0,
                    totalRows,
                    processedRows: 0,
                    validRows: 0,
                    invalidRows: 0,
                    duplicateRows: 0,
                    status: 'processing',
                });
                // ✅ Normalize existing phones to 10-digit
                const existingContacts = await database_1.default.contact.findMany({
                    where: { organizationId },
                    select: { phone: true, countryCode: true },
                });
                const existingPhones10 = new Set(existingContacts
                    .map((c) => this.normalizeIndianPhone(c.phone))
                    .filter((p) => p && p.length === 10));
                const seenPhones10 = new Set();
                for (const row of rows) {
                    const result = this.validateContact(row, existingPhones10, seenPhones10);
                    validationResults.push(result);
                    if (result.isValid && !result.isDuplicate) {
                        validRows++;
                        seenPhones10.add(result.phone);
                    }
                    else if (result.isDuplicate) {
                        duplicateRows++;
                    }
                    else {
                        invalidRows++;
                    }
                    processedRows++;
                    if (processedRows % 10 === 0 || processedRows === totalRows) {
                        const progress = Math.round((processedRows / totalRows) * 100);
                        campaigns_socket_1.campaignSocketService?.emitCsvUploadProgress?.(userId, {
                            uploadId,
                            progress,
                            totalRows,
                            processedRows,
                            validRows,
                            invalidRows,
                            duplicateRows,
                            status: processedRows === totalRows ? 'completed' : 'processing',
                        });
                        if (processedRows % 50 === 0 || processedRows === totalRows) {
                            const batch = validationResults.slice(-50);
                            campaigns_socket_1.campaignSocketService?.emitContactValidation?.(userId, {
                                uploadId,
                                contacts: batch,
                            });
                        }
                    }
                }
                // ✅ Create contacts in DB (only valid & not duplicate)
                const toCreate = validationResults
                    .filter((r) => r.isValid && !r.isDuplicate)
                    .map((r) => ({
                    organizationId,
                    phone: r.phone, // ✅ store 10-digit
                    countryCode: '+91',
                    firstName: (r.firstName || r.name || 'Unknown').trim() || 'Unknown',
                    lastName: r.lastName?.trim() || undefined,
                    email: r.email || undefined, // ✅ optional
                    source: 'CSV_UPLOAD',
                    status: 'ACTIVE',
                }))
                    .map((c) => {
                    // remove undefined keys for createMany safety
                    const clean = { ...c };
                    Object.keys(clean).forEach((k) => clean[k] === undefined && delete clean[k]);
                    return clean;
                });
                if (toCreate.length > 0) {
                    await database_1.default.contact.createMany({
                        data: toCreate,
                        skipDuplicates: true,
                    });
                }
                // Fetch created contacts
                const createdContacts = await database_1.default.contact.findMany({
                    where: {
                        organizationId,
                        phone: { in: toCreate.map((c) => c.phone) },
                    },
                    select: { id: true, phone: true, firstName: true },
                });
                resolve({
                    uploadId,
                    totalRows,
                    validRows,
                    invalidRows,
                    duplicateRows,
                    contacts: createdContacts.map((c) => ({
                        id: c.id,
                        phone: c.phone,
                        firstName: c.firstName || 'Unknown',
                    })),
                });
            })
                .on('error', (error) => {
                console.error('❌ CSV parsing error:', error);
                campaigns_socket_1.campaignSocketService?.emitCsvUploadProgress?.(userId, {
                    uploadId,
                    progress: 0,
                    totalRows: 0,
                    processedRows: 0,
                    validRows: 0,
                    invalidRows: 0,
                    duplicateRows: 0,
                    status: 'failed',
                });
                reject(error);
            });
        });
    }
    /**
     * Validate individual contact
     */
    validateContact(row, existingPhones10, seenPhones10) {
        // ✅ More header support
        const phoneRaw = this.getValueByPossibleHeaders(row, [
            'phone',
            'mobile',
            'number',
            'phone_number',
            'phonenumber',
            'phone number',
            'whatsapp',
            'whatsapp_number',
        ]);
        const nameRaw = this.getValueByPossibleHeaders(row, [
            'name',
            'fullname',
            'full_name',
            'firstName',
            'first_name',
        ]);
        const firstNameRaw = this.getValueByPossibleHeaders(row, ['firstName', 'first_name']);
        const lastNameRaw = this.getValueByPossibleHeaders(row, ['lastName', 'last_name']);
        const emailRaw = this.getValueByPossibleHeaders(row, ['email', 'Email', 'mail']);
        if (!phoneRaw || !String(phoneRaw).trim()) {
            return {
                phone: '',
                name: nameRaw?.trim(),
                isValid: false,
                isDuplicate: false,
                error: 'Phone number is required (header must be phone/mobile/number)',
            };
        }
        const phone10 = this.normalizeIndianPhone(phoneRaw);
        if (!this.isValidIndian10Digit(phone10)) {
            return {
                phone: phone10,
                name: nameRaw?.trim(),
                firstName: firstNameRaw?.trim() || undefined,
                lastName: lastNameRaw?.trim() || undefined,
                email: this.normalizeEmail(emailRaw),
                isValid: false,
                isDuplicate: false,
                error: 'Invalid Indian phone (must be 10 digits starting with 6-9)',
            };
        }
        // Duplicate checks
        if (existingPhones10.has(phone10)) {
            return {
                phone: phone10,
                name: nameRaw?.trim(),
                firstName: firstNameRaw?.trim() || undefined,
                lastName: lastNameRaw?.trim() || undefined,
                email: this.normalizeEmail(emailRaw),
                isValid: true,
                isDuplicate: true,
                error: 'Already exists in contacts',
            };
        }
        if (seenPhones10.has(phone10)) {
            return {
                phone: phone10,
                name: nameRaw?.trim(),
                firstName: firstNameRaw?.trim() || undefined,
                lastName: lastNameRaw?.trim() || undefined,
                email: this.normalizeEmail(emailRaw),
                isValid: true,
                isDuplicate: true,
                error: 'Duplicate in uploaded file',
            };
        }
        return {
            phone: phone10,
            name: nameRaw?.trim(),
            firstName: firstNameRaw?.trim() || undefined,
            lastName: lastNameRaw?.trim() || undefined,
            email: this.normalizeEmail(emailRaw),
            isValid: true,
            isDuplicate: false,
        };
    }
    getTemplateHeaders() {
        return ['phone', 'firstName', 'lastName', 'email', 'tags'];
    }
    async validateCsvFile(fileBuffer) {
        const rows = [];
        return new Promise((resolve, reject) => {
            const stream = stream_1.Readable.from(fileBuffer);
            let totalRows = 0;
            let validRows = 0;
            let invalidRows = 0;
            let duplicateRows = 0;
            const existingPhones10 = new Set(); // validation-only
            const seenPhones10 = new Set();
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                rows.push(row);
                totalRows++;
            })
                .on('end', () => {
                for (const row of rows) {
                    const result = this.validateContact(row, existingPhones10, seenPhones10);
                    if (result.isValid && !result.isDuplicate) {
                        validRows++;
                        seenPhones10.add(result.phone);
                    }
                    else if (result.isDuplicate) {
                        duplicateRows++;
                    }
                    else {
                        invalidRows++;
                    }
                }
                resolve({ totalRows, validRows, invalidRows, duplicateRows });
            })
                .on('error', (error) => reject(error));
        });
    }
}
exports.CampaignUploadService = CampaignUploadService;
exports.campaignUploadService = new CampaignUploadService();
//# sourceMappingURL=campaigns.upload.service.js.map