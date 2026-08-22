import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-BD", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-BD");
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

/** 0–99 → words. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = ONES[n % 10];
  return o ? `${t} ${o}` : t;
}

/** 0–999 → words. */
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/**
 * Amount in words on the South-Asian scale (Crore / Lakh / Thousand), as printed
 * on a Mushak 6.3 invoice. Poisha (the 2dp remainder) is spelled out too.
 * e.g. 1234.50 → "One Thousand Two Hundred Thirty Four Taka and Fifty Poisha Only"
 */
export function amountInWords(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "";
  const negative = num < 0;
  const abs = Math.abs(num);

  const taka = Math.floor(abs);
  const poisha = Math.round((abs - taka) * 100);

  const groups: string[] = [];
  const crore = Math.floor(taka / 10_000_000);
  const lakh = Math.floor((taka % 10_000_000) / 100_000);
  const thousand = Math.floor((taka % 100_000) / 1_000);
  const hundred = taka % 1_000;

  if (crore) groups.push(`${threeDigits(crore)} Crore`);
  if (lakh) groups.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) groups.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) groups.push(threeDigits(hundred));

  const takaWords = groups.length ? groups.join(" ") : "Zero";
  const words = poisha
    ? `${takaWords} Taka and ${twoDigits(poisha)} Poisha`
    : `${takaWords} Taka`;

  return `${negative ? "Minus " : ""}${words} Only`;
}
