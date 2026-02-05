// src/types/global.d.ts

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    API_VERSION: string;
    FRONTEND_URL: string;
    DATABASE_URL: string;
    DIRECT_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: string;
    SMTP_HOST: string;
    SMTP_PORT: string;
    SMTP_USER: string;
    SMTP_PASS: string;
    EMAIL_FROM: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    META_APP_ID: string;
    META_APP_SECRET: string;
    META_WEBHOOK_VERIFY_TOKEN: string;
    RAZORPAY_KEY_ID: string;
    RAZORPAY_KEY_SECRET: string;
  }
}