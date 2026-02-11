// src/config/index.ts

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// ============================================
// ENVIRONMENT VALIDATION SCHEMA
// ============================================

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('10000'),
  API_VERSION: z.string().default('v1'),
  
  // URLs
  FRONTEND_URL: z.string().url().default('https://wabmeta.com'),
  BACKEND_URL: z.string().url().default('http://localhost:10000'),
  
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Email
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().email().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('WabMeta <noreply@wabmeta.com>'),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  
  // Meta/WhatsApp
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_CONFIG_ID: z.string().optional(),
  META_REDIRECT_URI: z.string().url().optional(),
  META_GRAPH_API_VERSION: z.string().default('v22.0'),
  META_GRAPH_API_URL: z.string().url().default('https://graph.facebook.com'),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_WEBHOOK_SECRET: z.string().optional(),
  META_WEBHOOK_URL: z.string().url().optional(),
  META_MESSAGES_PER_SECOND: z.string().default('80'),
  META_MAX_MESSAGES_PER_BATCH: z.string().default('25'),
  META_DEFAULT_LANGUAGE: z.string().default('en_US'),
  META_API_TIMEOUT: z.string().default('30000'),
  
  // Razorpay
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  
  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // File Uploads
  MAX_UPLOAD_SIZE: z.string().default('10485760'), // 10MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp,application/pdf,video/mp4,audio/mpeg'),
  
  // AWS S3 (optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_S3_BUCKET: z.string().optional(),
  
  // Cloudinary (alternative to S3)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  
  // Security
  BCRYPT_ROUNDS: z.string().default('12'),
  RATE_LIMIT_WINDOW: z.string().default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().default('100'),
  CORS_ORIGINS: z.string().default(''),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple', 'combined']).default('combined'),
  
  // Bull/Queue (for background jobs)
  QUEUE_REDIS_URL: z.string().optional(),
  
  // Sentry (Error tracking)
  SENTRY_DSN: z.string().optional(),
  
  // Analytics
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  
  // Feature Flags
  ENABLE_CHATBOT: z.string().default('true'),
  ENABLE_AUTOMATION: z.string().default('true'),
  ENABLE_CAMPAIGNS: z.string().default('true'),
  ENABLE_API_KEYS: z.string().default('true'),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      process.exit(1);
    }
    throw error;
  }
};

const env = parseEnv();

// ============================================
// CONFIGURATION OBJECT
// ============================================

export const config = {
  // ========== APP ==========
  app: {
    name: 'WabMeta',
    env: env.NODE_ENV,
    port: parseInt(env.PORT, 10),
    apiVersion: env.API_VERSION,
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },

  // ========== URLs ==========
  urls: {
    frontend: env.FRONTEND_URL,
    backend: env.BACKEND_URL,
    api: `${env.BACKEND_URL}/api/${env.API_VERSION}`,
  },

  // ========== DATABASE ==========
  database: {
    url: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
  },

  // ========== JWT ==========
  jwt: {
    secret: env.JWT_SECRET,
    accessSecret: env.JWT_ACCESS_SECRET || env.JWT_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  // ========== EMAIL ==========
  email: {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT, 10),
    secure: parseInt(env.SMTP_PORT, 10) === 465, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
    },
    from: env.EMAIL_FROM,
  },

  // ========== OAUTH ==========
  oauth: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: `${env.BACKEND_URL}/api/${env.API_VERSION}/auth/google/callback`,
    },
  },

  // ========== META/WHATSAPP ==========
  meta: {
    appId: env.META_APP_ID || '',
    appSecret: env.META_APP_SECRET || '',
    configId: env.META_CONFIG_ID || '',
    
    // OAuth URLs
    redirectUri: env.META_REDIRECT_URI || `${env.FRONTEND_URL}/meta/callback`,
    authUrl: 'https://www.facebook.com/v22.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v22.0/oauth/access_token',
    
    // API Configuration
    graphApiVersion: env.META_GRAPH_API_VERSION,
    graphApiUrl: env.META_GRAPH_API_URL,
    graphApiBaseUrl: `${env.META_GRAPH_API_URL}/${env.META_GRAPH_API_VERSION}`,
    
    // Webhook Configuration
    webhook: {
      verifyToken: env.META_WEBHOOK_VERIFY_TOKEN || '',
      secret: env.META_WEBHOOK_SECRET || '',
      url: env.META_WEBHOOK_URL || `${env.BACKEND_URL}/api/${env.API_VERSION}/webhooks/meta`,
      subscribedFields: ['messages', 'message_status', 'message_template_status_update'],
    },
    
    // Rate Limiting
    rateLimit: {
      messagesPerSecond: parseInt(env.META_MESSAGES_PER_SECOND, 10),
      maxMessagesPerBatch: parseInt(env.META_MAX_MESSAGES_PER_BATCH, 10),
    },
    
    // Defaults
    defaultLanguage: env.META_DEFAULT_LANGUAGE,
    apiTimeout: parseInt(env.META_API_TIMEOUT, 10),
    
    // OAuth Scopes
    scopes: [
      'business_management',
      'whatsapp_business_management',
      'whatsapp_business_messaging',
    ],
  },

  // ========== PAYMENT ==========
  payment: {
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID || '',
      keySecret: env.RAZORPAY_KEY_SECRET || '',
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
      enabled: !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET),
    },
  },

  // ========== REDIS ==========
  redis: {
    url: env.REDIS_URL,
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT, 10),
    password: env.REDIS_PASSWORD,
    enabled: !!env.REDIS_URL,
  },

  // ========== FILE STORAGE ==========
  storage: {
    // Local storage
    local: {
      uploadDir: 'uploads',
      publicDir: 'public',
    },
    
    // AWS S3
    s3: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: env.AWS_REGION,
      bucket: env.AWS_S3_BUCKET,
      enabled: !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET),
    },
    
    // Cloudinary
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
      enabled: !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
    },
    
    // Upload constraints
    maxSize: parseInt(env.MAX_UPLOAD_SIZE, 10),
    allowedTypes: env.ALLOWED_FILE_TYPES.split(',').map(t => t.trim()),
    
    // WhatsApp specific limits
    whatsapp: {
      image: { maxSize: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png'] }, // 5MB
      video: { maxSize: 16 * 1024 * 1024, types: ['video/mp4', 'video/3gpp'] }, // 16MB
      audio: { maxSize: 16 * 1024 * 1024, types: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'] }, // 16MB
      document: { maxSize: 100 * 1024 * 1024, types: ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] }, // 100MB
      sticker: { maxSize: 100 * 1024, types: ['image/webp'] }, // 100KB
    },
  },

  // ========== SECURITY ==========
  security: {
    bcryptRounds: parseInt(env.BCRYPT_ROUNDS, 10),
    encryptionKey: env.ENCRYPTION_KEY || '',
    
    // Rate Limiting
    rateLimit: {
      windowMs: parseInt(env.RATE_LIMIT_WINDOW, 10),
      max: parseInt(env.RATE_LIMIT_MAX, 10),
      
      // Different limits for different endpoints
      auth: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 requests per 15 minutes
      api: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
      webhook: { windowMs: 60 * 1000, max: 1000 }, // 1000 requests per minute
    },
    
    // CORS
    cors: {
      origins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map(o => o.trim()) : [env.FRONTEND_URL],
      credentials: true,
    },
    
    // Session
    session: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxDevices: 5, // Max concurrent sessions per user
    },
    
    // Password Policy
    password: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
    },
  },

  // ========== LOGGING ==========
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
    
    // Log to files in production
    file: {
      enabled: env.NODE_ENV === 'production',
      errorFile: 'logs/error.log',
      combinedFile: 'logs/combined.log',
    },
    
    // Sentry integration
    sentry: {
      dsn: env.SENTRY_DSN,
      enabled: !!env.SENTRY_DSN && env.NODE_ENV === 'production',
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    },
  },

  // ========== QUEUE/JOBS ==========
  queue: {
    redis: env.QUEUE_REDIS_URL || env.REDIS_URL,
    
    // Job options
    jobs: {
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
    },
    
    // Queue configurations
    queues: {
      email: {
        name: 'email-queue',
        concurrency: 5,
      },
      whatsapp: {
        name: 'whatsapp-queue',
        concurrency: 10,
      },
      campaign: {
        name: 'campaign-queue',
        concurrency: 3,
      },
      webhook: {
        name: 'webhook-queue',
        concurrency: 20,
      },
    },
  },

  // ========== ANALYTICS ==========
  analytics: {
    googleAnalyticsId: env.GOOGLE_ANALYTICS_ID,
  },

  // ========== FEATURE FLAGS ==========
  features: {
    chatbot: env.ENABLE_CHATBOT === 'true',
    automation: env.ENABLE_AUTOMATION === 'true',
    campaigns: env.ENABLE_CAMPAIGNS === 'true',
    apiKeys: env.ENABLE_API_KEYS === 'true',
  },

  // ========== PLANS & LIMITS ==========
  plans: {
    free: {
      maxWhatsAppAccounts: 1,
      maxContacts: 100,
      maxMessagesPerMonth: 1000,
      maxCampaignsPerMonth: 5,
      maxTeamMembers: 1,
      maxTemplates: 5,
    },
    starter: {
      maxWhatsAppAccounts: 2,
      maxContacts: 1000,
      maxMessagesPerMonth: 10000,
      maxCampaignsPerMonth: 25,
      maxTeamMembers: 3,
      maxTemplates: 20,
    },
    pro: {
      maxWhatsAppAccounts: 5,
      maxContacts: 10000,
      maxMessagesPerMonth: 100000,
      maxCampaignsPerMonth: 100,
      maxTeamMembers: 10,
      maxTemplates: 100,
    },
    business: {
      maxWhatsAppAccounts: 10,
      maxContacts: 50000,
      maxMessagesPerMonth: 500000,
      maxCampaignsPerMonth: 500,
      maxTeamMembers: 25,
      maxTemplates: 500,
    },
    enterprise: {
      maxWhatsAppAccounts: -1, // unlimited
      maxContacts: -1,
      maxMessagesPerMonth: -1,
      maxCampaignsPerMonth: -1,
      maxTeamMembers: -1,
      maxTemplates: -1,
    },
  },

  // ========== SYSTEM ==========
  system: {
    // Cleanup intervals
    cleanup: {
      expiredTokens: 24 * 60 * 60 * 1000, // 24 hours
      oldLogs: 30 * 24 * 60 * 60 * 1000, // 30 days
      webhookLogs: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
    
    // Health check
    healthCheck: {
      interval: 60 * 1000, // 1 minute
      timeout: 5000, // 5 seconds
    },
  },
} as const;

// ============================================
// TYPE EXPORTS
// ============================================

export type Config = typeof config;
export type AppEnv = typeof config.app.env;

// ============================================
// VALIDATION & STARTUP LOGGING
// ============================================

const validateConfig = () => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical validations
  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (!config.jwt.secret || config.jwt.secret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  if (!config.jwt.refreshSecret || config.jwt.refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters');
  }

  // Production-specific validations
  if (config.app.isProduction) {
    // WhatsApp/Meta
    if (!config.meta.appId) {
      errors.push('META_APP_ID is required in production');
    }
    if (!config.meta.appSecret) {
      errors.push('META_APP_SECRET is required in production');
    }
    if (!config.meta.webhook.verifyToken) {
      warnings.push('META_WEBHOOK_VERIFY_TOKEN not set - webhooks may not work');
    }

    // Email
    if (!config.email.auth.user || !config.email.auth.pass) {
      warnings.push('SMTP credentials not set - emails will not be sent');
    }

    // Security
    if (!config.security.encryptionKey) {
      warnings.push('ENCRYPTION_KEY not set - sensitive data encryption disabled');
    }

    // Storage
    if (!config.storage.s3.enabled && !config.storage.cloudinary.enabled) {
      warnings.push('No cloud storage configured - using local storage only');
    }

    // Logging
    if (!config.logging.sentry.enabled) {
      warnings.push('Sentry not configured - error tracking disabled');
    }
  }

  // Meta redirect URI validation
  if (config.meta.redirectUri) {
    try {
      const url = new URL(config.meta.redirectUri);
      if (!url.pathname.includes('/meta/callback')) {
        warnings.push('META_REDIRECT_URI should point to /meta/callback endpoint');
      }
    } catch (e) {
      errors.push('META_REDIRECT_URI is not a valid URL');
    }
  }

  // Log warnings
  warnings.forEach(w => console.warn(`⚠️  ${w}`));

  // Throw on errors
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(e => console.error(`   - ${e}`));
    if (config.app.isProduction) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  return { errors, warnings };
};

const logConfig = () => {
  if (config.app.isTest) return;

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║               🚀 WabMeta Backend Starting                 ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║ Environment:        ${config.app.env.toUpperCase().padEnd(36)} ║`);
  console.log(`║ Port:               ${String(config.app.port).padEnd(36)} ║`);
  console.log(`║ API Version:        ${config.app.apiVersion.padEnd(36)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 🌐 URLs                                                   ║');
  console.log(`║ Frontend:           ${config.urls.frontend.substring(0, 36).padEnd(36)} ║`);
  console.log(`║ Backend:            ${config.urls.backend.substring(0, 36).padEnd(36)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 🔌 Services                                               ║');
  console.log(`║ Database:           ${(config.database.url ? '✅ Connected' : '❌ Missing').padEnd(36)} ║`);
  console.log(`║ Redis:              ${(config.redis.enabled ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log(`║ Email:              ${(config.email.auth.user ? '✅ Configured' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 📱 WhatsApp/Meta                                          ║');
  console.log(`║ App ID:             ${(config.meta.appId ? '✅ Set' : '❌ Missing').padEnd(36)} ║`);
  console.log(`║ App Secret:         ${(config.meta.appSecret ? '✅ Set' : '❌ Missing').padEnd(36)} ║`);
  console.log(`║ Graph API:          ${config.meta.graphApiVersion.padEnd(36)} ║`);
  console.log(`║ Webhook:            ${(config.meta.webhook.verifyToken ? '✅ Configured' : '⚠️  Missing').padEnd(36)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 💳 Payment                                                ║');
  console.log(`║ Razorpay:           ${(config.payment.razorpay.enabled ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 📦 Storage                                                ║');
  console.log(`║ AWS S3:             ${(config.storage.s3.enabled ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log(`║ Cloudinary:         ${(config.storage.cloudinary.enabled ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 🔐 Security                                               ║');
  console.log(`║ Encryption:         ${(config.security.encryptionKey ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log(`║ Rate Limiting:      ✅ Enabled${' '.repeat(27)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 📊 Monitoring                                             ║');
  console.log(`║ Sentry:             ${(config.logging.sentry.enabled ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log(`║ Log Level:          ${config.logging.level.padEnd(36)} ║`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ ⚙️  Features                                              ║');
  console.log(`║ Chatbot:            ${(config.features.chatbot ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log(`║ Automation:         ${(config.features.automation ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log(`║ Campaigns:          ${(config.features.campaigns ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log(`║ API Keys:           ${(config.features.apiKeys ? '✅ Enabled' : '⚠️  Disabled').padEnd(36)} ║`);
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
};

// Run validation and logging on import (except in tests)
if (!config.app.isTest) {
  const { errors, warnings } = validateConfig();
  logConfig();
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Configuration validated successfully!\n');
  } else if (warnings.length > 0 && errors.length === 0) {
    console.log(`⚠️  Configuration loaded with ${warnings.length} warning(s)\n`);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getConfig = () => config;

export const isProduction = () => config.app.isProduction;
export const isDevelopment = () => config.app.isDevelopment;
export const isTest = () => config.app.isTest;

export const getMetaGraphUrl = (path: string) => {
  return `${config.meta.graphApiBaseUrl}${path}`;
};

export const getPlanLimits = (planType: keyof typeof config.plans) => {
  return config.plans[planType];
};

// ============================================
// EXPORTS
// ============================================

export default config;