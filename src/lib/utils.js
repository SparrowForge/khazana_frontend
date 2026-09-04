"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cn = cn;
exports.formatCurrency = formatCurrency;
exports.formatDate = formatDate;
exports.formatDateTime = formatDateTime;
exports.toInputDate = toInputDate;
exports.roundPayable = roundPayable;
exports.generateId = generateId;
exports.amountInWords = amountInWords;
const clsx_1 = require("clsx");
const tailwind_merge_1 = require("tailwind-merge");
function cn(...inputs) {
    return (0, tailwind_merge_1.twMerge)((0, clsx_1.clsx)(inputs));
}
function formatCurrency(value) {
    const num = Number(value ?? 0);
    return new Intl.NumberFormat("en-BD", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Every date in the system reads DD-MMM-YYYY (04-Aug-2026) — the format the
 *  printed documents and the legacy sheets have always used, and the one that
 *  cannot be misread as month-first the way 04/08/2026 can.
 *
 *  Rendered in local time, not UTC: the same value is used for plain dates and
 *  for created/updated timestamps, and pulling a late-evening timestamp back to
 *  UTC would print it as the day before.
 *
 *  A bare `YYYY-MM-DD` — what every date input and date filter holds — is read
 *  as the calendar date it says, NOT as UTC midnight. `new Date("2026-08-29")`
 *  is UTC, so anywhere west of Greenwich it would print 28-Aug-2026. */
function formatDate(date) {
    if (!date)
        return "-";
    const plain = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
    const d = plain
        ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
        : new Date(date);
    if (isNaN(d.getTime()))
        return "-";
    return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}
/** The same date, with a 12-hour clock after it. */
function formatDateTime(date) {
    if (!date)
        return "-";
    const d = new Date(date);
    if (isNaN(d.getTime()))
        return "-";
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${formatDate(d)} ${time}`;
}
/** `YYYY-MM-DD` for an `<input type="date">`, read off the LOCAL clock.
 *
 *  Not `toISOString().split("T")[0]`, which is UTC: at 2am in Dhaka that still
 *  reads as yesterday, so a filter defaulted to "today" would open on the wrong
 *  day for anyone working an early or a late shift. */
function toInputDate(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
/**
 * A bill is settled in notes and coins, not in paisa, so the amount a customer
 * is asked for is rounded to the whole taka: ৳4949.99 is charged, printed and
 * recorded as ৳4950.
 *
 * Mirrors `roundPayable` in the backend's common/helpers — the server rounds the
 * figure it stores, this rounds the figure on screen, and they must agree or the
 * checkout would refuse a payment the customer had already handed over. Lines,
 * VAT and the discount keep their exact values.
 */
function roundPayable(amount) {
    return Math.round(amount);
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
const ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
/** 0–99 → words. */
function twoDigits(n) {
    if (n < 20)
        return ONES[n];
    const t = TENS[Math.floor(n / 10)];
    const o = ONES[n % 10];
    return o ? `${t} ${o}` : t;
}
/** 0–999 → words. */
function threeDigits(n) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    const parts = [];
    if (h)
        parts.push(`${ONES[h]} Hundred`);
    if (rest)
        parts.push(twoDigits(rest));
    return parts.join(" ");
}
/**
 * Amount in words on the South-Asian scale (Crore / Lakh / Thousand), as printed
 * on a Mushak 6.3 invoice. Poisha (the 2dp remainder) is spelled out too.
 * e.g. 1234.50 → "One Thousand Two Hundred Thirty Four Taka and Fifty Poisha Only"
 */
function amountInWords(value) {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num))
        return "";
    const negative = num < 0;
    const abs = Math.abs(num);
    const taka = Math.floor(abs);
    const poisha = Math.round((abs - taka) * 100);
    const groups = [];
    const crore = Math.floor(taka / 10000000);
    const lakh = Math.floor((taka % 10000000) / 100000);
    const thousand = Math.floor((taka % 100000) / 1000);
    const hundred = taka % 1000;
    if (crore)
        groups.push(`${threeDigits(crore)} Crore`);
    if (lakh)
        groups.push(`${threeDigits(lakh)} Lakh`);
    if (thousand)
        groups.push(`${threeDigits(thousand)} Thousand`);
    if (hundred)
        groups.push(threeDigits(hundred));
    const takaWords = groups.length ? groups.join(" ") : "Zero";
    const words = poisha
        ? `${takaWords} Taka and ${twoDigits(poisha)} Poisha`
        : `${takaWords} Taka`;
    return `${negative ? "Minus " : ""}${words} Only`;
}
