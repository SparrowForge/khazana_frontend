/**
 * Sales History Report — the factory's own menu entry for the Sales History
 * Summary report.
 *
 * This is deliberately a re-export, not a copy: factory users need the report
 * under the Factory Report group with their own permission (`SalesHistoryReport`,
 * since Menu.ControlName is unique and `SalesHistorySummary` already belongs to
 * the Reports entry), but the report itself must stay one implementation. Every
 * future change to the Sales History Summary page therefore lands here too, with
 * nothing to keep in sync. Same arrangement as /factory/discount-log.
 */
export { default } from "@/app/reports/sales-history/page";
