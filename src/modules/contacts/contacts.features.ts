import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';

// ✅ UPDATED PLAN ACCESS MATRIX
const PLAN_FEATURES = {
    FREE_DEMO: {
        simpleBulkPaste: false,
        csvUpload: false
    },
    MONTHLY: {
        simpleBulkPaste: false,  // ❌ Not available
        csvUpload: true          // ✅ Available
    },
    QUARTERLY: {
        simpleBulkPaste: true,   // ✅ Available
        csvUpload: true          // ✅ Available
    },
    BIANNUAL: {
        simpleBulkPaste: true,
        csvUpload: true
    },
    ANNUAL: {
        simpleBulkPaste: true,
        csvUpload: true
    }
};

export interface FeatureAccess {
    simpleBulkPaste: boolean;
    csvUpload: boolean;
    currentPlan: string;
    upgradeRequired: boolean;
    upgradeMessage?: string;
}

export class ContactFeaturesService {

    /**
     * Get feature access for organization
     */
    async getFeatureAccess(organizationId: string): Promise<FeatureAccess> {
        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                planType: true,
                featureSimpleBulkUpload: true,
                featureCsvUpload: true,
                featureOverrideByAdmin: true
            }
        });

        if (!organization) {
            throw new AppError('Organization not found', 404);
        }

        const planType = organization.planType as keyof typeof PLAN_FEATURES;
        const planFeatures = PLAN_FEATURES[planType] || PLAN_FEATURES.FREE_DEMO;

        // ✅ Check Admin Override
        if ((organization as any).featureOverrideByAdmin) {
            return {
                simpleBulkPaste: (organization as any).featureSimpleBulkUpload ?? false,
                csvUpload: (organization as any).featureCsvUpload ?? false,
                currentPlan: planType,
                upgradeRequired: false
            };
        }

        // ✅ Return plan-based access
        const needsUpgrade = !planFeatures.simpleBulkPaste && !planFeatures.csvUpload;

        return {
            simpleBulkPaste: planFeatures.simpleBulkPaste,
            csvUpload: planFeatures.csvUpload,
            currentPlan: planType,
            upgradeRequired: needsUpgrade,
            upgradeMessage: this.getUpgradeMessage(planType, planFeatures)
        };
    }

    private getUpgradeMessage(plan: string, features: any): string | undefined {
        if (plan === 'FREE_DEMO') {
            return 'Upgrade to Monthly (₹899) for CSV Import or Quarterly (₹2,500) for all features';
        }
        if (plan === 'MONTHLY' && !features.simpleBulkPaste) {
            return 'Upgrade to Quarterly (₹2,500) to unlock Simple Bulk Paste';
        }
        return undefined;
    }

    /**
     * Validate access before operation
     */
    async validateAccess(
        organizationId: string,
        feature: 'simpleBulkPaste' | 'csvUpload'
    ): Promise<void> {
        const access = await this.getFeatureAccess(organizationId);

        if (feature === 'simpleBulkPaste' && !access.simpleBulkPaste) {
            throw new AppError(
                'Simple Bulk Paste requires Quarterly plan (₹2,500) or higher. Your current plan: ' + access.currentPlan,
                403
            );
        }

        if (feature === 'csvUpload' && !access.csvUpload) {
            throw new AppError(
                'CSV Upload requires Monthly plan (₹899) or higher. Your current plan: ' + access.currentPlan,
                403
            );
        }
    }

    /**
     * Admin: Update feature access
     */
    async adminUpdateFeatures(
        organizationId: string,
        features: {
            simpleBulkUpload?: boolean;
            csvUpload?: boolean;
            overrideByAdmin?: boolean;
        }
    ) {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId }
        });

        if (!org) {
            throw new AppError('Organization not found', 404);
        }

        const updated = await prisma.organization.update({
            where: { id: organizationId },
            data: {
                featureSimpleBulkUpload: features.simpleBulkUpload,
                featureCsvUpload: features.csvUpload,
                featureOverrideByAdmin: features.overrideByAdmin ?? true
            } as any
        });

        return {
            organizationId,
            organizationName: org.name,
            features: {
                simpleBulkUpload: (updated as any).featureSimpleBulkUpload,
                csvUpload: (updated as any).featureCsvUpload,
                overrideByAdmin: (updated as any).featureOverrideByAdmin
            }
        };
    }
}

export const contactFeaturesService = new ContactFeaturesService();
