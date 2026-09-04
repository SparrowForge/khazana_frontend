"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorMessage = getErrorMessage;
const axios_1 = __importDefault(require("axios"));
const api = axios_1.default.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1",
    headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use((config) => {
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (token)
            config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
api.interceptors.response.use((res) => res, (error) => {
    const isLoginRequest = error.config?.url?.includes("/auth/login");
    if (error.response?.status === 401 && !isLoginRequest && typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
    }
    return Promise.reject(error);
});
function getErrorMessage(err, fallback = "Something went wrong") {
    const data = err?.response?.data;
    const msg = data?.message;
    if (Array.isArray(msg) && msg.length)
        return String(msg[0]);
    if (typeof msg === "string" && msg)
        return msg;
    return fallback;
}
exports.default = api;
