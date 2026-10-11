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
  manuallyStopped: boolean;
  promoUntil: string | null; // "2026-10-10" или null
  isPromo: boolean;
  reason: string | null;
};

// Что отправляем на сервер при создании/изменении блюда
export type DishData = {
  name: string;
  recipe: { productId: number; quantityPerPortion: number }[];
};

// Одна позиция заказа: блюдо и сколько порций
export type OrderItemInput = { dishId: number; quantity: number };

// Результат оформленного заказа
export type OrderResult = {
  id: number;
  createdAt: string;
  items: OrderItemInput[];
};

// Четыре счётчика на дашборде
export type KpiCounters = {
  products: number;
  expired: number;
  dishesInStopList: number;
  expiringSoon: number;
};

// Позиция, у которой скоро истекает срок
export type ExpiringItem = {
  productName: string;
  unit: string;
  quantity: number;
  expiryDate: string;
  daysLeft: number;
  deliveryNumber?: string;
};

// Позиция, у которой срок уже вышел (у бэкенда для неё поле daysOverdue)
export type ExpiredItem = {
  productName: string;
  unit: string;
  quantity: number;
  expiryDate: string;
  daysOverdue: number;
  deliveryNumber?: string;
};

// Позиция, которая заканчивается (ниже минимума)
export type LowStockItem = {
  name: string;
  unit: string;
  quantity: number;
  minStock: number;
  toOrder: number;
};

// Блюдо в стоп-листе (для блока на дашборде)
export type StopItem = {
  id: number;
  name: string;
  reason: string;
};

// Строка стоп-листа: блюдо, которого сейчас нельзя продавать
export type StopListItem = {
  id: number;
  name: string;
  availablePortions: number;
  reason: string | null;
};

// Всё, что нужно дашборду, одним куском
export type DashboardData = {
  generatedAt: string;
  counters: KpiCounters;
  expiringSoon: ExpiringItem[];
  expired: ExpiredItem[];
  runningLow: LowStockItem[];
  stopList: StopItem[];
};

// Горячее предложение — блюдо, которое надо продать сегодня
export type HotOffer = {
  id: number;
  name: string;
  priority: number;
  coverPortions: number;
  reason: string;
  // Включена ли акция «Блюдо дня»
  isPromo: boolean;
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

// Моковые блюда — данные из задания на «Меню» официанта
let mockDishes: Dish[] = [
  {
    id: 1, name: "Карбонара",
    recipe: [{ productId: 3, productName: "Сливки", quantityPerPortion: 0.15 }],
    availablePortions: 12, inStopList: false, manuallyStopped: false,
    promoUntil: "2026-10-10", isPromo: true, reason: null,
  },
  {
    id: 2, name: "Том-ям",
    recipe: [{ productId: 2, productName: "Помидор", quantityPerPortion: 0.1 }],
    availablePortions: 5, inStopList: false, manuallyStopped: false,
    promoUntil: null, isPromo: false, reason: null,
  },
  {
    id: 3, name: "Цезарь",
    recipe: [{ productId: 1, productName: "Курица", quantityPerPortion: 0.2 }],
    availablePortions: 0, inStopList: true, manuallyStopped: false,
    promoUntil: null, isPromo: false,
    reason: "Недостаточно Курица: нужно 0.20 кг, доступно 0.05 кг",
  },
];
let mockDishId = 4;

// Список блюд
export async function getDishes(): Promise<Dish[]> {
  if (USE_MOCK) return [...mockDishes];
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
      manuallyStopped: false,
      promoUntil: null,
      isPromo: false,
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

// --- Заказы (оформление продажи) ---

// Номер следующего заказа
let mockOrderId = 1;

// Оформить заказ: проверяет остатки и списывает продукты со склада
export async function createOrder(items: OrderItemInput[]): Promise<OrderResult> {
  if (USE_MOCK) {
    if (items.length === 0) {
      throw new Error("Заказ пустой");
    }

    // Считаем, сколько каждого продукта нужно на все порции.
    // Одно блюдо может встретиться несколько раз — складываем потребность.
    const need = new Map<number, number>();
    for (const item of items) {
      const dish = mockDishes.find((d) => d.id === item.dishId);
      if (!dish) {
        throw new Error("Блюдо не найдено — обновите страницу");
      }
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        throw new Error("Количество порций должно быть больше нуля");
      }
      for (const r of dish.recipe) {
        const required = r.quantityPerPortion * item.quantity;
        need.set(r.productId, (need.get(r.productId) ?? 0) + required);
      }
    }

    // Сравниваем с остатком: чего-то не хватает — отказ текстом, как сервер
    for (const [productId, required] of need) {
      const stock = mockStockData.find((s) => s.id === productId);
      const available = stock ? stock.quantity : 0;
      const unit = stock ? stock.unit : "";
      if (required > available) {
        const name = stock ? stock.name.toLowerCase() : "продукт";
        throw new Error(
          `Недостаточно ${name}: нужно ${required.toFixed(2)} ${unit}, ` +
            `доступно ${available.toFixed(2)} ${unit}`
        );
      }
    }

    // Всё есть — списываем со склада (округляем, чтобы не плыли дроби)
    for (const [productId, required] of need) {
      const stock = mockStockData.find((s) => s.id === productId);
      if (stock) {
        stock.quantity = Math.round((stock.quantity - required) * 100) / 100;
        if (stock.quantity <= 0) {
          stock.quantity = 0;
          stock.status = "Закончился";
          stock.nearestExpiry = null;
          stock.daysLeft = null;
        }
        // Если стало меньше минимума — подсвечиваем красным в «Складе»
        stock.belowMinStock = stock.quantity < stock.minStock;
      }
    }

    return { id: mockOrderId++, createdAt: new Date().toISOString(), items };
  }
  const res = await api.post<OrderResult>("/orders", { items });
  return res.data;
}

// Список заказов (заготовка для будущего раздела «Мои продажи»)
export async function getOrders(): Promise<OrderResult[]> {
  if (USE_MOCK) return [];
  const res = await api.get<OrderResult[]>("/orders");
  return res.data;
}

// --- Дашборд и горячие предложения ---

// Данные-заглушки дашборда (счётчики и три карточки)
const mockDashboard: DashboardData = {
  generatedAt: "2026-10-09T14:35:00Z",
  counters: { products: 18, expired: 1, dishesInStopList: 3, expiringSoon: 4 },
  expiringSoon: [
    { productName: "Сливки", unit: "л", quantity: 1.8, expiryDate: "2026-10-10", daysLeft: 1, deliveryNumber: "П-1001" },
    { productName: "Курица", unit: "кг", quantity: 2.25, expiryDate: "2026-10-12", daysLeft: 2, deliveryNumber: "П-1002" },
    { productName: "Сыр", unit: "кг", quantity: 2.25, expiryDate: "2026-10-13", daysLeft: 3, deliveryNumber: "П-1003" },
    { productName: "Картофель", unit: "кг", quantity: 0.8, expiryDate: "2026-10-14", daysLeft: 4, deliveryNumber: "П-1004" },
  ],
  expired: [
    { productName: "Масло", unit: "л", quantity: 0.3, expiryDate: "2026-10-08", daysOverdue: 1, deliveryNumber: "П-0990" },
  ],
  runningLow: [
    { name: "Курица", unit: "кг", quantity: 2.25, minStock: 3, toOrder: 0.75 },
    { name: "Сыр", unit: "кг", quantity: 0.8, minStock: 1, toOrder: 0.2 },
  ],
  stopList: [
    { id: 1, name: "Цезарь", reason: "не хватает: Курица" },
    { id: 2, name: "Карбонара", reason: "не хватает: Сливки" },
  ],
};

// Заглушки горячих предложений, отсортированные по приоритету
const mockOffers: HotOffer[] = [
  { id: 1, name: "Карбонара", priority: 22.5, coverPortions: 9, reason: "Сливки: срок 1 дн., остаток 1.80 л — хватит на 9 порций", isPromo: false },
  { id: 2, name: "Цезарь", priority: 11.3, coverPortions: 11, reason: "Курица: срок 2 дн., остаток 2.25 кг — хватит на 11 порций", isPromo: false },
  { id: 3, name: "Куриный суп", priority: 7.5, coverPortions: 22, reason: "Курица: срок 2 дн., остаток 2.25 кг — хватит на 22 порций", isPromo: false },
];

// Какие блюда сейчас «Блюдо дня» — живёт в памяти, пока USE_MOCK = true
const mockPromoIds = new Set<number>();

// Данные для дашборда одним запросом
export async function getDashboard(): Promise<DashboardData> {
  if (USE_MOCK) return mockDashboard;
  const res = await api.get<DashboardData>("/dashboard");
  return res.data;
}

// Горячие предложения (сервер возвращает объект { offers: [...] }).
// В заглушке подмешиваем актуальный статус акции из mockPromoIds.
export async function getHotOffers(): Promise<{ offers: HotOffer[] }> {
  if (USE_MOCK) {
    return { offers: mockOffers.map((o) => ({ ...o, isPromo: mockPromoIds.has(o.id) })) };
  }
  const res = await api.get<{ offers: HotOffer[] }>("/hot-offers");
  return res.data;
}

// Включить/выключить «Блюдо дня»: until = "ГГГГ-ММ-ДД" или null (отмена)
export async function setDishPromo(id: number, until: string | null): Promise<void> {
  if (USE_MOCK) {
    if (until) mockPromoIds.add(id);
    else mockPromoIds.delete(id);
    return;
  }
  await api.put(`/dishes/${id}/promo`, { until });
}

// --- Стоп-лист ---

// Заглушка: блюда, которые сейчас нельзя продавать
const mockStopList: StopListItem[] = [
  { id: 3, name: "Цезарь", availablePortions: 0, reason: "Недостаточно курицы" },
  { id: 1, name: "Карбонара", availablePortions: 0, reason: "Недостаточно сливок" },
  { id: 2, name: "Том-ям", availablePortions: 0, reason: "Закончились кокосовое молоко" },
];

// Стоп-лист: GET /api/stop-list отдаёт только недоступные блюда.
// Колонку «с какого времени» бэк не отдаёт — история не хранится, её и не рисуем.
export async function getStopList(): Promise<StopListItem[]> {
  if (USE_MOCK) return [...mockStopList];
  try {
    const res = await api.get<StopListItem[]>("/stop-list");
    return res.data;
  } catch (e: unknown) {
    // Ошибки бэкенда приходят как { "error": "текст" }
    const err = e as { response?: { data?: { error?: string } }; message?: string };
    throw new Error(err.response?.data?.error ?? err.message ?? "Не удалось загрузить стоп-лист");
  }
}