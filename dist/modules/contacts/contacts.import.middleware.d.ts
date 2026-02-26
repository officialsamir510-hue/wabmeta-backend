import { NextFunction, Request, Response } from 'express';
/**
 * Makes /contacts/import accept:
 * 1) JSON object: { contacts: [...] }
 * 2) JSON array: [ ... ]  -> will be wrapped to { contacts: [...] }
 * 3) multipart/form-data with file -> parses CSV -> { contacts: [...] }
 */
export declare const contactsImportMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=contacts.import.middleware.d.ts.map