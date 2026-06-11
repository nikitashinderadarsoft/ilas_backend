const normalizeVisitingDates = (visitingDates) => {
  if (Array.isArray(visitingDates)) return visitingDates;
  if (!visitingDates) return [];

  if (typeof visitingDates === "string") {
    try {
      const parsed = JSON.parse(visitingDates);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      // Keep fallback behavior for plain strings.
    }

    return visitingDates
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [visitingDates];
};

const parseExactDate = (year, month, day) => {
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
    return parsed;
  }

  return null;
};

const parseYmdDate = (raw) => {
  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!ymdMatch) return null;

  const year = Number(ymdMatch[1]);
  const month = Number(ymdMatch[2]);
  const day = Number(ymdMatch[3]);
  return parseExactDate(year, month, day);
};

const parseDmyDate = (raw) => {
  const dmyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!dmyMatch) return null;

  const day = Number(dmyMatch[1]);
  const month = Number(dmyMatch[2]);
  const year = Number(dmyMatch[3]);
  return parseExactDate(year, month, day);
};

const parseLongDate = (raw) => {
  // Regex to match "12 June 2026" or "12 Jun 2026"
  const match = raw.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const monthName = match[2];
  const year = Number(match[3]);

  // Use a temporary date to get the month index from the name
  const tempDate = new Date(`${monthName} 1, ${year}`);
  const month = tempDate.getMonth() + 1; // getMonth is 0-indexed

  if (isNaN(month)) return null;

  return parseExactDate(year, month, day);
};

const parseVisitingDate = (dateValue) => {
  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  if (typeof dateValue !== "string") return null;

  const raw = dateValue.trim();
  if (!raw) return null;

  return parseYmdDate(raw) || parseDmyDate(raw) || parseLongDate(raw) || new Date(raw);
};

const getDaySuffix = (day) => {
  if (day >= 11 && day <= 13) return "th";
  if (day % 10 === 1) return "st";
  if (day % 10 === 2) return "nd";
  if (day % 10 === 3) return "rd";
  return "th";
};

const toBadgeDatePart = (dateValue) => {
  const dateObj = parseVisitingDate(dateValue);
  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;

  return {
    day: dateObj.getUTCDate(),
    monthName: dateObj.toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    }),
    year: dateObj.getUTCFullYear(),
    ts: dateObj.getTime(),
  };
};

const formatDayList = (parts) =>
  parts
    .map(({ day }) => `${day}${getDaySuffix(day)}`)
    .join(", ")
    .replace(/, ([^,]*)$/, " & $1");

const formatFullDateList = (parts) =>
  parts
    .map(({ day, monthName, year }) => `${day}${getDaySuffix(day)} ${monthName} ${year}`)
    .join(", ")
    .replace(/, ([^,]*)$/, " & $1");

const getValidBadgeDateParts = (visitingDates) =>
  normalizeVisitingDates(visitingDates)
    .map(toBadgeDatePart)
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

const getVisitingDateCount = (visitingDates) => normalizeVisitingDates(visitingDates).length;

const buildBadgeValidityText = (visitingDates, onlyDates = false) => {
  const parts = getValidBadgeDateParts(visitingDates);
  if (!parts.length) return onlyDates ? "" : "Valid on ";

  const firstDate = parts[0];
  const hasSharedMonthAndYear = parts.every(({ monthName, year }) => monthName === firstDate.monthName && year === firstDate.year);

  if (hasSharedMonthAndYear) {
    return `${onlyDates ? "" : "Valid on "}${formatDayList(parts)} ${firstDate.monthName} ${firstDate.year}`;
  }

  return `${onlyDates ? "" : "Valid on "}${formatFullDateList(parts)}`;
};

module.exports = {
  buildBadgeValidityText,
  getVisitingDateCount,
};
