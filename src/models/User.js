import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    locale: {
      type: String,
      default: "uz-UZ"
    },
    timeZone: {
      type: String,
      default: "Asia/Tashkent"
    },
    preferences: {
      notifyInSite: {
        type: Boolean,
        default: true
      },
      notifyVoice: {
        type: Boolean,
        default: true
      }
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model("User", userSchema);
