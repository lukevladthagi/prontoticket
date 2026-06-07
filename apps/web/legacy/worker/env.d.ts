interface Env {
  DB: D1Database;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  RESEND_API_KEY?: string;
  OPENAI_API_KEY?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  R2_BUCKET?: R2Bucket;
  [key: string]: any;
}
