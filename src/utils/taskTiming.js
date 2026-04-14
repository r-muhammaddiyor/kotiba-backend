import { addAbsoluteDays, getAppWeekday, setAppClock } from "./timezone.js";

const numberWords = new Map([
  ["yarim", 0.5],
  ["bir", 1],
  ["bitta", 1],
  ["ikki", 2],
  ["ikkita", 2],
  ["uch", 3],
  ["uchta", 3],
  ["to'rt", 4],
  ["tort", 4],
  ["to'rtta", 4],
  ["tortta", 4],
  ["besh", 5],
  ["beshta", 5],
  ["olti", 6],
  ["oltita", 6],
  ["yetti", 7],
  ["yettita", 7],
  ["sakkiz", 8],
  ["sakkizta", 8],
  ["to'qqiz", 9],
  ["toqqiz", 9],
  ["to'qqizta", 9],
  ["toqqizta", 9],
  ["o'n", 10],
  ["on", 10],
  ["o'nta", 10],
  ["onta", 10],
  ["o'n bir", 11],
  ["on bir", 11],
  ["o'n ikki", 12],
  ["on ikki", 12]
]);

const hourWordEntries = [...numberWords.entries()]
  .filter(([, value]) => Number.isInteger(value) && value >= 1 && value <= 12)
  .sort((left, right) => right[0].length - left[0].length);

const hourWordAlternatives = hourWordEntries
  .map(([label]) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const weekdayMap = new Map([
  ["yakshanba", 0],
  ["dushanba", 1],
  ["seshanba", 2],
  ["chorshanba", 3],
  ["payshanba", 4],
  ["juma", 5],
  ["shanba", 6]
]);

const monthMap = new Map([
  ["yanvar", 1],
  ["fevral", 2],
  ["mart", 3],
  ["aprel", 4],
  ["may", 5],
  ["iyun", 6],
  ["iyul", 7],
  ["avgust", 8],
  ["sentabr", 9],
  ["sentyabr", 9],
  ["oktabr", 10],
  ["noyabr", 11],
  ["dekabr", 12]
]);

const morningPattern = /\b(ertalab|ertalabki|tong|tongda|tonggi)\b/i;
const daytimePattern = /\b(tush|tushda|tushlikdan keyin|kunduzi|kunduzgi)\b/i;
const eveningPattern = /\b(kech|kechki|kechqurun|kechqurungi|kechasi|tunda|tungi|tun)\b/i;

const normalizeTemporalText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[К»КјвЂ™вЂ`Вґ]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const parseNumberToken = (rawToken) => {
  const token = normalizeTemporalText(rawToken);

  if (!token) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }

  return numberWords.get(token) ?? null;
};

const toMinutes = (amount, unit) => {
  if (!Number.isFinite(amount)) {
    return null;
  }

  if (/kun|sutka/.test(unit)) {
    return Math.round(amount * 24 * 60);
  }

  if (/soat/.test(unit)) {
    return Math.round(amount * 60);
  }

  return Math.round(amount);
};

const buildDurationPattern = (suffixAlternatives) =>
  new RegExp(
    String.raw`\b(\d+(?:\.\d+)?|yarim|bir|bitta|ikki|ikkita|uch|uchta|to'rt|tort|to'rtta|tortta|besh|beshta|olti|oltita|yetti|yettita|sakkiz|sakkizta|to'qqiz|toqqiz|to'qqizta|toqqizta|o'n|on|o'nta|onta|o'n bir|on bir|o'n ikki|on ikki)\s*(kun|sutka|soat|daqiqa|minut|min)\s*(?:dan\s*)?(?:${suffixAlternatives})\b`,
    "i"
  );

const safeDate = (year, month, day) => {
  try {
    const value = new Date(Date.UTC(year, month - 1, day));
    if (
      value.getUTCFullYear() !== year ||
      value.getUTCMonth() !== month - 1 ||
      value.getUTCDate() !== day
    ) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
};

const extractExplicitMonthDate = (text, now = new Date()) => {
  const normalized = normalizeTemporalText(text);
  const match = normalized.match(
    /\b(\d{1,2})\s*[- ]\s*(yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|sentyabr|oktabr|noyabr|dekabr)\b/i
  );

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = monthMap.get(match[2]);
  if (!month) {
    return null;
  }

  let candidate = safeDate(now.getFullYear(), month, day);
  if (!candidate) {
    return null;
  }

  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (candidate < today) {
    candidate = safeDate(now.getFullYear() + 1, month, day);
  }

  return candidate;
};

const extractNumericDate = (text, now = new Date()) => {
  const normalized = normalizeTemporalText(text);
  const match = normalized.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4}))?\b/);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const explicitYear = Number(match[3] || 0) || now.getFullYear();

  let candidate = safeDate(explicitYear, month, day);
  if (!candidate) {
    return null;
  }

  const hasExplicitYear = Boolean(match[3]);
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  if (!hasExplicitYear && candidate < today) {
    candidate = safeDate(now.getFullYear() + 1, month, day);
  }

  return candidate;
};

export const inferRelativeScheduleMinutes = (text) => {
  const normalized = normalizeTemporalText(text);
  const match = normalized.match(buildDurationPattern("keyin|so'ng|song|kegin|keyn|kein"));

  if (!match) {
    return null;
  }

  const amount = parseNumberToken(match[1]);
  return toMinutes(amount, match[2]);
};

export const inferRemindBeforeMinutes = (text) => {
  const normalized = normalizeTemporalText(text);
  const match = normalized.match(buildDurationPattern("oldin|avval|qolganda"));

  if (!match) {
    return null;
  }

  const amount = parseNumberToken(match[1]);
  return toMinutes(amount, match[2]);
};

const inferDayOffset = (text, now = new Date()) => {
  const normalized = normalizeTemporalText(text);

  if (/\bindin\b/.test(normalized)) {
    return 2;
  }

  if (/\bertaga\b/.test(normalized)) {
    return 1;
  }

  if (/\bbugun\b/.test(normalized)) {
    return 0;
  }

  for (const [weekdayLabel, weekday] of weekdayMap.entries()) {
    if (normalized.includes(weekdayLabel)) {
      const currentWeekday = getAppWeekday(now);
      const delta = (weekday - currentWeekday + 7) % 7;
      return delta === 0 ? 7 : delta;
    }
  }

  return null;
};

const applyDayPart = (hour, normalized) => {
  const hasMorningCue = morningPattern.test(normalized);
  const hasDaytimeCue = daytimePattern.test(normalized);
  const hasEveningCue = eveningPattern.test(normalized);

  if (hasEveningCue && hour >= 1 && hour <= 11) {
    return hour + 12;
  }

  if (hasDaytimeCue && hour >= 1 && hour <= 7) {
    return hour + 12;
  }

  if (hasMorningCue && hour === 12) {
    return 0;
  }

  return hour;
};

const parseTimeFromText = (text) => {
  const normalized = normalizeTemporalText(text);
  const hasMorningCue = morningPattern.test(normalized);
  const hasDaytimeCue = daytimePattern.test(normalized);
  const hasEveningCue = eveningPattern.test(normalized);

  let hour = null;
  let minute = 0;

  const numericMatch =
    normalized.match(/\bsoat\s*(\d{1,2})(?::(\d{2}))?\s*(da|ga)?\b/) ||
    normalized.match(/\b(\d{1,2}):(\d{2})\s*(da|ga)?\b/) ||
    normalized.match(/\b(\d{1,2})\s*(da|ga)\b/) ||
    normalized.match(
      /\b(ertalab|ertalabki|tong|tongda|tonggi|tush|tushda|tushlikdan keyin|kunduzi|kunduzgi|kech|kechki|kechqurun|kechqurungi|kechasi|tunda|tungi|tun)\s*(\d{1,2})(?::(\d{2}))?\b/
    );

  if (numericMatch) {
    const hasLeadingDayPart = morningPattern.test(numericMatch[0]) || daytimePattern.test(numericMatch[0]) || eveningPattern.test(numericMatch[0]);

    if (hasLeadingDayPart) {
      hour = Number(numericMatch[2]);
      minute = Number(numericMatch[3] || 0);
    } else if (numericMatch[0].includes(':')) {
      hour = Number(numericMatch[1]);
      minute = Number(numericMatch[2] || 0);
    } else {
      hour = Number(numericMatch[1]);
      minute = Number(numericMatch[2] && /^\d+$/.test(numericMatch[2]) ? numericMatch[2] : 0);
    }
  } else {
    const wordMatch = normalized.match(
      new RegExp(`\\b(?:(soat)\\s*)?(${hourWordAlternatives})(?:\\s+(yarim))?(da|ga)?\\b`, "i")
    );

    if (wordMatch) {
      const [, explicitSoat, hourWord, halfWord, suffix] = wordMatch;
      const shouldAccept = Boolean(explicitSoat || halfWord || suffix || hasMorningCue || hasDaytimeCue || hasEveningCue);

      if (shouldAccept) {
        hour = parseNumberToken(hourWord);
        minute = halfWord ? 30 : 0;
      }
    }
  }

  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    if (hasMorningCue) {
      return { hour: 9, minute: 0 };
    }

    if (hasDaytimeCue) {
      return { hour: 13, minute: 0 };
    }

    if (hasEveningCue) {
      return { hour: 20, minute: 0 };
    }

    return null;
  }

  return { hour: applyDayPart(hour, normalized), minute };
};

const inferBaseDate = (text, now = new Date()) => {
  const explicitMonthDate = extractExplicitMonthDate(text, now);
  if (explicitMonthDate) {
    return explicitMonthDate;
  }

  const numericDate = extractNumericDate(text, now);
  if (numericDate) {
    return numericDate;
  }

  const dayOffset = inferDayOffset(text, now);
  if (dayOffset !== null) {
    return addAbsoluteDays(now, dayOffset);
  }

  return null;
};

export const inferAbsoluteScheduleAt = (text, now = new Date()) => {
  const time = parseTimeFromText(text);
  const baseDate = inferBaseDate(text, now);

  if (!time && !baseDate) {
    return null;
  }

  if (!time && baseDate) {
    return null;
  }

  const date = baseDate ?? now;
  let scheduledAt = setAppClock(date, time.hour, time.minute);

  if (!baseDate && scheduledAt <= now) {
    scheduledAt = addAbsoluteDays(scheduledAt, 1);
  }

  return scheduledAt.toISOString();
};

export const hasAbsoluteTimeCue = (text) => {
  const normalized = normalizeTemporalText(text);

  return /\b(soat\s*\d{1,2}(:\d{2})?|\d{1,2}:\d{2}|\d{1,2}\s*(da|ga)|bugun|ertaga|indin|dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba|ertalab|ertalabki|tong|tongda|tush|tushda|kunduzi|kech|kechki|kechqurun|kechasi|tunda)\b/i.test(
    normalized
  ) || /\b\d{1,2}\s*[- ]\s*(yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentabr|sentyabr|oktabr|noyabr|dekabr)\b/i.test(normalized) || /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{4})?\b/i.test(normalized);
};
