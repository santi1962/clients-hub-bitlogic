import "dotenv/config";

const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",

  db: {
    connectionString: process.env.DATABASE_URL,
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev_access_secret_change_in_prod",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev_refresh_secret_change_in_prod",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? "15m",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? "30d",
    refreshExpiryShort: process.env.JWT_REFRESH_EXPIRY_SHORT ?? "1d",
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  },

  bcrypt: {
    rounds: 12,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? "2525", 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME ?? "Bitlogic",
    fromEmail: process.env.SMTP_FROM_EMAIL ?? "noreply@bitlogic.com.ar",
  },

  hestia: {
    url: process.env.HESTIA_API_URL,
    username: process.env.HESTIA_USERNAME,
    password: process.env.HESTIA_PASSWORD,
    apiKey: process.env.HESTIA_API_KEY,
    verifySsl: process.env.HESTIA_VERIFY_SSL !== "false",
    // Si HESTIA_API_KEY está configurada, se usa en lugar de username/password
    useApiKey: !!process.env.HESTIA_API_KEY,
  },
};

export default config;
