export declare class CampaignUploadService {
    private getValueByPossibleHeaders;
    private normalizeIndianPhone;
    private isValidIndian10Digit;
    private normalizeEmail;
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
    getTemplateHeaders(): string[];
    validateCsvFile(fileBuffer: Buffer): Promise<{
        totalRows: number;
        validRows: number;
        invalidRows: number;
        duplicateRows: number;
    }>;
}
export declare const campaignUploadService: CampaignUploadService;
//# sourceMappingURL=campaigns.upload.service.d.ts.map