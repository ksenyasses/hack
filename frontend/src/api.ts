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

// Остаток по продукту (агрегат по всем партиям)
export type StockItem = {
  id: number;
  name: string;
  unit: string;
  minStock: number;
  quantity: number;
  nearestExpiry: string | null;
  daysLeft: number | null;
  status: string;
  belowMinStock: boolean;
};

// Отдельная партия товара
export type BatchItem = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  expiryDate: string;
  receivedAt: string;
  deliveryNumber: string;
  daysLeft: number;
  status: string;
};

// Партия, созданная при оформлении поставки
export type DeliveryBatch = {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  expiryDate: string;
  daysLeft: number;
  status: string;
};

// Поставка целиком
export type Delivery = {
  id: number;
  number: string;
  createdAt: string;
  batches: DeliveryBatch[];
};

// Что отправляем на сервер при оформлении
export type DeliveryData = {
  number: string;
  comment?: string;
  items: { productId: number; quantity: number; expiryDate?: string }[];
};

// Ингредиент блюда (одна строка рецепта)
export type RecipeItem = {
  productId: number;
  productName: string;
  quantityPerPortion: number;
};

// Блюдо с рецептом и доступностью
export type Dish = {
  id: number;
  name: string;
  recipe: RecipeItem[];
  availablePortions: number;
  inStopList: boolean;
  reason: string | null;
};

// Что отправляем на сервер при создании/изменении блюда
export type DishData = {
  name: string;
  recipe: { productId: number; quantityPerPortion: number }[];
};

// Дата через N дней от сегодня в формате YYYY-MM-DD (для заглушки)
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Сколько дней от сегодня до указанной даты (отрицательно — уже прошло)
function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso.slice(0, 10));
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

// Статус партии по дням до срока
function statusFor(daysLeft: number): string {
  if (daysLeft < 0) return "Просрочен";
  if (daysLeft <= 3) return "Скоро истекает";
  return "Годен";
}

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

// Массив в памяти: работает, пока USE_MOCK = true
let mockProducts: Product[] = [
  { id: 1, name: "Курица", unit: "кг", minStock: 2, shelfLifeDays: 3 },
  { id: 2, name: "Помидор", unit: "кг", minStock: 5, shelfLifeDays: 7 },
  { id: 3, name: "Масло", unit: "л", minStock: 1, shelfLifeDays: 30 },
];
let mockNextId = 4;

// Список продуктов
export async function getProducts(): Promise<Product[]> {
  if (USE_MOCK) return [...mockProducts];
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

// --- Склад ---

// Остатки: общий массив, им пользуются getStock и расчёт порций в блюдах
const mockStockData: StockItem[] = [
  {
    id: 1, name: "Курица", unit: "кг", minStock: 2, quantity: 6,
    nearestExpiry: inDays(2), daysLeft: 2,
    status: "Скоро истекает", belowMinStock: false,
  },
  {
    id: 2, name: "Помидор", unit: "кг", minStock: 5, quantity: 1.5,
    nearestExpiry: inDays(7), daysLeft: 7,
    status: "Годен", belowMinStock: true,
  },
  {
    id: 3, name: "Масло", unit: "л", minStock: 1, quantity: 0,
    nearestExpiry: null, daysLeft: null,
    status: "Закончился", belowMinStock: true,
  },
];

// Остатки
export async function getStock(): Promise<StockItem[]> {
  if (USE_MOCK) return mockStockData.map((s) => ({ ...s }));
  const res = await api.get<StockItem[]>("/stock");
  return res.data;
}

// Партии
export async function getBatches(): Promise<BatchItem[]> {
  if (USE_MOCK) {
    return [
      {
        id: 1, productId: 1, productName: "Курица", quantity: 3,
        expiryDate: inDays(2), receivedAt: inDays(-2),
        deliveryNumber: "П-1002", daysLeft: 2, status: "Скоро истекает",
      },
      {
        id: 2, productId: 1, productName: "Курица", quantity: 3,
        expiryDate: inDays(5), receivedAt: inDays(-5),
        deliveryNumber: "П-1001", daysLeft: 5, status: "Годен",
      },
      {
        id: 3, productId: 2, productName: "Помидор", quantity: 1.5,
        expiryDate: inDays(7), receivedAt: inDays(-5),
        deliveryNumber: "П-1001", daysLeft: 7, status: "Годен",
      },
    ];
  }
  const res = await api.get<BatchItem[]>("/batches");
  return res.data;
}

// --- Поставки (приёмка) ---

// Оформленные поставки в памяти (для проверки дублей по номеру)
let mockDeliveries: Delivery[] = [];
let mockDeliveryId = 1;
let mockBatchId = 100;

// Оформить поставку: создаёт партии, считает сроки годности
export async function createDelivery(data: DeliveryData): Promise<Delivery> {
  if (USE_MOCK) {
    if (!data.number.trim()) {
      throw new Error("Введите номер поставки");
    }
    if (data.items.length === 0) {
      throw new Error("Добавьте хотя бы одну строку");
    }
    if (mockDeliveries.some((d) => d.number === data.number.trim())) {
      throw new Error("Поставка с таким номером уже есть");
    }

    const batches: DeliveryBatch[] = [];
    for (const item of data.items) {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Количество в каждой строке должно быть больше нуля");
      }
      const product = mockProducts.find((p) => p.id === item.productId);
      if (!product) {
        throw new Error("Продукт не найден — обновите страницу");
      }

      // Главная фишка: если срок не указан — считаем = сегодня + срок хранения продукта
      let expiryDate: string;
      if (item.expiryDate) {
        if (daysUntil(item.expiryDate) < 0) {
          throw new Error("Указан уже прошедший срок годности");
        }
        expiryDate = item.expiryDate;
      } else {
        expiryDate = inDays(product.shelfLifeDays);
      }

      const daysLeft = daysUntil(expiryDate);
      batches.push({
        id: mockBatchId++,
        productId: product.id,
        productName: product.name,
        quantity,
        expiryDate,
        daysLeft,
        status: statusFor(daysLeft),
      });
    }

    const delivery: Delivery = {
      id: mockDeliveryId++,
      number: data.number.trim(),
      createdAt: new Date().toISOString(),
      batches,
    };
    mockDeliveries.push(delivery);
    return delivery;
  }
  const res = await api.post<Delivery>("/deliveries", data);
  return res.data;
}

// Список поставок
export async function getDeliveries(): Promise<Delivery[]> {
  if (USE_MOCK) return [...mockDeliveries];
  const res = await api.get<Delivery[]>("/deliveries");
  return res.data;
}

// --- Блюда ---

// Сколько порций получится из текущих остатков:
// по каждому ингредиенту остаток делим на количество на порцию,
// округляем вниз и берём минимум — чего-то не хватает, столько и выйдет
function portionsFromStock(recipe: { productId: number; quantityPerPortion: number }[]): number {
  let min = Infinity;
  for (const item of recipe) {
    const stock = mockStockData.find((s) => s.id === item.productId);
    const quantity = stock ? stock.quantity : 0;
    min = Math.min(min, Math.floor(quantity / item.quantityPerPortion));
  }
  return min === Infinity ? 0 : min;
}

// Моковые блюда
let mockDishes: Dish[] = [
  {
    id: 1,
    name: "Цезарь",
    recipe: [
      { productId: 1, productName: "Курица", quantityPerPortion: 0.2 },
      { productId: 2, productName: "Помидор", quantityPerPortion: 0.1 },
    ],
    availablePortions: 12,
    inStopList: false,
    reason: null,
  },
  {
    id: 2,
    name: "Куриный суп",
    recipe: [
      { productId: 1, productName: "Курица", quantityPerPortion: 0.1 },
    ],
    availablePortions: 25,
    inStopList: false,
    reason: null,
  },
];
let mockDishId = 3;

// Список блюд
export async function getDishes(): Promise<Dish[]> {
  if (USE_MOCK) return mockDishes.map((d) => ({ ...d }));
  const res = await api.get<Dish[]>("/dishes");
  return res.data;
}

// Создание блюда: считает, сколько порций получится из остатков
export async function createDish(data: DishData): Promise<Dish> {
  if (USE_MOCK) {
    if (!data.name.trim()) {
      throw new Error("Введите название блюда");
    }
    if (data.recipe.length === 0) {
      throw new Error("Добавьте хотя бы один ингредиент");
    }
    for (const item of data.recipe) {
      const q = Number(item.quantityPerPortion);
      if (!Number.isFinite(q) || q <= 0) {
        throw new Error("Количество ингредиента должно быть больше нуля");
      }
    }

    const dish: Dish = {
      id: mockDishId++,
      name: data.name.trim(),
      recipe: data.recipe.map((item) => {
        const product = mockProducts.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          productName: product ? product.name : "?",
          quantityPerPortion: item.quantityPerPortion,
        };
      }),
      availablePortions: portionsFromStock(data.recipe),
      inStopList: false,
      reason: null,
    };
    mockDishes.push(dish);
    return dish;
  }
  const res = await api.post<Dish>("/dishes", data);
  return res.data;
}

// Обновление блюда: название и рецепт (для кнопки «Изменить»)
export async function updateDish(id: number, data: DishData): Promise<Dish> {
  if (USE_MOCK) {
    if (!data.name.trim()) {
      throw new Error("Введите название блюда");
    }
    if (data.recipe.length === 0) {
      throw new Error("Добавьте хотя бы один ингредиент");
    }
    for (const item of data.recipe) {
      const q = Number(item.quantityPerPortion);
      if (!Number.isFinite(q) || q <= 0) {
        throw new Error("Количество ингредиента должно быть больше нуля");
      }
    }
    const index = mockDishes.findIndex((d) => d.id === id);
    if (index < 0) {
      throw new Error("Блюдо не найдено");
    }
    const old = mockDishes[index];
    const updated: Dish = {
      ...old,
      name: data.name.trim(),
      recipe: data.recipe.map((item) => {
        const product = mockProducts.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          productName: product ? product.name : "?",
          quantityPerPortion: item.quantityPerPortion,
        };
      }),
      // Порции пересчитываем: изменили рецепт — изменилось и то, сколько выйдет
      availablePortions: portionsFromStock(data.recipe),
    };
    mockDishes[index] = updated;
    return updated;
  }
  const res = await api.put<Dish>(`/dishes/${id}`, data);
  return res.data;
}

// --- Заготовки для будущих разделов ---
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