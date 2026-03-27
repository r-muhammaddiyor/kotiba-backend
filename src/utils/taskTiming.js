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

const weekdayMap = new Map([
  ["yakshanba", 0],
  ["dushanba", 1],
  ["seshanba", 2],
  ["chorshanba", 3],
  ["payshanba", 4],
  ["juma", 5],
  ["shanba", 6]
]);

const morningPattern = /\b(ertalab|ertalabki|tong|tongda|tonggi)\b/i;
const daytimePattern = /\b(tush|tushda|tushlikdan keyin|kunduzi|kunduzgi)\b/i;
const eveningPattern = /\b(kech|kechki|kechqurun|kechqurungi|kechasi|tunda|tungi|tun)\b/i;

const normalizeTemporalText = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[ʻ’‘`]/g, "'")
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

const parseTimeFromText = (text) => {
  const normalized = normalizeTemporalText(text);
  const explicitMatch =
    normalized.match(/\bsoat\s*(\d{1,2})(?::(\d{2}))?\s*(da|ga)?\b/) ||
    normalized.match(/\b(\d{1,2}):(\d{2})\b/) ||
    normalized.match(/\b(ertalab|ertalabki|tong|tongda|tonggi|tush|tushda|tushlikdan keyin|kunduzi|kunduzgi|kech|kechki|kechqurun|kechqurungi|kechasi|tunda|tungi|tun)\s*(\d{1,2})(?::(\d{2}))?\b/);

  if (!explicitMatch) {
    return null;
  }

  const hasLeadingDayPart = morningPattern.test(explicitMatch[0]) || daytimePattern.test(explicitMatch[0]) || eveningPattern.test(explicitMatch[0]);
  const hourToken = hasLeadingDayPart ? explicitMatch[2] : explicitMatch[1];
  const minuteToken = hasLeadingDayPart ? explicitMatch[3] : explicitMatch[2];

  let hour = Number(hourToken);
  const minute = Number(minuteToken || 0);

  if (!Number.isFinite(hour) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  if (eveningPattern.test(normalized) && hour >= 1 && hour <= 11) {
    hour += 12;
  } else if (daytimePattern.test(normalized) && hour >= 1 && hour <= 7) {
    hour += 12;
  } else if (morningPattern.test(normalized) && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
};

export const inferAbsoluteScheduleAt = (text, now = new Date()) => {
  const time = parseTimeFromText(text);
  if (!time) {
    return null;
  }

  const dayOffset = inferDayOffset(text, now);

  if (dayOffset !== null) {
    const targetDate = addAbsoluteDays(now, dayOffset);
    return setAppClock(targetDate, time.hour, time.minute).toISOString();
  }

  const todayCandidate = setAppClock(now, time.hour, time.minute);
  return todayCandidate > now ? todayCandidate.toISOString() : addAbsoluteDays(todayCandidate, 1).toISOString();
};

export const hasAbsoluteTimeCue = (text) =>
  /\b(soat\s*\d{1,2}(:\d{2})?|\d{1,2}:\d{2}|bugun|ertaga|indin|dushanba|seshanba|chorshanba|payshanba|juma|shanba|yakshanba|ertalab|ertalabki|kech|kechki|kechqurun|tunda|tushda|tush)\b/i.test(
    String(text || "")
  );
