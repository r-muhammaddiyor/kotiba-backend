import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema(
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
      maxlength: 160
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    spentAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "general"
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

expenseSchema.index({ user: 1, spentAt: -1 });

export const Expense = mongoose.model("Expense", expenseSchema);
