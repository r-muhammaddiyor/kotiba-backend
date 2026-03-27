import { env } from "../config/env.js";

const parseOffsetToMinutes = (offset) => {
  const match = String(offset || "+00:00").match(/^([+-])(\d{2}):?(\d{2})$/);
  if (!match) {
    return 0;
  }

  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
};

const offsetMinutes = parseOffsetToMinutes(env.appUtcOffset);

const shiftToAppTime = (date) => new Date(date.getTime() + offsetMinutes * 60 * 1000);

const unshiftFromAppParts = (year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) =>
  new Date(Date.UTC(year, month, day, hour, minute, second, millisecond) - offsetMinutes * 60 * 1000);

export const addAbsoluteDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

export const startOfAppDay = (date = new Date()) => {
  const shifted = shiftToAppTime(date);
  return unshiftFromAppParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
};

export const endOfAppDay = (date = new Date()) => {
  const shifted = shiftToAppTime(date);
  return unshiftFromAppParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 23, 59, 59, 999);
};

export const startOfAppWeek = (date = new Date()) => {
  const shifted = shiftToAppTime(date);
  const weekday = shifted.getUTCDay();
  const diff = weekday === 0 ? 6 : weekday - 1;
  const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diff);
  return unshiftFromAppParts(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
};

export const startOfAppMonth = (date = new Date()) => {
  const shifted = shiftToAppTime(date);
  return unshiftFromAppParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
};

export const formatInAppTimeZone = (value, options = {}) =>
  new Intl.DateTimeFormat("uz-UZ", {
    timeZone: env.appTimeZone,
    ...options
  }).format(new Date(value));
