"use strict";
// src/modules/campaigns/campaigns.upload.service.ts
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
    /**
     * ✅ Process CSV with real-time progress
     */
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
                // ✅ Emit initial progress
                if (campaigns_socket_1.campaignSocketService) {
                    campaigns_socket_1.campaignSocketService.emitCsvUploadProgress(userId, {
                        uploadId,
                        progress: 0,
                        totalRows,
                        processedRows: 0,
                        validRows: 0,
                        invalidRows: 0,
                        duplicateRows: 0,
                        status: 'processing',
                    });
                }
                // Get existing phone numbers
                const existingContacts = await database_1.default.contact.findMany({
                    where: { organizationId },
                    select: { phone: true },
                });
                const existingPhones = new Set(existingContacts.map((c) => c.phone));
                const seenPhones = new Set();
                // Process each row
                for (const row of rows) {
                    const result = this.validateContact(row, existingPhones, seenPhones);
                    validationResults.push(result);
                    if (result.isValid && !result.isDuplicate) {
                        validRows++;
                        seenPhones.add(result.phone);
                    }
                    else if (result.isDuplicate) {
                        duplicateRows++;
                    }
                    else {
                        invalidRows++;
                    }
                    processedRows++;
                    // Emit progress every 10 rows
                    if (processedRows % 10 === 0 || processedRows === totalRows) {
                        const progress = Math.round((processedRows / totalRows) * 100);
                        if (campaigns_socket_1.campaignSocketService) {
                            campaigns_socket_1.campaignSocketService.emitCsvUploadProgress(userId, {
                                uploadId,
                                progress,
                                totalRows,
                                processedRows,
                                validRows,
                                invalidRows,
                                duplicateRows,
                                status: processedRows === totalRows ? 'completed' : 'processing',
                            });
                        }
                        // Emit validation batch
                        if (processedRows % 50 === 0 || processedRows === totalRows) {
                            const batch = validationResults.slice(-50);
                            if (campaigns_socket_1.campaignSocketService) {
                                campaigns_socket_1.campaignSocketService.emitContactValidation(userId, {
                                    uploadId,
                                    contacts: batch,
                                });
                            }
                        }
                    }
                }
                // ✅ Create contacts in database
                const validContactsData = validationResults
                    .filter((r) => r.isValid && !r.isDuplicate)
                    .map((r) => ({
                    organizationId,
                    phone: r.phone,
                    firstName: r.name || 'Unknown',
                    source: 'CSV_UPLOAD',
                    status: 'ACTIVE',
                }));
                await database_1.default.contact.createMany({
                    data: validContactsData,
                    skipDuplicates: true,
                });
                // ✅ Fetch created contacts to get their IDs
                const createdContacts = await database_1.default.contact.findMany({
                    where: {
                        organizationId,
                        phone: {
                            in: validContactsData.map((c) => c.phone),
                        },
                    },
                    select: {
                        id: true,
                        phone: true,
                        firstName: true,
                    },
                });
                console.log(`✅ Created/Found ${createdContacts.length} contacts`);
                resolve({
                    uploadId,
                    totalRows,
                    validRows,
                    invalidRows,
                    duplicateRows,
                    contacts: createdContacts.map(c => ({
                        id: c.id,
                        phone: c.phone,
                        firstName: c.firstName || 'Unknown'
                    })),
                });
            })
                .on('error', (error) => {
                console.error('❌ CSV parsing error:', error);
                if (campaigns_socket_1.campaignSocketService) {
                    campaigns_socket_1.campaignSocketService.emitCsvUploadProgress(userId, {
                        uploadId,
                        progress: 0,
                        totalRows: 0,
                        processedRows: 0,
                        validRows: 0,
                        invalidRows: 0,
                        duplicateRows: 0,
                        status: 'failed',
                    });
                }
                reject(error);
            });
        });
    }
    /**
     * Validate individual contact
     */
    validateContact(row, existingPhones, seenPhones) {
        // Extract phone
        const phone = (row.phone ||
            row.Phone ||
            row.mobile ||
            row.Mobile ||
            row.number ||
            row.Number ||
            '').toString().trim();
        // Extract name
        const name = (row.name ||
            row.Name ||
            row.firstName ||
            row.first_name ||
            '').toString().trim();
        if (!phone) {
            return {
                phone: '',
                name,
                isValid: false,
                isDuplicate: false,
                error: 'Phone number is required',
            };
        }
        // Clean phone
        const cleanPhone = phone.replace(/[^0-9+]/g, '');
        if (cleanPhone.length < 10 || cleanPhone.length > 15) {
            return {
                phone: cleanPhone,
                name,
                isValid: false,
                isDuplicate: false,
                error: 'Invalid phone number format',
            };
        }
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
        // Check duplicates
        if (existingPhones.has(formattedPhone)) {
            return {
                phone: formattedPhone,
                name,
                isValid: true,
                isDuplicate: true,
                error: 'Already exists in contacts',
            };
        }
        if (seenPhones.has(formattedPhone)) {
            return {
                phone: formattedPhone,
                name,
                isValid: true,
                isDuplicate: true,
                error: 'Duplicate in uploaded file',
            };
        }
        return {
            phone: formattedPhone,
            name,
            isValid: true,
            isDuplicate: false,
        };
    }
    /**
     * Get CSV template headers
     */
    getTemplateHeaders() {
        return ['phone', 'firstName', 'lastName', 'email', 'tags'];
    }
    /**
     * Validate CSV file
     */
    async validateCsvFile(fileBuffer) {
        const rows = [];
        return new Promise((resolve, reject) => {
            const stream = stream_1.Readable.from(fileBuffer);
            let totalRows = 0;
            let validRows = 0;
            let invalidRows = 0;
            let duplicateRows = 0;
            const existingPhones = new Set(); // Mock for validation only
            const seenPhones = new Set();
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                rows.push(row);
                totalRows++;
            })
                .on('end', () => {
                for (const row of rows) {
                    const result = this.validateContact(row, existingPhones, seenPhones);
                    if (result.isValid && !result.isDuplicate) {
                        validRows++;
                        seenPhones.add(result.phone);
                    }
                    else if (result.isDuplicate) {
                        duplicateRows++;
                    }
                    else {
                        invalidRows++;
                    }
                }
                resolve({
                    totalRows,
                    validRows,
                    invalidRows,
                    duplicateRows
                });
            })
                .on('error', (error) => reject(error));
        });
    }
}
exports.CampaignUploadService = CampaignUploadService;
exports.campaignUploadService = new CampaignUploadService();
//# sourceMappingURL=campaigns.upload.service.js.map