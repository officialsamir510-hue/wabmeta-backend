export declare class CampaignUploadService {
    /**
     * ✅ Process CSV with real-time progress
     */
    processCsvFile(fileBuffer: Buffer, userId: string, organizationId: string): Promise<{
        uploadId: string;
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
        contacts: Array<{
            id: string;
            phone: string;
            firstName: string;
        }>;
    }>;
    /**
     * Validate individual contact
     */
    private validateContact;
    /**
     * Get CSV template headers
     */
    getTemplateHeaders(): string[];
    /**
     * Validate CSV file
     */
    validateCsvFile(fileBuffer: Buffer): Promise<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
    }>;
}
export declare const campaignUploadService: CampaignUploadService;
//# sourceMappingURL=campaigns.upload.service.d.ts.map