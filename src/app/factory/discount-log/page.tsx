/**
 * Discount Log Report — the factory's own menu entry for the Discount Summary
 * report.
 *
 * This is deliberately a re-export, not a copy: factory users need the report
 * under the Factory Report group with their own permission (`DiscountLogReport`,
 * since Menu.ControlName is unique and `DiscountSummary` already belongs to the
 * Reports entry), but the report itself must stay one implementation. Every
 * future change to the Discount Summary page therefore lands here too, with
 * nothing to keep in sync.
 */
export { default } from "@/app/reports/discount-summary/page";
