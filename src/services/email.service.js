import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

let transporterPromise = null;

const isEmailConfigured = () =>
  Boolean(
    env.smtpHost &&
      Number.isFinite(env.smtpPort) &&
      env.smtpPort > 0 &&
      env.smtpUser &&
      env.smtpPass &&
      env.smtpFromEmail
  );

const getTransporter = async () => {
  if (!isEmailConfigured()) {
    throw new HttpError(
      503,
      "Email OTP hali sozlanmagan. SMTP ma'lumotlarini kiriting"
    );
  }

  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass
        }
      })
    );
  }

  return transporterPromise;
};

const throwFriendlySmtpError = (error) => {
  if (error instanceof HttpError) {
    throw error;
  }

  const responseCode = Number(error?.responseCode ?? 0);
  const code = String(error?.code ?? "").trim().toUpperCase();
  const message = String(error?.message ?? "").trim().toLowerCase();

  if (code === "EAUTH" || responseCode === 535) {
    throw new HttpError(
      503,
      "SMTP login noto'g'ri. Brevo login yoki parolni tekshiring"
    );
  }

  if (
    responseCode === 550 ||
    responseCode === 553 ||
    message.includes("sender") ||
    message.includes("not allowed") ||
    message.includes("unverified")
  ) {
    throw new HttpError(
      503,
      "Brevo sender email tasdiqlanmagan. SMTP_FROM_EMAIL ni verify qiling"
    );
  }

  if (
    code === "ESOCKET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNECTION" ||
    message.includes("connection")
  ) {
    throw new HttpError(
      503,
      "SMTP serveriga ulanib bo'lmadi. Host va portni tekshiring"
    );
  }

  throw new HttpError(
    503,
    "OTP email yuborilmadi. SMTP sozlamalarini tekshiring",
    {
      details: error?.message ?? String(error)
    }
  );
};

export const sendOtpEmail = async ({ email, code, expiresInMinutes }) => {
  try {
    const transporter = await getTransporter();

    await transporter.sendMail({
      from: `${env.smtpFromName} <${env.smtpFromEmail}>`,
      to: email,
      subject: "Kotiba AI tasdiqlash kodi",
      text:
        `Kotiba AI ga kirish uchun tasdiqlash kodingiz: ${code}\n\n` +
        `Kod ${expiresInMinutes} daqiqa ichida amal qiladi.\n` +
        "Agar bu so'rov sizdan bo'lmasa, bu xatni e'tiborsiz qoldiring.",
      html:
        `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#2E241D;">` +
        `<h2 style="margin-bottom:8px;">Kotiba AI tasdiqlash kodi</h2>` +
        `<p>Ilovaga kirish uchun quyidagi kodni kiriting:</p>` +
        `<div style="font-size:28px;font-weight:700;letter-spacing:8px;margin:18px 0;color:#C46A2E;">${code}</div>` +
        `<p>Kod <strong>${expiresInMinutes} daqiqa</strong> ichida amal qiladi.</p>` +
        `<p>Agar bu so'rov sizdan bo'lmasa, bu xatni e'tiborsiz qoldiring.</p>` +
        `</div>`
    });
  } catch (error) {
    throwFriendlySmtpError(error);
  }
};
