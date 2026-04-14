import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { AuthOtp } from "../models/AuthOtp.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "../utils/otp.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { createAuthToken } from "../utils/token.js";
import { sendOtpEmail } from "./email.service.js";

const googleClient = new OAuth2Client();

const sanitizeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl || "",
  authMethods: {
    password: Boolean(user.passwordHash),
    google: Boolean(user.googleId)
  },
  locale: user.locale,
  timeZone: user.timeZone,
  preferences: user.preferences,
  finance: user.finance
});

const createSessionPayload = (user) => ({
  token: createAuthToken({ userId: String(user._id) }),
  user: sanitizeUser(user)
});

const createDefaultNameFromEmail = (email) => {
  const localPart = String(email || "")
    .trim()
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();

  if (!localPart) {
    return "Kotiba foydalanuvchisi";
  }

  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const normalizeGoogleProfile = async (payload) => {
  const idToken = String(payload?.idToken || payload?.credential || "").trim();

  if (!idToken) {
    throw new HttpError(400, "Google token yuborilmadi");
  }

  if (env.googleClientIds.length === 0) {
    throw new HttpError(503, "Google login hali sozlanmagan");
  }

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientIds
    });
  } catch (error) {
    throw new HttpError(401, "Google token tasdiqlanmadi");
  }

  const googleProfile = ticket.getPayload();
  const googleId = String(googleProfile?.sub || "").trim();
  const email = String(googleProfile?.email || "").trim().toLowerCase();
  const name = String(googleProfile?.name || "").trim();
  const avatarUrl = String(googleProfile?.picture || "").trim();
  const emailVerified = googleProfile?.email_verified === true;

  if (!googleId || !email || !emailVerified) {
    throw new HttpError(401, "Google akkaunti tasdiqlanmadi");
  }

  return {
    googleId,
    email,
    name: name || email.split("@")[0] || "Kotiba foydalanuvchisi",
    avatarUrl
  };
};

export const registerUser = async ({ name, email, password }) => {
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");

  if (!normalizedName) {
    throw new HttpError(400, "Ism majburiy");
  }

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new HttpError(400, "To'g'ri email kiriting");
  }

  if (normalizedPassword.length < 6) {
    throw new HttpError(400, "Parol kamida 6 ta belgidan iborat bo'lishi kerak");
  }

  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    if (existingUser.googleId && !existingUser.passwordHash) {
      throw new HttpError(409, "Bu email Google orqali ro'yxatdan o'tgan. Google bilan kiring");
    }

    throw new HttpError(409, "Bu email bilan foydalanuvchi mavjud");
  }

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    passwordHash: await hashPassword(normalizedPassword)
  });

  return createSessionPayload(user);
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new HttpError(401, "Email yoki parol noto'g'ri");
  }

  if (!user.passwordHash) {
    throw new HttpError(400, "Bu akkaunt uchun Google orqali kiring");
  }

  const valid = await verifyPassword(normalizedPassword, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Email yoki parol noto'g'ri");
  }

  return createSessionPayload(user);
};

export const sendLoginOtp = async ({ email }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new HttpError(400, "To'g'ri email kiriting");
  }

  const now = new Date();
  const existingOtp = await AuthOtp.findOne({ email: normalizedEmail });

  if (existingOtp?.lastSentAt) {
    const elapsedSeconds = Math.floor(
      (now.getTime() - new Date(existingOtp.lastSentAt).getTime()) / 1000
    );
    const waitSeconds = env.otpResendCooldownSeconds - elapsedSeconds;

    if (waitSeconds > 0) {
      throw new HttpError(429, "Kodni sal keyinroq qayta yuboring", {
        waitSeconds
      });
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + env.otpExpiresMinutes * 60 * 1000);

  await AuthOtp.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      codeHash: hashOtpCode(normalizedEmail, code),
      expiresAt,
      lastSentAt: now,
      attemptCount: 0
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  try {
    await sendOtpEmail({
      email: normalizedEmail,
      code,
      expiresInMinutes: env.otpExpiresMinutes
    });
  } catch (error) {
    await AuthOtp.deleteOne({ email: normalizedEmail });
    throw error;
  }

  return {
    sent: true,
    expiresInMinutes: env.otpExpiresMinutes,
    cooldownSeconds: env.otpResendCooldownSeconds
  };
};

export const verifyLoginOtp = async ({ email, otp, code }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const submittedCode = String(otp || code || "").trim();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new HttpError(400, "To'g'ri email kiriting");
  }

  if (submittedCode.length !== 6) {
    throw new HttpError(400, "6 xonali kodni kiriting");
  }

  const otpRecord = await AuthOtp.findOne({ email: normalizedEmail });
  if (!otpRecord) {
    throw new HttpError(401, "OTP topilmadi yoki muddati tugagan");
  }

  if (otpRecord.expiresAt.getTime() <= Date.now()) {
    await AuthOtp.deleteOne({ _id: otpRecord._id });
    throw new HttpError(401, "OTP muddati tugagan");
  }

  if (otpRecord.attemptCount >= env.otpMaxAttempts) {
    await AuthOtp.deleteOne({ _id: otpRecord._id });
    throw new HttpError(429, "Juda ko'p urinish bo'ldi. Yangi kod so'rang");
  }

  const valid = verifyOtpCode(
    normalizedEmail,
    submittedCode,
    otpRecord.codeHash
  );

  if (!valid) {
    otpRecord.attemptCount += 1;
    await otpRecord.save();

    throw new HttpError(401, "Kod noto'g'ri yoki eskirgan");
  }

  await AuthOtp.deleteOne({ _id: otpRecord._id });

  let user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    user = await User.create({
      name: createDefaultNameFromEmail(normalizedEmail),
      email: normalizedEmail
    });
  }

  return createSessionPayload(user);
};

export const loginWithGoogle = async (payload) => {
  const googleProfile = await normalizeGoogleProfile(payload);

  const [userByGoogleId, userByEmail] = await Promise.all([
    User.findOne({ googleId: googleProfile.googleId }),
    User.findOne({ email: googleProfile.email })
  ]);

  if (
    userByGoogleId &&
    userByEmail &&
    String(userByGoogleId._id) !== String(userByEmail._id)
  ) {
    throw new HttpError(409, "Google akkauntni ulab bo'lmadi. Yordam uchun murojaat qiling");
  }

  let user = userByGoogleId ?? userByEmail;

  if (!user) {
    user = await User.create({
      name: googleProfile.name,
      email: googleProfile.email,
      googleId: googleProfile.googleId,
      avatarUrl: googleProfile.avatarUrl
    });

    return createSessionPayload(user);
  }

  const updates = {};

  if (!user.googleId) {
    updates.googleId = googleProfile.googleId;
  }

  if (!user.avatarUrl && googleProfile.avatarUrl) {
    updates.avatarUrl = googleProfile.avatarUrl;
  }

  if (!user.name && googleProfile.name) {
    updates.name = googleProfile.name;
  }

  if (Object.keys(updates).length > 0) {
    user = await User.findByIdAndUpdate(user._id, updates, {
      new: true,
      runValidators: true
    });
  }

  return createSessionPayload(user);
};

export const updateUserProfile = async (userId, payload) => {
  const update = {};

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    update.name = String(payload.name || "").trim();
    if (!update.name) {
      throw new HttpError(400, "Ism bo'sh bo'lishi mumkin emas");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "locale")) {
    update.locale = String(payload.locale || "").trim() || "uz-UZ";
  }

  if (Object.prototype.hasOwnProperty.call(payload, "timeZone")) {
    update.timeZone = String(payload.timeZone || "").trim() || "Asia/Tashkent";
  }

  if (payload?.preferences && typeof payload.preferences === "object") {
    update.preferences = {
      notifyInSite: payload.preferences.notifyInSite !== false,
      notifyVoice: payload.preferences.notifyVoice !== false,
      assistantTone: ["calm", "friendly", "formal"].includes(payload.preferences.assistantTone)
        ? payload.preferences.assistantTone
        : "calm",
      dailyBriefing: payload.preferences.dailyBriefing !== false,
      weeklyReport: payload.preferences.weeklyReport !== false,
      missedReminderRecovery: payload.preferences.missedReminderRecovery !== false,
      locationEnabled: payload.preferences.locationEnabled === true
    };
  }

  if (payload?.finance && typeof payload.finance === "object") {
    const monthlyIncome = Number(payload.finance.monthlyIncome || 0);
    const monthlyLimit = Number(payload.finance.monthlyLimit || 0);

    update.finance = {
      monthlyIncome: Number.isFinite(monthlyIncome) && monthlyIncome > 0 ? Math.floor(monthlyIncome) : 0,
      monthlyLimit: Number.isFinite(monthlyLimit) && monthlyLimit > 0 ? Math.floor(monthlyLimit) : 0,
      currency: String(payload.finance.currency || "UZS").trim() || "UZS"
    };
  }

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true
  });

  if (!user) {
    throw new HttpError(404, "Foydalanuvchi topilmadi");
  }

  return sanitizeUser(user);
};

export const getSafeUser = sanitizeUser;
