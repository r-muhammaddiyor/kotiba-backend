const legacyBasePattern = /^https?:\/\/api\.uzbekvoice\.ai\/v1\//i;

export const normalizeUzbekVoiceUrl = (url) => {
  const normalized = String(url || "").trim().replace(/\/+$/, "");

  if (!normalized) {
    return "";
  }

  if (legacyBasePattern.test(`${normalized}/`)) {
    return normalized.replace(legacyBasePattern, "https://uzbekvoice.ai/api/v1/");
  }

  return normalized;
};
