import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { createAuthToken } from "../utils/token.js";

const sanitizeUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  locale: user.locale,
  timeZone: user.timeZone,
  preferences: user.preferences,
  finance: user.finance
});

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
    throw new HttpError(409, "Bu email bilan foydalanuvchi mavjud");
  }

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    passwordHash: await hashPassword(normalizedPassword)
  });

  return {
    token: createAuthToken({ userId: String(user._id) }),
    user: sanitizeUser(user)
  };
};

export const loginUser = async ({ email, password }) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedPassword = String(password || "");

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new HttpError(401, "Email yoki parol noto'g'ri");
  }

  const valid = await verifyPassword(normalizedPassword, user.passwordHash);
  if (!valid) {
    throw new HttpError(401, "Email yoki parol noto'g'ri");
  }

  return {
    token: createAuthToken({ userId: String(user._id) }),
    user: sanitizeUser(user)
  };
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
      missedReminderRecovery: payload.preferences.missedReminderRecovery !== false
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
