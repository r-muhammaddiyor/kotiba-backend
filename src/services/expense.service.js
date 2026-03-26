import { Expense } from "../models/Expense.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";

const startOfToday = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

const startOfWeek = (now = new Date()) => {
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const date = new Date(now);
  date.setDate(now.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const startOfMonth = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), 1);

const formatCurrency = (amount, currency = "UZS") =>
  new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount || 0);

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

const normalizeExpenseInput = (payload, options = {}) => {
  const title = String(payload?.title ?? payload?.name ?? "Xarajat").trim();
  const amount = Number(payload?.amount);

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
    amount: Math.floor(amount),
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

export const createAssistantExpenses = async (userId, expenses = []) => {
  const docs = expenses.map((expense) => normalizeExpenseInput(expense, { source: "assistant" }));
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
  const update = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    update.title = String(payload.title || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, "note")) {
    update.note = String(payload.note || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(payload, "amount")) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpError(400, "Xarajat summasi noto'g'ri");
    }
    update.amount = Math.floor(amount);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "spentAt")) {
    update.spentAt = payload.spentAt ? new Date(payload.spentAt) : new Date();
    if (Number.isNaN(update.spentAt.getTime())) {
      throw new HttpError(400, "Xarajat vaqti noto'g'ri");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "category")) {
    update.category = String(payload.category || "general").trim() || "general";
  }

  const expense = await Expense.findOneAndUpdate({ _id: expenseId, user: userId }, update, {
    new: true,
    runValidators: true
  });

  if (!expense) {
    throw new HttpError(404, "Xarajat topilmadi");
  }

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

export const getExpenseSummary = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new HttpError(404, "Foydalanuvchi topilmadi");
  }

  const now = new Date();
  const [daily, weekly, monthly, monthlyByCategory, recentExpenses] = await Promise.all([
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfToday(now) } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfWeek(now) } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfMonth(now) } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Expense.aggregate([
      { $match: { user: user._id, spentAt: { $gte: startOfMonth(now) } } },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]),
    Expense.find({ user: user._id }).sort({ spentAt: -1, createdAt: -1 }).limit(12).lean()
  ]);

  const dayTotal = daily[0]?.total || 0;
  const weekTotal = weekly[0]?.total || 0;
  const monthTotal = monthly[0]?.total || 0;
  const monthlyIncome = user.finance?.monthlyIncome || 0;
  const monthlyLimit = user.finance?.monthlyLimit || (monthlyIncome ? Math.round(monthlyIncome * 0.7) : 0);
  const currency = user.finance?.currency || "UZS";
  const usageRatio = monthlyLimit > 0 ? monthTotal / monthlyLimit : 0;

  const advice = buildExpenseAdvice({
    currency,
    dayTotal,
    monthlyIncome,
    monthlyLimit,
    monthTotal,
    usageRatio
  });
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
    currency,
    monthlyIncome,
    monthlyLimit,
    dailyTotal: dayTotal,
    weeklyTotal: weekTotal,
    monthlyTotal: monthTotal,
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
