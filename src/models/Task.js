import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    note: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ""
    },
    actionText: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ""
    },
    scheduleAt: {
      type: Date,
      default: null
    },
    dueAt: {
      type: Date,
      default: null
    },
    reminderAt: {
      type: Date,
      default: null
    },
    remindBeforeMinutes: {
      type: Number,
      default: 0,
      min: 0
    },
    repeat: {
      type: {
        type: String,
        enum: ["none", "hourly", "daily", "weekly", "custom"],
        default: "none"
      },
      intervalMinutes: {
        type: Number,
        default: null,
        min: 1
      }
    },
    autoDeleteAt: {
      type: Date,
      default: null
    },
    notifyInSite: {
      type: Boolean,
      default: true
    },
    notifyVoice: {
      type: Boolean,
      default: true
    },
    reminderEnabled: {
      type: Boolean,
      default: false
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    reminderLockedAt: {
      type: Date,
      default: null
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    source: {
      type: String,
      enum: ["manual", "assistant"],
      default: "manual"
    },
    assistantIntent: {
      type: String,
      enum: ["chat", "reminder", "task", "mixed", null],
      default: null
    }
  },
  {
    timestamps: true
  }
);

taskSchema.index({ user: 1, reminderAt: 1, reminderEnabled: 1, reminderSent: 1, isCompleted: 1 });
taskSchema.index({ reminderLockedAt: 1, reminderAt: 1 });
taskSchema.index({ autoDeleteAt: 1 });

export const Task = mongoose.model("Task", taskSchema);
