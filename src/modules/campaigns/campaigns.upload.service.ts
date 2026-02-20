// src/modules/campaigns/campaigns.upload.service.ts

import { Readable } from 'stream';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { campaignSocketService } from './campaigns.socket';
import prisma from '../../config/database';

interface CsvRow {
    phone: string;
    name?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    [key: string]: any;
}

interface ValidationResult {
    phone: string;
    name?: string;
    isValid: boolean;
    isDuplicate: boolean;
    error?: string;
}

export class CampaignUploadService {
    /**
     * ✅ Process CSV with real-time progress
     */
    async processCsvFile(
        fileBuffer: Buffer,
        userId: string,
        organizationId: string
    ): Promise<{
        uploadId: string;
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
        contacts: Array<{ id: string; phone: string; firstName: string }>;
    }> {
        const uploadId = uuidv4();
        const rows: CsvRow[] = [];
        const validationResults: ValidationResult[] = [];

        return new Promise((resolve, reject) => {
            const stream = Readable.from(fileBuffer);

            let totalRows = 0;
            let processedRows = 0;
            let validRows = 0;
            let invalidRows = 0;
            let duplicateRows = 0;

            stream
                .pipe(csv())
                .on('data', (row: CsvRow) => {
                    rows.push(row);
                    totalRows++;
                })
                .on('end', async () => {
                    console.log(`📊 CSV parsed: ${totalRows} rows`);

                    // ✅ Emit initial progress
                    if (campaignSocketService) {
                        campaignSocketService.emitCsvUploadProgress(userId, {
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
                    const existingContacts = await prisma.contact.findMany({
                        where: { organizationId },
                        select: { phone: true },
                    });

                    const existingPhones = new Set(existingContacts.map((c) => c.phone));
                    const seenPhones = new Set<string>();

                    // Process each row
                    for (const row of rows) {
                        const result = this.validateContact(row, existingPhones, seenPhones);
                        validationResults.push(result);

                        if (result.isValid && !result.isDuplicate) {
                            validRows++;
                            seenPhones.add(result.phone);
                        } else if (result.isDuplicate) {
                            duplicateRows++;
                        } else {
                            invalidRows++;
                        }

                        processedRows++;

                        // Emit progress every 10 rows
                        if (processedRows % 10 === 0 || processedRows === totalRows) {
                            const progress = Math.round((processedRows / totalRows) * 100);

                            if (campaignSocketService) {
                                campaignSocketService.emitCsvUploadProgress(userId, {
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
                                if (campaignSocketService) {
                                    campaignSocketService.emitContactValidation(userId, {
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
                            source: 'CSV_UPLOAD' as const,
                            status: 'ACTIVE' as const,
                        }));

                    await prisma.contact.createMany({
                        data: validContactsData,
                        skipDuplicates: true,
                    });

                    // ✅ Fetch created contacts to get their IDs
                    const createdContacts = await prisma.contact.findMany({
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
                .on('error', (error: any) => {
                    console.error('❌ CSV parsing error:', error);

                    if (campaignSocketService) {
                        campaignSocketService.emitCsvUploadProgress(userId, {
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
    private validateContact(
        row: CsvRow,
        existingPhones: Set<string>,
        seenPhones: Set<string>
    ): ValidationResult {
        // Extract phone
        const phone = (
            row.phone ||
            row.Phone ||
            row.mobile ||
            row.Mobile ||
            row.number ||
            row.Number ||
            ''
        ).toString().trim();

        // Extract name
        const name = (
            row.name ||
            row.Name ||
            row.firstName ||
            row.first_name ||
            ''
        ).toString().trim();

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
    getTemplateHeaders(): string[] {
        return ['phone', 'firstName', 'lastName', 'email', 'tags'];
    }

    /**
     * Validate CSV file
     */
    async validateCsvFile(fileBuffer: Buffer): Promise<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
    }> {
        const rows: CsvRow[] = [];
        return new Promise((resolve, reject) => {
            const stream = Readable.from(fileBuffer);
            let totalRows = 0;
            let validRows = 0;
            let invalidRows = 0;
            let duplicateRows = 0;
            const existingPhones = new Set<string>(); // Mock for validation only
            const seenPhones = new Set<string>();

            stream
                .pipe(csv())
                .on('data', (row: CsvRow) => {
                    rows.push(row);
                    totalRows++;
                })
                .on('end', () => {
                    for (const row of rows) {
                        const result = this.validateContact(row, existingPhones, seenPhones);
                        if (result.isValid && !result.isDuplicate) {
                            validRows++;
                            seenPhones.add(result.phone);
                        } else if (result.isDuplicate) {
                            duplicateRows++;
                        } else {
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
                .on('error', (error: any) => reject(error));
        });
    }
}

export const campaignUploadService = new CampaignUploadService();