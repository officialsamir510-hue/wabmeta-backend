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
  
  // Meta/WhatsApp
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
  },
  
  // Razorpay
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
  },
};

// Type export for config
export type Config = typeof config;

// Log config on startup (for debugging)
if (process.env.NODE_ENV !== 'test') {
  console.log('📝 Config loaded:');
  console.log('   - NODE_ENV:', config.nodeEnv);
  console.log('   - PORT:', config.port);
  console.log('   - FRONTEND_URL:', config.frontendUrl);
  console.log('   - API_VERSION:', config.apiVersion);
  console.log('   - JWT Secret:', config.jwt.secret ? '✅ Set' : '❌ Missing');
  console.log('   - Email Host:', config.email.host);
  console.log('   - Database:', config.databaseUrl ? '✅ Set' : '❌ Missing');
}

export default config;