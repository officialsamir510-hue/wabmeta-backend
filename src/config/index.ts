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
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
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
  
  // ✅ Meta/WhatsApp - UPDATED with all options
  meta: {
    // App credentials
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    
    // OAuth
    redirectUri: process.env.META_REDIRECT_URI || '',
    configId: process.env.META_CONFIG_ID || '', // WhatsApp Embedded Signup config ID
    
    // API
    graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v19.0',
    graphApiUrl: process.env.META_GRAPH_API_URL || 'https://graph.facebook.com',
    
    // Webhooks
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
    webhookSecret: process.env.META_WEBHOOK_SECRET || '', // For payload signature verification
    
    // Rate limiting
    messagesPerSecond: parseInt(process.env.META_MESSAGES_PER_SECOND || '80', 10),
    
    // Template defaults
    defaultLanguage: process.env.META_DEFAULT_LANGUAGE || 'en_US',
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
  },
};

// Type export for config
export type Config = typeof config;

// Validate required config on startup
const validateConfig = () => {
  const errors: string[] = [];
  
  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }
  
  if (!config.jwt.secret || config.jwt.secret === 'your-secret-key') {
    console.warn('⚠️ Warning: Using default JWT secret. Set JWT_SECRET in production!');
  }
  
  if (config.nodeEnv === 'production') {
    if (!config.meta.appId) {
      console.warn('⚠️ Warning: META_APP_ID not set');
    }
    if (!config.meta.appSecret) {
      console.warn('⚠️ Warning: META_APP_SECRET not set');
    }
    if (!config.meta.webhookVerifyToken) {
      console.warn('⚠️ Warning: META_WEBHOOK_VERIFY_TOKEN not set');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration errors:', errors);
    if (config.nodeEnv === 'production') {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }
};

// Log config on startup (for debugging)
if (process.env.NODE_ENV !== 'test') {
  console.log('📝 Config loaded:');
  console.log('   - NODE_ENV:', config.nodeEnv);
  console.log('   - PORT:', config.port);
  console.log('   - FRONTEND_URL:', config.frontendUrl);
  console.log('   - BACKEND_URL:', config.backendUrl);
  console.log('   - API_VERSION:', config.apiVersion);
  console.log('   - JWT Secret:', config.jwt.secret && config.jwt.secret !== 'your-secret-key' ? '✅ Set' : '⚠️ Default');
  console.log('   - Email Host:', config.email.host);
  console.log('   - Database:', config.databaseUrl ? '✅ Set' : '❌ Missing');
  console.log('   - Meta App ID:', config.meta.appId ? '✅ Set' : '⚠️ Missing');
  console.log('   - Meta App Secret:', config.meta.appSecret ? '✅ Set' : '⚠️ Missing');
  console.log('   - Meta Webhook Token:', config.meta.webhookVerifyToken ? '✅ Set' : '⚠️ Missing');
  console.log('   - Meta Graph API Version:', config.meta.graphApiVersion);
  console.log('   - Razorpay Key:', config.razorpay.keyId ? '✅ Set' : '⚠️ Missing');
  
  // Validate after logging
  validateConfig();
}

export default config;