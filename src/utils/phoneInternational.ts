// ✅ INTERNATIONAL COUNTRY CODES
export const COUNTRY_CODES = [
    { code: '+91', country: 'India', flag: '🇮🇳', maxLength: 10 },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸', maxLength: 10 },
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧', maxLength: 10 },
    { code: '+971', country: 'UAE', flag: '🇦🇪', maxLength: 9 },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', maxLength: 9 },
    { code: '+65', country: 'Singapore', flag: '🇸🇬', maxLength: 8 },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾', maxLength: 10 },
    { code: '+61', country: 'Australia', flag: '🇦🇺', maxLength: 9 },
    { code: '+49', country: 'Germany', flag: '🇩🇪', maxLength: 11 },
    { code: '+33', country: 'France', flag: '🇫🇷', maxLength: 9 },
    { code: '+39', country: 'Italy', flag: '🇮🇹', maxLength: 10 },
    { code: '+34', country: 'Spain', flag: '🇪🇸', maxLength: 9 },
    { code: '+81', country: 'Japan', flag: '🇯🇵', maxLength: 10 },
    { code: '+82', country: 'South Korea', flag: '🇰🇷', maxLength: 10 },
    { code: '+86', country: 'China', flag: '🇨🇳', maxLength: 11 },
    { code: '+852', country: 'Hong Kong', flag: '🇭🇰', maxLength: 8 },
    { code: '+63', country: 'Philippines', flag: '🇵🇭', maxLength: 10 },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩', maxLength: 11 },
    { code: '+66', country: 'Thailand', flag: '🇹🇭', maxLength: 9 },
    { code: '+84', country: 'Vietnam', flag: '🇻🇳', maxLength: 10 },
    { code: '+27', country: 'South Africa', flag: '🇿🇦', maxLength: 9 },
    { code: '+234', country: 'Nigeria', flag: '🇳🇬', maxLength: 10 },
    { code: '+254', country: 'Kenya', flag: '🇰🇪', maxLength: 9 },
    { code: '+55', country: 'Brazil', flag: '🇧🇷', maxLength: 11 },
    { code: '+52', country: 'Mexico', flag: '🇲🇽', maxLength: 10 },
    { code: '+7', country: 'Russia', flag: '🇷🇺', maxLength: 10 },
    { code: '+90', country: 'Turkey', flag: '🇹🇷', maxLength: 10 },
    { code: '+20', country: 'Egypt', flag: '🇪🇬', maxLength: 10 },
    { code: '+92', country: 'Pakistan', flag: '🇵🇰', maxLength: 10 },
    { code: '+880', country: 'Bangladesh', flag: '🇧🇩', maxLength: 10 },
    { code: '+94', country: 'Sri Lanka', flag: '🇱🇰', maxLength: 9 },
    { code: '+977', country: 'Nepal', flag: '🇳🇵', maxLength: 10 },
];

export interface ParsedPhone {
    isValid: boolean;
    fullNumber: string;      // +919876543210
    countryCode: string;     // +91
    nationalNumber: string;  // 9876543210
    error?: string;
}

/**
 * Parse and validate international phone number
 */
export function parsePhoneNumber(input: string, defaultCountryCode: string = '+91'): ParsedPhone {
    // Clean input
    let cleaned = String(input).replace(/[\s\-\(\)\.]/g, '').trim();

    // Empty check
    if (!cleaned) {
        return { isValid: false, fullNumber: '', countryCode: '', nationalNumber: '', error: 'Empty number' };
    }

    // If starts with +, it's already international
    if (cleaned.startsWith('+')) {
        // Find matching country code
        const matchedCountry = COUNTRY_CODES.find(c => cleaned.startsWith(c.code));

        if (matchedCountry) {
            const nationalNumber = cleaned.substring(matchedCountry.code.length);

            // Validate length (basic check: 7-15 digits)
            if (nationalNumber.length < 7 || nationalNumber.length > 15) {
                return {
                    isValid: false,
                    fullNumber: cleaned,
                    countryCode: matchedCountry.code,
                    nationalNumber,
                    error: 'Invalid phone number length'
                };
            }

            // Check if all digits
            if (!/^\d+$/.test(nationalNumber)) {
                return {
                    isValid: false,
                    fullNumber: cleaned,
                    countryCode: matchedCountry.code,
                    nationalNumber,
                    error: 'Phone number must contain only digits'
                };
            }

            return {
                isValid: true,
                fullNumber: cleaned,
                countryCode: matchedCountry.code,
                nationalNumber
            };
        }

        // Unknown country code but valid format
        const digitsOnly = cleaned.replace('+', '');
        if (digitsOnly.length >= 10 && digitsOnly.length <= 15 && /^\d+$/.test(digitsOnly)) {
            return {
                isValid: true,
                fullNumber: cleaned,
                countryCode: '+' + digitsOnly.substring(0, digitsOnly.length - 10),
                nationalNumber: digitsOnly.substring(digitsOnly.length - 10)
            };
        }

        return { isValid: false, fullNumber: cleaned, countryCode: '', nationalNumber: '', error: 'Invalid country code' };
    }

    // No + prefix - add default country code
    // Remove leading 0 if present
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
    }

    // Check if it's digits only
    if (!/^\d+$/.test(cleaned)) {
        return { isValid: false, fullNumber: '', countryCode: '', nationalNumber: '', error: 'Invalid characters' };
    }

    // Validate length (without country code)
    if (cleaned.length < 7 || cleaned.length > 12) {
        return { isValid: false, fullNumber: '', countryCode: '', nationalNumber: '', error: 'Invalid length' };
    }

    const fullNumber = defaultCountryCode + cleaned;

    return {
        isValid: true,
        fullNumber,
        countryCode: defaultCountryCode,
        nationalNumber: cleaned
    };
}

/**
 * Parse multiple phone numbers
 */
export function parseMultiplePhones(
    input: string,
    defaultCountryCode: string = '+91'
): { valid: ParsedPhone[]; invalid: { input: string; error: string }[] } {

    // Split by newline, comma, semicolon, space
    const numbers = input
        .split(/[\n,;\s]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0);

    const valid: ParsedPhone[] = [];
    const invalid: { input: string; error: string }[] = [];

    for (const num of numbers) {
        const parsed = parsePhoneNumber(num, defaultCountryCode);

        if (parsed.isValid) {
            valid.push(parsed);
        } else {
            invalid.push({ input: num, error: parsed.error || 'Invalid' });
        }
    }

    return { valid, invalid };
}
