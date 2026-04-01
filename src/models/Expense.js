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
    currency: {
      type: String,
      enum: ["UZS", "USD", "EUR", "RUB"],
      default: "UZS",
      trim: true
    },
    exchangeRate: {
      type: Number,
      min: 0,
      default: 1
    },
    amountUzs: {
      type: Number,
      min: 0,
      default: null
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
