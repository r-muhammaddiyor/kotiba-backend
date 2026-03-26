import dotenv from "dotenv";

dotenv.config();

const required = [
  "MONGODB_URI",
  "UZBEKVOICE_API_KEY",
  "UZBEKVOICE_STT_URL",
  "UZBEKVOICE_TTS_URL",
  "GEMINI_API_KEY",
  "AUTH_TOKEN_SECRET"
];

const hasVapidPublicKey = Boolean(process.env.VAPID_PUBLIC_KEY);
const hasVapidPrivateKey = Boolean(process.env.VAPID_PRIVATE_KEY);

for (const key of required) {
  if (!process.env[key]) {
    // Fail fast to avoid silent production misconfiguration.
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (hasVapidPublicKey !== hasVapidPrivateKey) {
  throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be provided together");
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  appTimeZone: process.env.APP_TIMEZONE ?? "Asia/Tashkent",
  appUtcOffset: process.env.APP_UTC_OFFSET ?? "+05:00",
  uzbekVoiceApiKey: process.env.UZBEKVOICE_API_KEY,
  uzbekVoiceSttUrl: process.env.UZBEKVOICE_STT_URL,
  uzbekVoiceTtsUrl: process.env.UZBEKVOICE_TTS_URL,
  uzbekVoiceTtsModel: process.env.UZBEKVOICE_TTS_MODEL ?? "lola",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  authTokenSecret: process.env.AUTH_TOKEN_SECRET,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com"
};
