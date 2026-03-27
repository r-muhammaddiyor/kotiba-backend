import { Expense } from "../models/Expense.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import { startOfAppDay, startOfAppMonth, startOfAppWeek } from "../utils/timezone.js";

const formatCurrency = (amount, currency = "UZS") => {
  if (currency === "USD") {
    return `$${Number(amount || 0).toFixed(Number.isInteger(Number(amount || 0)) ? 0 : 2)}`;
  }

  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const amountUzsExpression = { $ifNull: ["$amountUzs", "$amount"] };
const dollarPattern = /\b(usd|dollar|dollor|dolar)\b|\$/iu;
const uzsPattern = /\b(so'm|som|uzs|ming|million)\b/iu;

const normalizeCurrency = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (["USD", "$", "DOLLAR", "DOLLOR", "DOLAR"].includes(normalized)) {
    return "USD";
  }

  return "UZS";
};

const inferCurrency = (...sources) => {
  for (const source of sources) {
    const text = String(source || "").trim();
    if (!text) {
      continue;
    }

    if (dollarPattern.test(text)) {
      return "USD";
    }

    if (uzsPattern.test(text)) {
      return "UZS";
    }
  }

  return "UZS";
};

const getExchangeRate = (currency) => {
  if (currency === "USD") {
    return Number.isFinite(env.usdToUzsRate) && env.usdToUzsRate > 0 ? env.usdToUzsRate : 12172.18;
  }

  return 1;
};

const convertAmountToUzs = (amount, currency, exchangeRate) =>
  currency === "USD" ? Math.round(amount * exchangeRate) : Math.round(amount);

const normalizeAmountByCurrency = (amount, currency) =>
  currency === "USD" ? Math.round(amount * 100) / 100 : Math.floor(amount);

const categoryLabels = {
  general: "Umumiy",
  food: "Oziq-ovqat",
  transport: "Transport",
  home: "Uy",
  work: "Ish",
  other: "Boshqa"
};

const buildExpenseAdvice = ({ currency, dayTotal, monthlyIncome, monthlyLimit, monthTotal, usageRatio }) => {
  if (monthlyLimit > 0 && usageRatio >= 1) {
    const overAmount = monthTotal - monthlyLimit;
    return `${formatCurrency(overAmount, currency)} ga limitdan chiqib ketdingiz. Qolgan kunlarda xarajatni aniq reja bilan qilsangiz, pulingiz tartibga tushadi.`;
  }

  if (monthlyLimit > 0 && usageRatio >= 0.9) {
    const remaining = Math.max(0, monthlyLimit - monthTotal);
    return `Oylik limitga juda yaqin qoldingiz, atigi ${formatCurrency(remaining, currency)} joy bor. Zarur bo'lmagan xarajatlarni biroz ushlab turing.`;
  }

  if (monthlyLimit > 0 && usageRatio >= 0.75) {
    return `Bu oy xarajatlar tezlashib ketdi. Shu tempda davom etsangiz limitga erta yetib borasiz, biroz ehtiyotroq ishlating.`;
  }

  if (monthlyIncome > 0 && dayTotal >= monthlyIncome * 0.15) {
    return `Bugungi xarajat sezilarli bo'ldi. Ertaga mayda xarajatlarni kamaytirsangiz umumiy balansingiz yaxshiroq turadi.`;
  }

  if (monthTotal === 0) {
    return "Hozircha xarajat kiritilmagan. Xarajatlarni yozib borsangiz, KotibaAI sizga aniqroq maslahat beradi.";
  }

  return "Xarajatlaringiz hozircha me'yorida. Shu tartibda davom etsangiz, oy oxirigacha bosim sezilmaydi.";
};

const buildExpenseSnapshot = ({ user, dayTotal, weekTotal, monthTotal }) => {
  const monthlyIncome = user.finance?.monthlyIncome || 0;
  const monthlyLimit = user.finance?.monthlyLimit || (monthlyIncome ? Math.round(monthlyIncome * 0.7) : 0);
  const currency = "UZS";
  const usageRatio = monthlyLimit > 0 ? monthTotal / monthlyLimit : 0;

  return {
    currency,
    monthlyIncome,
    monthlyLimit,
    dailyTotal: dayTotal,
    weeklyTotal: weekTotal,
    monthlyTotal: monthTotal,
    advice: buildExpenseAdvice({
      currency,
      dayTotal,
      monthlyIncome,
      monthlyLimit,
      monthTotal,
      usageRatio
    })
  };
};

const normalizeExpenseInput = (payload, options = {}) => {
  const title = String(payload?.title ?? payload?.name ?? "Xarajat").trim();
  const amount = Number(payload?.amount);
  const currency = normalizeCurrency(payload?.currency || inferCurrency(payload?.title, payload?.note, options.sourceText));
  const exchangeRate = getExchangeRate(currency);

  if (!title) {
    throw new HttpError(400, "Xarajat nomi kerak");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Xarajat summasi noto'g'ri");
  }

  const spentAt = payload?.spent_at ?? payload?.spentAt ? new Date(payload.spent_at ?? payload.spentAt) : new Date();
  if (Number.isNaN(spentAt.getTime())) {
    throw new HttpError(400, "Xarajat vaqti noto'g'ri");
  }

  return {
    title,
    note: String(payload?.note ?? "").trim(),
    amount: normalizeAmountByCurrency(amount, currency),
    currency,
    exchangeRate,
    amountUzs: convertAmountToUzs(amount, currency, exchangeRate),
    spentAt,
    category: String(payload?.category ?? "general").trim() || "general",
    source: options.source ?? "manual"
  };
};

export const createExpense = async (userId, payload, options = {}) => {
  const doc = normalizeExpenseInput(payload, options);
  return Expense.create({
    ...doc,
    user: userId
  });
};

export const createAssistantExpenses = async (userId, expenses = [], sourceText = "") => {
  const docs = expenses.map((expense) =>
    normalizeExpenseInput(expense, {
      source: "assistant",
      sourceText: expense?.source_text || sourceText || expense?.note || expense?.title
    })
  );
  if (!docs.length) {
    return [];
  }

  return Expense.insertMany(
    docs.map((doc) => ({
      ...doc,
      user: userId
    }))
  );
};

export const updateExpense = async (userId, expenseId, payload) => {
  const expense = await Expense.findOne({ _id: expenseId, user: userId });
  if (!expense) {
    throw new HttpError(404, "Xarajat topilmadi");
  }

  const next = {
    title: expense.title,
    note: expense.note,
    amount: expense.amount,
    currency: expense.currency || "UZS",
    spentAt: expense.spentAt,
    category: expense.category || "general"
  };

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    next.title = String(payload.title || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, "note")) {
    next.note = String(payload.note || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, "amount")) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, "Xarajat summasi noto'g'ri");
    }
    next.amount = normalizeAmountByCurrency(amount, next.currency);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "currency")) {
    next.currency = normalizeCurrency(payload.currency);
    next.amount = normalizeAmountByCurrency(next.amount, next.currency);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "spentAt")) {
    next.spentAt = payload.spentAt ? new Date(payload.spentAt) : new Date();
    if (Number.isNaN(next.spentAt.getTime())) {
      throw new HttpError(400, "Xarajat vaqti noto'g'ri");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "category")) {
    next.category = String(payload.category || "general").trim() || "general";
  }

  next.exchangeRate = getExchangeRate(next.currency);
  next.amountUzs = convertAmountToUzs(next.amount, next.currency, next.exchangeRate);

  expense.set(next);
  await expense.save();

  return expense;
};

export const deleteExpense = async (userId, expenseId) => {
  const expense = await Expense.findOneAndDelete({ _id: expenseId, user: userId });
  if (!expense) {
    throw new HttpError(404, "Xarajat topilmadi");
  }

  return expense;
};

export const listExpenses = async (userId) =>
  Expense.find({ user: userId }).sort({ spentAt: -1, createdAt: -1 }).limit(100);

export const getExpenseSnapshot = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new HttpError(404, "Foydalanuvchi topilmadi");
  }

  const now = new Date();
  const [totals] = await Expense.aggregate([
    { $match: { user: user._id } },
    {
      $facet: {
        daily: [
          { $match: { spentAt: { $gte: startOfAppDay(now) } } },
          { $group: { _id: null, total: { $sum: amountUzsExpression } } }
        ],
        weekly: [
          { $match: { spentAt: { $gte: startOfAppWeek(now) } } },
          { $group: { _id: null, total: { $sum: amountUzsExpression } } }
        ],
        monthly: [
          { $match: { spentAt: { $gte: startOfAppMonth(now) } } },
          { $group: { _id: null, total: { $sum: amountUzsExpression } } }
        ]
      }
    }
  ]);

  return buildExpenseSnapshot({
    user,
    dayTotal: totals?.daily?.[0]?.total || 0,
    weekTotal: totals?.weekly?.[0]?.total || 0,
    monthTotal: totals?.monthly?.[0]?.total || 0
  });
};

export const getExpenseSummary = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new HttpError(404, "Foydalanuvchi topilmadi");
  }

  const now = new Date();
  const [daily, weekly, monthly, monthlyByCategory, recentExpenses] = await Promise.all([
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfAppDay(now) } } },
      { $group: { _id: null, total: { $sum: amountUzsExpression } } }
    ]),
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfAppWeek(now) } } },
      { $group: { _id: null, total: { $sum: amountUzsExpression } } }
    ]),
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfAppMonth(now) } } },
      { $group: { _id: null, total: { $sum: amountUzsExpression } } }
    ]),
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfAppMonth(now) } } },
      { $group: { _id: "$category", total: { $sum: amountUzsExpression }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]),
    Expense.find({ user: user._id }).sort({ spentAt: -1, createdAt: -1 }).limit(12).lean()
  ]);

  const dayTotal = daily[0]?.total || 0;
  const weekTotal = weekly[0]?.total || 0;
  const monthTotal = monthly[0]?.total || 0;
  const snapshot = buildExpenseSnapshot({
    user,
    dayTotal,
    weekTotal,
    monthTotal
  });
  const { monthlyIncome, monthlyLimit, currency, advice } = snapshot;
  const usageRatio = monthlyLimit > 0 ? monthTotal / monthlyLimit : 0;
  const categoryBreakdown = monthlyByCategory.map((entry) => ({
    category: entry._id || "general",
    label: categoryLabels[entry._id] || categoryLabels.general,
    total: entry.total || 0,
    count: entry.count || 0,
    share: monthTotal > 0 ? Math.round(((entry.total || 0) / monthTotal) * 100) : 0,
    formattedTotal: formatCurrency(entry.total || 0, currency)
  }));
  const topCategory = categoryBreakdown[0] || null;
  const analytics = {
    topCategory: topCategory
      ? `${topCategory.label} eng katta ulushni oldi: ${topCategory.formattedTotal} (${topCategory.share}%)`
      : "Kategoriya bo'yicha xarajat hali ko'rinmayapti",
    spendPace:
      monthlyLimit > 0 && monthTotal > monthlyLimit
        ? "Bu oy limitdan chiqib ketdingiz, qolgan xarajatlarni faqat zarur narsalarga qiling."
        : monthlyLimit > 0 && usageRatio >= 0.85
          ? "Bu oy limitga juda yaqinlashdingiz, mayda xarajatlar ham endi seziladi."
          : "Xarajat pacing hozircha nazoratda.",
    categoryBreakdown
  };

  return {
    ...snapshot,
    advice,
    analytics,
    formatted: {
      dailyTotal: formatCurrency(dayTotal, currency),
      weeklyTotal: formatCurrency(weekTotal, currency),
      monthlyTotal: formatCurrency(monthTotal, currency),
      monthlyIncome: formatCurrency(monthlyIncome, currency),
      monthlyLimit: formatCurrency(monthlyLimit, currency)
    },
    recentExpenses
  };
};
