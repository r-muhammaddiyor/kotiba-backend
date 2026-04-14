import crypto from "crypto";
import { env } from "../config/env.js";

export const generateOtpCode = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");

export const hashOtpCode = (email, code) =>
  crypto
    .createHash("sha256")
    .update(`${env.authTokenSecret}:${String(email).trim().toLowerCase()}:${String(code).trim()}`)
    .digest("hex");

export const verifyOtpCode = (email, code, expectedHash) => {
  const actualHash = hashOtpCode(email, code);
  const actualBuffer = Buffer.from(actualHash, "utf8");
  const expectedBuffer = Buffer.from(String(expectedHash || ""), "utf8");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};
