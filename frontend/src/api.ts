import axios from "axios";
import { API_URL, USE_MOCK } from "./config";

// axios-инстанс: все запросы идут на API_URL
const api = axios.create({ baseURL: API_URL });

// Перехватчик: добавляем токен из localStorage к каждому запросу
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type Role = "Manager" | "Cook" | "Waiter";

export type LoginResponse = { token: string; role: Role; fullName: string };

// Продукт справочника
export type Product = {
  id: number;
  name: string;
  unit: string;
  minStock: number;
  shelfLifeDays: number;
};

// Данные нового продукта (без id — его присвоит сервер)
export type ProductData = {
  name: string;
  unit: string;
  minStock: number;
  shelfLifeDays: number;
};

// Вход: POST /auth/login
export async function login(login: string, password: string): Promise<LoginResponse> {
  if (USE_MOCK) {
    if (!login.trim() || !password.trim()) {
      throw new Error("Введите логин и пароль");
    }
    // В заглушке роль определяется логином: manager / cook / waiter
    const key = login.trim().toLowerCase();
    const role: Role = key === "cook" ? "Cook" : key === "waiter" ? "Waiter" : "Manager";
    const fullName = role === "Manager" ? "Управляющий" : role === "Cook" ? "Повар" : "Официант";
    return { token: "mock-token", role, fullName };
  }
  const res = await api.post<LoginResponse>("/auth/login", { login, password });
  return res.data;
}

// --- Продукты ---

// Массив в памяти: работает, пока USE_MOCK = true.
// После переключения на сервер данные будут приходить с бэкенда.
let mockProducts: Product[] = [
  { id: 1, name: "Курица", unit: "кг", minStock: 2, shelfLifeDays: 3 },
  { id: 2, name: "Помидор", unit: "кг", minStock: 5, shelfLifeDays: 7 },
  { id: 3, name: "Масло", unit: "л", minStock: 1, shelfLifeDays: 30 },
];
let mockNextId = 4;

// Список продуктов
export async function getProducts(): Promise<Product[]> {
  if (USE_MOCK) return [...mockProducts]; // копия, чтобы не редактировали массив снаружи
  const res = await api.get<Product[]>("/products");
  return res.data;
}

// Создание продукта
export async function createProduct(data: ProductData): Promise<Product> {
  if (USE_MOCK) {
    const created: Product = { id: mockNextId++, ...data };
    mockProducts.push(created);
    return created;
  }
  const res = await api.post<Product>("/products", data);
  return res.data;
}

// Архивация продукта
export async function archiveProduct(id: number): Promise<void> {
  if (USE_MOCK) {
    mockProducts = mockProducts.filter((p) => p.id !== id);
    return;
  }
  await api.delete(`/products/${id}`);
}

// --- Заготовки для будущих разделов ---
export async function getStock() {
  if (USE_MOCK) return [];
  const res = await api.get("/stock");
  return res.data;
}

export async function getDishes() {
  if (USE_MOCK) return [];
  const res = await api.get("/dishes");
  return res.data;
}

export async function getStopList() {
  if (USE_MOCK) return [];
  const res = await api.get("/stop-list");
  return res.data;
}

export async function getHotOffers() {
  if (USE_MOCK) return [];
  const res = await api.get("/hot-offers");
  return res.data;
}