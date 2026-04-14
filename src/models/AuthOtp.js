import mongoose from "mongoose";

const authOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    codeHash: {
      type: String,
      required: true,
      trim: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    lastSentAt: {
      type: Date,
      required: true
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

authOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthOtp = mongoose.model("AuthOtp", authOtpSchema);
