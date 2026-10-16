// Адрес бэкенда. На Vercel задаётся через VITE_API_URL при сборке,
// локально работает по умолчанию.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5071/api";

// true — работа на заглушке, без сервера. По умолчанию false:
// локально ты тоже запускаешь с настоящим бэкендом.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";