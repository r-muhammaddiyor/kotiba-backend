const replacements = [
  [/[К»Кј`вЂ™]/gu, "'"],
  [/\bbugn\b/giu, "bugun"],
  [/\bertg\b/giu, "ertaga"],
  [/\bkegin\b/giu, "keyin"],
  [/\bkeyn\b/giu, "keyin"],
  [/\bkegn\b/giu, "keyin"],
  [/\bso'ngi\b/giu, "so'ng"],
  [/\bqngiroq\b/giu, "qo'ng'iroq"],
  [/\bqongiroq\b/giu, "qo'ng'iroq"],
  [/\bqngiro\b/giu, "qo'ng'iroq"],
  [/\bqngro\b/giu, "qo'ng'iroq"],
  [/\bdoktr\b/giu, "doktor"],
  [/\bdocor\b/giu, "doktor"],
  [/\bdoxtir\b/giu, "doktor"],
  [/\bkereda\b/giu, "kerak"],
  [/\bkere\b/giu, "kerak"],
  [/\bsu ich\b/giu, "suv ich"],
  [/\bsu ichsh\b/giu, "suv ichish"],
  [/\byugursh\b/giu, "yugurish"],
  [/\bbugn\b/giu, "bugun"],
  [/\bkece\b/giu, "kechqurun"],
  [/\besat\b/giu, "eslat"],
  [/\betvor\b/giu, "eslatib qo'y"],
];

export const normalizeKotibaInput = (input = "") => {
  let text = String(input || "").trim();

  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }

  return text.replace(/\s+/g, " ").trim();
};
