"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchDailySales = void 0;
const api_1 = __importDefault(require("@/lib/api"));
/** Factory-only — the backend 403s unless the session branch is the factory.
 *  `branchId` omitted means every branch. */
const fetchDailySales = (fromDate, toDate, branchId) => api_1.default
    .get(`/reports/daily-sales?fromDate=${fromDate}&toDate=${toDate}` +
    `${branchId ? `&branchId=${branchId}` : ""}`)
    .then((r) => r.data);
exports.fetchDailySales = fetchDailySales;
