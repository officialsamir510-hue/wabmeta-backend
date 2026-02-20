declare module 'multer' {
    import { Request } from 'express';

    interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
    }

    interface FileFilterCallback {
        (error: Error | null, acceptFile: boolean): void;
        (error: Error | null): void;
    }

    interface Options {
        dest?: string;
        storage?: any;
        fileFilter?: (req: Request, file: File, callback: FileFilterCallback) => void;
        limits?: {
            fieldNameSize?: number;
            fieldSize?: number;
            fields?: number;
            fileSize?: number;
            files?: number;
            parts?: number;
            headerPairs?: number;
        };
        preservePath?: boolean;
    }

    interface Multer {
        (options?: Options): any;
        diskStorage: (options: any) => any;
        memoryStorage: () => any;
    }

    const multer: Multer;
    export = multer;
}
