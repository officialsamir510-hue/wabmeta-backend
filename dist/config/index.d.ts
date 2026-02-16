export declare const config: {
    readonly app: {
        readonly name: "WabMeta";
        readonly env: "development" | "production" | "test";
        readonly port: number;
        readonly apiVersion: "v1";
        readonly isDevelopment: boolean;
        readonly isProduction: boolean;
        readonly isTest: boolean;
    };
    readonly port: number;
    readonly nodeEnv: "development" | "production" | "test";
    readonly database: {
        readonly url: string;
        readonly directUrl: string;
    };
    readonly databaseUrl: string;
    readonly frontendUrl: string;
    readonly frontend: {
        readonly url: string;
        readonly corsOrigins: string[];
    };
    readonly jwt: {
        readonly secret: string;
        readonly accessSecret: string;
        readonly refreshSecret: string;
        readonly accessExpiresIn: string;
        readonly refreshExpiresIn: string;
        readonly expiresIn: string;
    };
    readonly jwtSecret: string;
    readonly encryption: {
        readonly key: string;
    };
    readonly encryptionKey: string;
    readonly meta: {
        readonly appId: string;
        readonly appSecret: string;
        readonly configId: string;
        readonly graphApiVersion: string;
        readonly redirectUri: string;
        readonly webhookVerifyToken: string;
    };
    readonly google: {
        readonly clientId: string;
        readonly clientSecret: string;
        readonly callbackUrl: string;
    };
    readonly facebook: {
        readonly appId: string;
        readonly appSecret: string;
        readonly callbackUrl: string;
    };
    readonly email: {
        readonly host: string;
        readonly port: number;
        readonly secure: boolean;
        readonly auth: {
            readonly user: string;
            readonly pass: string;
        };
        readonly from: string;
    };
    readonly razorpay: {
        readonly keyId: string;
        readonly keySecret: string;
        readonly webhookSecret: string;
    };
    readonly storage: {
        readonly provider: "local" | "s3" | "cloudinary";
        readonly local: {
            readonly uploadDir: string;
        };
        readonly s3: {
            readonly bucket: string;
            readonly region: string;
            readonly accessKeyId: string;
            readonly secretAccessKey: string;
        };
        readonly cloudinary: {
            readonly cloudName: string;
            readonly apiKey: string;
            readonly apiSecret: string;
        };
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly max: number;
    };
    readonly redis: {
        readonly host: string;
        readonly port: number;
        readonly password: string | undefined;
        readonly db: number;
    };
    readonly logging: {
        readonly level: string;
        readonly file: string;
    };
    readonly system: {
        readonly maxUploadSize: number;
        readonly sessionSecret: string;
    };
};
export default config;
//# sourceMappingURL=index.d.ts.map