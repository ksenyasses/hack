using System;

namespace Flagman.Api.Models;

// Роли сотрудников — используются при входе и в проверке прав
public enum Role
{
    Manager,
    Cook,
    Waiter
}

// Типы операций движения товара — чтобы в журнале было видно, откуда изменение
public enum MovementType
{
    Receipt,
    Order,
    WriteOff,
    Return         // возврат товара при отмене заказа
}

// Причины списания
public enum WriteOffReason
{
    Expiry,
    Spoilage,
    Damage,
    Other
}

// Режим подачи заказа: всё одним заходом или каждое блюдо отдельно
public enum ServeMode
{
    AllAtOnce,   // всё сразу
    AsReady      // по мере готовности
}

// Статус заказа
public enum OrderStatus
{
    New,
    Cancelled,
    Served       // блюда приготовили и выдали гостю — заказ уходит в архив
}

// Статус отдельного блюда в заказе — повар отмечает каждое своё
public enum OrderItemStatus
{
    New,
    Ready
}

// Состояние заявки на списание: повар попросил, управляющий решает
public enum WriteOffRequestStatus
{
    Pending,      // ждёт подтверждения
    Approved,     // подтверждена, товар списан
    Rejected      // отклонена
}

// Сотрудник. Пароль храним только зашифрованным
public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string Login { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public Role Role { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Продукт: курица, помидор, масло
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Unit { get; set; } = "";        // кг, л, шт
    public decimal MinStock { get; set; }         // ниже этого остатка — «заканчивается»
    public int ShelfLifeDays { get; set; }        // сколько дней хранится — из этого считаем срок годности партии
    public bool IsArchived { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Партия — конкретная поставка продукта со своим сроком годности
public class ProductBatch
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }         // сколько осталось именно в этой партии
    public DateOnly ExpiryDate { get; set; }      // срок годности: дата поставки + срок хранения продукта
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public int DeliveryId { get; set; }
}

// Поставка — документ «привезли вот это тогда-то»
public class Delivery
{
    public int Id { get; set; }
    public string Number { get; set; } = "";      // номер поставки, например «П-1024»
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? Comment { get; set; }
}

// Блюдо: Цезарь, борщ
public class Dish
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public bool IsManuallyStopped { get; set; }
    public DateOnly? PromoUntil { get; set; }     // до какого дня блюдо в акции («Блюдо дня»); null — не в акции
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Строка рецепта: сколько продукта уходит на одну порцию
public class RecipeItem
{
    public int Id { get; set; }
    public int DishId { get; set; }
    public int ProductId { get; set; }
    public decimal QuantityPerPortion { get; set; }
}

// Заказ — содержит одно или несколько блюд
public class Order
{
    public int Id { get; set; }
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Стол гостей. Строка, а не число: бывает «VIP-2» и «бар 1»
    public string? TableNumber { get; set; }
    public ServeMode ServeMode { get; set; } = ServeMode.AllAtOnce;
    public OrderStatus Status { get; set; } = OrderStatus.New;

    // Кто приготовил и кто выдал — для архива заказов.
    // Заполняются, когда повар отмечает блюдо готовым и когда
    // официант нажимает «Выдан».
    public DateTime? ServedAt { get; set; }
    public int? ServedByUserId { get; set; }
}

// Строка заказа: какое блюдо и сколько порций
public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int DishId { get; set; }
    public int Quantity { get; set; }             // порции
    public OrderItemStatus Status { get; set; } = OrderItemStatus.New;

    // Повар, который отметил это блюдо готовым
    public int? ReadyByUserId { get; set; }
}

// Журнал: каждое изменение количества товара
public class StockMovement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public int? BatchId { get; set; }
    public decimal QuantityDelta { get; set; }    // плюс приход, минус расход
    public MovementType Type { get; set; }
    public WriteOffReason? Reason { get; set; }
    public int? OrderId { get; set; }             // к какому заказу относится
    public int UserId { get; set; }
    public string? Comment { get; set; }          // текст причины при списании, особенно для «Другое»
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Заявка на списание. Повар создаёт, управляющий подтверждает или отклоняет.
// До подтверждения склад не трогаем — это главное отличие от прямого списания.
public class WriteOffRequest
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }
    public WriteOffReason Reason { get; set; }
    public string? Comment { get; set; }                   // обязателен, если Reason = Other
    public WriteOffRequestStatus Status { get; set; } = WriteOffRequestStatus.Pending;
    public int CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? DecidedByUserId { get; set; }
    public DateTime? DecidedAt { get; set; }
}