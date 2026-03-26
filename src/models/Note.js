import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
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
    body: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: ""
    },
    source: {
      type: String,
      enum: ["manual", "assistant"],
      default: "manual"
    }
  },
  {
    timestamps: true
  }
);

noteSchema.index({ user: 1, createdAt: -1 });

export const Note = mongoose.model("Note", noteSchema);
