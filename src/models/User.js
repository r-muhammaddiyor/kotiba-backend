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
      default: null
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    avatarUrl: {
      type: String,
      default: ""
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
      },
      assistantTone: {
        type: String,
        enum: ["calm", "friendly", "formal"],
        default: "calm"
      },
      dailyBriefing: {
        type: Boolean,
        default: true
      },
      weeklyReport: {
        type: Boolean,
        default: true
      },
      missedReminderRecovery: {
        type: Boolean,
        default: true
      },
      locationEnabled: {
        type: Boolean,
        default: false
      }
    },
    finance: {
      monthlyIncome: {
        type: Number,
        default: 0,
        min: 0
      },
      monthlyLimit: {
        type: Number,
        default: 0,
        min: 0
      },
      currency: {
        type: String,
        default: "UZS",
        trim: true
      }
    }
  },
  {
    timestamps: true
  }
);

export const User = mongoose.model("User", userSchema);
