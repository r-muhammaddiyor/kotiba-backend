import dotenv from "dotenv";

dotenv.config();

const required = [
  "MONGODB_URI",
  "UZBEKVOICE_API_KEY",
  "UZBEKVOICE_STT_URL",
  "UZBEKVOICE_TTS_URL",
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

const aiProvider = process.env.AI_PROVIDER ?? (process.env.OPENAI_API_KEY ? "openai" : "gemini");
const googleClientIds = String(process.env.GOOGLE_CLIENT_IDS ?? process.env.GOOGLE_WEB_CLIENT_ID ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (aiProvider === "openai" && !process.env.OPENAI_API_KEY) {
  throw new Error("Missing required environment variable: OPENAI_API_KEY");
}

if (aiProvider === "gemini" && !process.env.GEMINI_API_KEY) {
  throw new Error("Missing required environment variable: GEMINI_API_KEY");
}

if (hasVapidPublicKey !== hasVapidPrivateKey) {
  throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be provided together");
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  aiProvider,
  isVercel: process.env.VERCEL === "1",
  isServerless:
    process.env.VERCEL === "1" ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    false,
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI,
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  appTimeZone: process.env.APP_TIMEZONE ?? "Asia/Tashkent",
  appUtcOffset: process.env.APP_UTC_OFFSET ?? "+05:00",
  usdToUzsRate: Number(process.env.USD_TO_UZS_RATE ?? 12172.18),
  eurToUzsRate: Number(process.env.EUR_TO_UZS_RATE ?? 13250),
  rubToUzsRate: Number(process.env.RUB_TO_UZS_RATE ?? 135),
  uzbekVoiceApiKey: process.env.UZBEKVOICE_API_KEY,
  uzbekVoiceSttUrl: process.env.UZBEKVOICE_STT_URL,
  uzbekVoiceTtsUrl: process.env.UZBEKVOICE_TTS_URL,
  uzbekVoiceTtsModel: process.env.UZBEKVOICE_TTS_MODEL ?? "lola",
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  authTokenSecret: process.env.AUTH_TOKEN_SECRET,
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL ?? "",
  smtpFromName: process.env.SMTP_FROM_NAME ?? "Kotiba AI",
  otpExpiresMinutes: Number(process.env.OTP_EXPIRES_MINUTES ?? 10),
  otpResendCooldownSeconds: Number(
    process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30
  ),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  googleClientIds,
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
  cronSecret: process.env.CRON_SECRET ?? ""
};
