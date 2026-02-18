// src/utils/phone.ts

export const digitsOnly = (p: string): string => String(p || '').replace(/\D/g, '');

/**
 * India-first: Return national 10-digit number.
 * Accepts:
 *  - "7701995867"
 *  - "+917701995867"
 *  - "917701995867"
 *  - "91917701995867" (wrong double-91) => still returns last10
 */
export const normalizeINNational10 = (input?: string): string | null => {
    const raw = String(input || '').trim();
    if (!raw) return null;

    let d = digitsOnly(raw).replace(/^0+/, '');
    if (!d) return null;

    // WhatsApp usually sends 91 + 10digits = 12 digits
    // If someone saved 91 + (91 + 10digits) = 14 digits -> take last10
    if (d.length >= 10) return d.slice(-10);

    return null;
};

/**
 * Build lookup variants to match legacy stored phone formats in DB.
 * We search in Contact.phone using OR variants.
 */
export const buildINPhoneVariants = (input?: string): string[] => {
    const raw = String(input || '').trim();
    if (!raw) return [];

    const d = digitsOnly(raw).replace(/^0+/, '');
    const n10 = normalizeINNational10(raw);

    const set = new Set<string>();

    // Raw variants (in case DB has raw)
    if (d) {
        set.add(d);
        set.add(`+${d}`);
    }

    // Canonical national 10
    if (n10) {
        set.add(n10);
        set.add(`+${n10}`);

        // with country code
        set.add(`91${n10}`);
        set.add(`+91${n10}`);

        // wrong double-cc stored variant
        set.add(`9191${n10}`);
        set.add(`+9191${n10}`);
    }

    return Array.from(set).filter(Boolean);
};

/**
 * Convert stored contact fields into a safe display phone.
 * Handles legacy records where phone already contains country code.
 */
export const formatFullPhone = (countryCode?: string, phone?: string): string => {
    const cc = String(countryCode || '+91').trim() || '+91';
    const ccDigits = digitsOnly(cc); // "91"
    const p = String(phone || '').trim();

    if (!p) return '';
    if (p.startsWith('+')) return p;

    const d = digitsOnly(p);

    // If phone already includes cc (like 9177... or 9191...), show "+<phone>" to avoid "+91"+"9177..."
    if (ccDigits && d.startsWith(ccDigits) && d.length > 10) {
        return `+${d}`;
    }

    return `${cc}${d}`;
};

/**
 * Build WhatsApp recipient digits (E.164 digits without '+') for sending:
 * countryCode "+91" + phone "7701995867" => "917701995867"
 */
export const toWhatsAppRecipientIN = (countryCode?: string, phone?: string): string | null => {
    const n10 = normalizeINNational10(phone);
    if (!n10) return null;

    const cc = digitsOnly(countryCode || '+91') || '91';
    return `${cc}${n10}`;
};