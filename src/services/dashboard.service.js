import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/httpError.js";
import { getExpenseSummary } from "./expense.service.js";

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatTaskTime = (value) =>
  new Intl.DateTimeFormat("uz-UZ", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));

const mapTaskCard = (task) => ({
  id: String(task._id),
  title: task.title,
  note: task.note || task.description || "",
  scheduleAt: task.scheduleAt,
  reminderAt: task.reminderAt,
  formattedScheduleAt: task.scheduleAt ? formatTaskTime(task.scheduleAt) : "Vaqt belgilanmagan",
  notifyVoice: task.notifyVoice !== false
});

const buildDailyBriefing = ({ todayTasks, overdueTasks }) => {
  if (overdueTasks.length) {
    return `Sizda o'tib ketgan ${overdueTasks.length} ta vazifa bor. Avval shularni qayta vaqtga qo'yib olsak yaxshi bo'ladi.`;
  }

  if (!todayTasks.length) {
    return "Bugun jadval yengil ko'rinyapti. Muhim bitta ish bo'lsa hozirning o'zida kiritib qo'ying.";
  }

  if (todayTasks.length === 1) {
    return `Bugun asosiy vazifangiz ${todayTasks[0].title.toLowerCase()}. Vaqti ${todayTasks[0].formattedScheduleAt}.`;
  }

  return `Bugun ${todayTasks.length} ta vazifa bor. Eng yaqinlari: ${todayTasks
    .slice(0, 2)
    .map((task) => task.title.toLowerCase())
    .join(" va ")}.`;
};

const buildWeeklyReport = ({ weekTasks, completedCount, financeSummary }) => {
  const expenseLine = financeSummary?.analytics?.spendPace || financeSummary?.advice || "Xarajatlar bo'yicha alohida signal yo'q.";

  if (!weekTasks.length) {
    return `Bu hafta ochiq task ko'rinmayapti. ${expenseLine}`;
  }

  return `Bu hafta ${weekTasks.length} ta rejalashtirilgan ish bor, ${completedCount} tasi allaqachon bajarilgan. ${expenseLine}`;
};

const buildSmartSuggestions = ({ todayTasks, overdueTasks, financeSummary, pendingCount }) => {
  const suggestions = [];

  if (overdueTasks.length) {
    suggestions.push("O'tib ketgan vazifalarni qayta rejalashtir");
  }

  if (todayTasks.length) {
    suggestions.push("Bugungi ishlarni tartiblab ber");
  }

  if (!todayTasks.length) {
    suggestions.push("Bugunga yangi vazifa qo'sh");
  }

  if ((financeSummary?.monthlyLimit || 0) > 0) {
    suggestions.push("Bu oy qayerga ko'p pul ketganini ayt");
  }

  if (pendingCount >= 3) {
    suggestions.push("Tasklarni ustuvorlik bo'yicha ajrat");
  }

  suggestions.push("Ertaga uchun eslatma qo'y");
  suggestions.push("Haftalik hisobotni ko'rsat");

  return [...new Set(suggestions)].slice(0, 4);
};

export const getDashboardSummary = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new HttpError(404, "Foydalanuvchi topilmadi");
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const weekEnd = endOfDay(addDays(now, 7));

  const [allTasks, financeSummary] = await Promise.all([
    Task.find({ user: userId }).sort({ scheduleAt: 1, createdAt: -1 }).lean(),
    getExpenseSummary(userId)
  ]);

  const pendingTasks = allTasks.filter((task) => !task.isCompleted);
  const completedCount = allTasks.filter((task) => task.isCompleted).length;
  const scheduledPending = pendingTasks.filter((task) => task.scheduleAt);
  const overdueTasks = scheduledPending
    .filter((task) => new Date(task.scheduleAt) < now)
    .slice(0, 5)
    .map(mapTaskCard);
  const todayTasks = scheduledPending
    .filter((task) => new Date(task.scheduleAt) >= todayStart && new Date(task.scheduleAt) <= todayEnd)
    .slice(0, 5)
    .map(mapTaskCard);
  const tomorrowTasks = scheduledPending
    .filter((task) => new Date(task.scheduleAt) >= tomorrowStart && new Date(task.scheduleAt) <= tomorrowEnd)
    .slice(0, 5)
    .map(mapTaskCard);
  const weekTasks = scheduledPending
    .filter((task) => new Date(task.scheduleAt) >= todayStart && new Date(task.scheduleAt) <= weekEnd)
    .slice(0, 8)
    .map(mapTaskCard);

  return {
    stats: {
      pendingCount: pendingTasks.length,
      completedCount,
      overdueCount: overdueTasks.length,
      todayCount: todayTasks.length
    },
    agenda: {
      today: todayTasks,
      tomorrow: tomorrowTasks,
      week: weekTasks
    },
    dailyBriefing: user.preferences?.dailyBriefing !== false ? buildDailyBriefing({ todayTasks, overdueTasks }) : "",
    weeklyReport: user.preferences?.weeklyReport !== false ? buildWeeklyReport({ weekTasks, completedCount, financeSummary }) : "",
    missedReminders:
      user.preferences?.missedReminderRecovery !== false
        ? overdueTasks.map((task) => ({
            id: task.id,
            title: task.title,
            body: `${task.title} vaqti o'tib ketgan. Qayta vaqt belgilashni unutmang.`,
            scheduleAt: task.scheduleAt,
            formattedScheduleAt: task.formattedScheduleAt
          }))
        : [],
    smartSuggestions: buildSmartSuggestions({
      todayTasks,
      overdueTasks,
      financeSummary,
      pendingCount: pendingTasks.length
    }),
    financeSummary
  };
};
