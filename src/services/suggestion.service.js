const suggestionMap = [
  { pattern: /(uchrashuv|meeting)/i, tip: "Uchrashuv uchun eslatma qo'yishni xohlaysizmi?" },
  { pattern: /(hisobot|report)/i, tip: "Hisobot vazifasini Task Manager'ga qo'shaymi?" },
  { pattern: /(qo'ng'iroq|call)/i, tip: "Qo'ng'iroq vaqtini belgilab eslatma qo'yishingiz mumkin." },
  { pattern: /(deadline|muddat)/i, tip: "Muddatga 1 kun qolganida reminder berishni tavsiya qilaman." }
];

export const buildSmartSuggestions = (text) => {
  if (!text) {
    return [
      "Yangi vazifa qo'shing",
      "Bugungi reja haqida so'rang",
      "Eslatma o'rnating"
    ];
  }

  const dynamic = suggestionMap
    .filter((item) => item.pattern.test(text))
    .map((item) => item.tip);

  const defaults = [
    "Buni vazifaga aylantirishni xohlaysizmi?",
    "Shu mavzu bo'yicha qisqa reja tuzib beraymi?",
    "Eslatma bilan davom ettiraymi?"
  ];

  return [...dynamic, ...defaults].slice(0, 4);
};
