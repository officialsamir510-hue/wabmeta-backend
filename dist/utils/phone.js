"use strict";
// src/utils/phone.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWhatsAppRecipientIN = exports.formatFullPhone = exports.buildINPhoneVariants = exports.normalizeINNational10 = exports.digitsOnly = void 0;
const digitsOnly = (p) => String(p || '').replace(/\D/g, '');
exports.digitsOnly = digitsOnly;
/**
 * India-first: Return national 10-digit number.
 * Accepts:
 *  - "7701995867"
 *  - "+917701995867"
 *  - "917701995867"
 *  - "91917701995867" (wrong double-91) => still returns last10
 */
const normalizeINNational10 = (input) => {
    const raw = String(input || '').trim();
    if (!raw)
        return null;
    let d = (0, exports.digitsOnly)(raw).replace(/^0+/, '');
    if (!d)
        return null;
    // WhatsApp usually sends 91 + 10digits = 12 digits
    // If someone saved 91 + (91 + 10digits) = 14 digits -> take last10
    if (d.length >= 10)
        return d.slice(-10);
    return null;
};
exports.normalizeINNational10 = normalizeINNational10;
/**
 * Build lookup variants to match legacy stored phone formats in DB.
 * We search in Contact.phone using OR variants.
 */
const buildINPhoneVariants = (input) => {
    const raw = String(input || '').trim();
    if (!raw)
        return [];
    const d = (0, exports.digitsOnly)(raw).replace(/^0+/, '');
    const n10 = (0, exports.normalizeINNational10)(raw);
    const set = new Set();
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
exports.buildINPhoneVariants = buildINPhoneVariants;
/**
 * Convert stored contact fields into a safe display phone.
 * Handles legacy records where phone already contains country code.
 */
const formatFullPhone = (countryCode, phone) => {
    const cc = String(countryCode || '+91').trim() || '+91';
    const ccDigits = (0, exports.digitsOnly)(cc); // "91"
    const p = String(phone || '').trim();
    if (!p)
        return '';
    if (p.startsWith('+'))
        return p;
    const d = (0, exports.digitsOnly)(p);
    // If phone already includes cc (like 9177... or 9191...), show "+<phone>" to avoid "+91"+"9177..."
    if (ccDigits && d.startsWith(ccDigits) && d.length > 10) {
        return `+${d}`;
    }
    return `${cc}${d}`;
};
exports.formatFullPhone = formatFullPhone;
/**
 * Build WhatsApp recipient digits (E.164 digits without '+') for sending:
 * countryCode "+91" + phone "7701995867" => "917701995867"
 */
const toWhatsAppRecipientIN = (countryCode, phone) => {
    const n10 = (0, exports.normalizeINNational10)(phone);
    if (!n10)
        return null;
    const cc = (0, exports.digitsOnly)(countryCode || '+91') || '91';
    return `${cc}${n10}`;
};
exports.toWhatsAppRecipientIN = toWhatsAppRecipientIN;
//# sourceMappingURL=phone.js.map