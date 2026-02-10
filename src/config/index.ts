// src/config/index.ts

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // App
  nodeEnv: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  port: parseInt(process.env.PORT || '10000', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  
  // Frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'https://wabmeta.com',
  
  // Backend URL (for OAuth callbacks)
  backendUrl: process.env.BACKEND_URL || 'http://localhost:10000',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || '',
  
  // JWT - Nested structure for compatibility
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    accessSecret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'your-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  
  // Also keep flat structure for backward compatibility
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  
  // Email - Nested structure
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'WabMeta <noreply@wabmeta.com>',
  },
  
  // Also keep smtp for backward compatibility
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'WabMeta <noreply@wabmeta.com>',
  },
  
  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  
  // ✅ Meta/WhatsApp - OPTIMIZED Configuration
  meta: {
    // App credentials
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    
    // ✅ OAuth redirect URI - Points to frontend callback page
    redirectUri: process.env.META_REDIRECT_URI || 
      `${process.env.FRONTEND_URL || 'https://wabmeta.com'}/meta/callback`,
    
    // ✅ Config ID (optional - only needed for Embedded Signup)
    configId: process.env.META_CONFIG_ID || '',
    
    // ✅ API Version - Using latest stable
    graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v22.0',
    graphApiUrl: process.env.META_GRAPH_API_URL || 'https://graph.facebook.com',
    
    // ✅ Webhooks - Points to backend webhook endpoint
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    webhookSecret: process.env.META_WEBHOOK_SECRET || '', // For signature verification
    
    // Webhook URL (for Meta dashboard configuration)
    webhookUrl: process.env.META_WEBHOOK_URL || 
      `${process.env.BACKEND_URL || 'https://wabmeta-api.onrender.com'}/webhooks/meta`,
    
    // Rate limiting
    messagesPerSecond: parseInt(process.env.META_MESSAGES_PER_SECOND || '80', 10),
    maxMessagesPerBatch: parseInt(process.env.META_MAX_MESSAGES_PER_BATCH || '25', 10),
    
    // Template defaults
    defaultLanguage: process.env.META_DEFAULT_LANGUAGE || 'en_US',
    
    // Timeouts
    apiTimeout: parseInt(process.env.META_API_TIMEOUT || '30000', 10),
  },
  
  // Razorpay
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  
  // Redis (for caching/queues - future use)
  redis: {
    url: process.env.REDIS_URL || '',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  
  // File uploads
  upload: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10), // 10MB default
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/webp,application/pdf,video/mp4,audio/mpeg').split(','),
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
};

// Type export for config
export type Config = typeof config;

// Validate required config on startup
const validateConfig = () => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Critical errors
  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }
  
  // Warnings for development
  if (!config.jwt.secret || config.jwt.secret === 'your-secret-key') {
    warnings.push('Using default JWT secret. Set JWT_SECRET in production!');
  }
  
  // Production-specific checks
  if (config.nodeEnv === 'production') {
    if (!config.meta.appId) {
      errors.push('META_APP_ID is required for WhatsApp features');
    }
    if (!config.meta.appSecret) {
      errors.push('META_APP_SECRET is required for WhatsApp OAuth');
    }
    if (!config.meta.webhookVerifyToken) {
      warnings.push('META_WEBHOOK_VERIFY_TOKEN not set - Webhooks will not work');
    }
    if (!config.email.user || !config.email.pass) {
      warnings.push('SMTP credentials not set - Email features will not work');
    }
  }
  
  // ✅ Validate Meta redirect URI format
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
  warnings.forEach(w => console.warn(`⚠️ Warning: ${w}`));
  
  // Throw on critical errors
  if (errors.length > 0) {
    console.error('❌ Configuration errors:', errors);
    if (config.nodeEnv === 'production') {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
};

// Log config on startup (for debugging)
if (process.env.NODE_ENV !== 'test') {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║           📝 WabMeta Configuration             ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║ Environment:     ${config.nodeEnv.padEnd(28)}║`);
  console.log(`║ Port:            ${String(config.port).padEnd(28)}║`);
  console.log(`║ API Version:     ${config.apiVersion.padEnd(28)}║`);
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║ URLs                                           ║');
  console.log(`║ Frontend:        ${config.frontendUrl.substring(0, 28).padEnd(28)}║`);
  console.log(`║ Backend:         ${config.backendUrl.substring(0, 28).padEnd(28)}║`);
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║ Services Status                                ║');
  console.log(`║ Database:        ${config.databaseUrl ? '✅ Configured'.padEnd(28) : '❌ Missing'.padEnd(28)}║`);
  console.log(`║ JWT Secret:      ${(config.jwt.secret && config.jwt.secret !== 'your-secret-key' ? '✅ Set' : '⚠️ Default').padEnd(28)}║`);
  console.log(`║ Email (SMTP):    ${(config.email.user ? '✅ Configured' : '⚠️ Missing').padEnd(28)}║`);
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║ Meta/WhatsApp Configuration                    ║');
  console.log(`║ App ID:          ${(config.meta.appId ? '✅ Set' : '❌ Missing').padEnd(28)}║`);
  console.log(`║ App Secret:      ${(config.meta.appSecret ? '✅ Set' : '❌ Missing').padEnd(28)}║`);
  console.log(`║ Config ID:       ${(config.meta.configId ? '✅ Set' : '⚠️ Optional').padEnd(28)}║`);
  console.log(`║ Redirect URI:    ${config.meta.redirectUri.substring(0, 28).padEnd(28)}║`);
  console.log(`║ Webhook Token:   ${(config.meta.webhookVerifyToken ? '✅ Set' : '⚠️ Missing').padEnd(28)}║`);
  console.log(`║ Graph API:       ${config.meta.graphApiVersion.padEnd(28)}║`);
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║ Payment                                        ║');
  console.log(`║ Razorpay:        ${(config.razorpay.keyId ? '✅ Configured' : '⚠️ Missing').padEnd(28)}║`);
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
  
  // Validate after logging
  validateConfig();
}

export default config;