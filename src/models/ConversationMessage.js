import mongoose from "mongoose";

const conversationMessageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000
    },
    interactionType: {
      type: String,
      enum: ["text", "voice"],
      default: "text"
    },
    intent: {
      type: String,
      enum: ["chat", "reminder", "task", "mixed", "note", null],
      default: null
    },
    taskCount: {
      type: Number,
      default: 0
    },
    audioAvailable: {
      type: Boolean,
      default: false
    },
    transcriptHidden: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

conversationMessageSchema.index({ user: 1, createdAt: -1 });

export const ConversationMessage = mongoose.model("ConversationMessage", conversationMessageSchema);
