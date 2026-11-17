const IST_TIMEZONE = "Asia/Kolkata";

export function toNumber(value: number | string | { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatINR(value: number | string | { toString(): string } | null | undefined): string {
  const amount = toNumber(value);
  const rounded = Math.round(amount * 100) / 100;
  const isWhole = Math.abs(rounded - Math.round(rounded)) < 0.005;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(isWhole ? Math.round(rounded) : rounded);
}

export function formatNumberIN(value: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

export function formatDateIN(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTimeIN(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Returns YYYY-MM-DD in Asia/Kolkata timezone */
export function toISTDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** Returns YYYY-MM-DDTHH:mm in Asia/Kolkata timezone for datetime-local inputs */
export function toISTDateTimeInput(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour = map.hour === "24" ? "00" : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}`;
}

/** Parses YYYY-MM-DD (treated as IST noon) or YYYY-MM-DDTHH:mm (treated as IST) into UTC Date */
export function parseISTDate(value: string): Date {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T12:00:00+05:30`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return new Date(`${trimmed}+05:30`);
  }
  return new Date(trimmed);
}

/** Returns UTC Date range [start, end) covering the IST calendar day */
export function getISTDayBounds(date: Date = new Date()): { start: Date; end: Date } {
  const ymd = toISTDateString(date);
  const start = new Date(`${ymd}T00:00:00.000+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** Returns UTC Date range [start, end) covering an IST calendar month (1-indexed month 1..12) */
export function getISTMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const mm = String(month).padStart(2, "0");
  const start = new Date(`${year}-${mm}-01T00:00:00.000+05:30`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMm = String(nextMonth).padStart(2, "0");
  const end = new Date(`${nextYear}-${nextMm}-01T00:00:00.000+05:30`);
  return { start, end };
}

/** Returns current IST year (e.g. 2026) and month (1..12) */
export function getISTYearMonth(date: Date = new Date()): { year: number; month: number } {
  const ymd = toISTDateString(date);
  const [y, m] = ymd.split("-").map(Number);
  return { year: y, month: m };
}

/** Whole calendar days between two dates in Asia/Kolkata (non-negative) */
export function diffCalendarDaysIST(from: Date, to: Date = new Date()): number {
  const fromBounds = getISTDayBounds(from).start.getTime();
  const toBounds = getISTDayBounds(to).start.getTime();
  const days = Math.round((toBounds - fromBounds) / (24 * 60 * 60 * 1000));
  return Math.max(0, days);
}

export function getDefaultFeedSlotIST(date: Date = new Date()): "MORNING" | "EVENING" | "NIGHT" {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  const hour = Number(hourStr) % 24;
  if (hour < 12) return "MORNING";
  if (hour < 19) return "EVENING";
  return "NIGHT";
}

const SUBSCRIPT_DIGITS: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
};

/**
 * Formats chemical formulas with proper Unicode subscripts and centered dot for hydrates.
 * Example: "MgCl2.6H2O" -> "MgCl₂·6H₂O"
 */
export function formatChemicalFormula(formula: string): string {
  return formula
    .split(".")
    .map((part) => {
      // Keep leading stoichiometric coefficient (e.g. "6" in "6H2O") upright, subscript digits after letters/parens
      return part.replace(/([A-Za-z\)])(\d+)/g, (_, prefix: string, digits: string) => {
        const sub = digits
          .split("")
          .map((d) => SUBSCRIPT_DIGITS[d] ?? d)
          .join("");
        return `${prefix}${sub}`;
      });
    })
    .join("·");
}

/** Formats mineral quantity: shows kg above 1000 g, otherwise g */
export function formatMineralQuantityG(quantityG: number): string {
  if (quantityG > 1000) {
    return `${formatNumberIN(quantityG / 1000, 2)} kg`;
  }
  return `${formatNumberIN(quantityG, 1)} g`;
}

export function normalizeTrayNumber(input: string): string {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error("Tray number must contain digits only");
  }
  const num = Number.parseInt(trimmed, 10);
  if (num < 1) {
    throw new Error("Tray number must be at least 01");
  }
  return num < 100 ? String(num).padStart(2, "0") : String(num);
}

