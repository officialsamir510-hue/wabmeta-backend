// src/config/index.ts
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const config = {
  // App
  app: {
    name: 'WabMeta',
    env: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    port: parseInt(process.env.PORT || '5000', 10),
    apiVersion: 'v1',
    isDevelopment: process.env.NODE_ENV !== 'production',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: process.env.NODE_ENV === 'test',
  },

  // Server (for backward compatibility)
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    url: getEnv('DATABASE_URL'),
    directUrl: process.env.DIRECT_URL,
  },
  databaseUrl: getEnv('DATABASE_URL'),

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
    corsOrigins: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://wabmeta.com',
      'http://localhost:3000',
    ] as string[],
  },

  // JWT
  jwt: {
    secret: getEnv('JWT_SECRET', 'your-secret-key-change-in-production'),
    accessSecret: getEnv('JWT_ACCESS_SECRET', process.env.JWT_SECRET || 'access-secret'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', process.env.JWT_SECRET || 'refresh-secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d', // backward compatibility
  },
  jwtSecret: getEnv('JWT_SECRET', 'your-secret-key-change-in-production'),

  // Encryption
  encryption: {
    key: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),
  },
  encryptionKey: getEnv('ENCRYPTION_KEY', 'your-32-character-encryption-key!'),

  // Meta/Facebook
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    configId: process.env.META_CONFIG_ID || '',
    graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v18.0',
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:5173/meta/callback',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'webhook-verify-token',
  },

  // OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
  },

  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:5000/api/auth/facebook/callback',
  },

  // Email
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.SMTP_FROM || 'WabMeta <noreply@wabmeta.com>',
  },

  // Razorpay
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },

  // Storage
  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'local') as 'local' | 's3' | 'cloudinary',
    local: {
      uploadDir: process.env.UPLOAD_DIR || './uploads',
    },
    s3: {
      bucket: process.env.AWS_S3_BUCKET || '',
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: process.env.CLOUDINARY_API_KEY || '',
      apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },

  // System
  system: {
    maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10), // 10MB
    sessionSecret: getEnv('SESSION_SECRET', 'session-secret-change-in-production'),
  },
} as const;

export default config;