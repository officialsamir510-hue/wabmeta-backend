export declare const digitsOnly: (p: string) => string;
/**
 * India-first: Return national 10-digit number.
 * Accepts:
 *  - "7701995867"
 *  - "+917701995867"
 *  - "917701995867"
 *  - "91917701995867" (wrong double-91) => still returns last10
 */
export declare const normalizeINNational10: (input?: string) => string | null;
/**
 * Build lookup variants to match legacy stored phone formats in DB.
 * We search in Contact.phone using OR variants.
 */
export declare const buildINPhoneVariants: (input?: string) => string[];
/**
 * Convert stored contact fields into a safe display phone.
 * Handles legacy records where phone already contains country code.
 */
export declare const formatFullPhone: (countryCode?: string, phone?: string) => string;
/**
 * Build WhatsApp recipient digits (E.164 digits without '+') for sending:
 * countryCode "+91" + phone "7701995867" => "917701995867"
 */
export declare const toWhatsAppRecipientIN: (countryCode?: string, phone?: string) => string | null;
//# sourceMappingURL=phone.d.ts.map