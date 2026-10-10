# Flagman

Система учёта продуктов, контроля сроков годности и стоп-листа ресторана.
Хакатон, команда из двух человек.

## Что установить

- .NET 10 SDK — https://dotnet.microsoft.com/download
- Node.js (LTS) — https://nodejs.org
- Docker Desktop — https://www.docker.com/products/docker-desktop
- Git — https://git-scm.com

## Запуск

### 1. База данных

    docker compose up -d

Делается один раз, дальше контейнер поднимается сам вместе с Docker.

### 2. Бэкенд

    cd backend/Flagman.Api
    dotnet run

Swagger: http://localhost:5071/swagger

### 3. Фронтенд (во втором терминале)

    cd frontend
    npm install
    npm run dev

Приложение: http://127.0.0.1:5173

## Демо-доступы

| Логин | Роль | Пароль |
|---|---|---|
| manager | Управляющий | 123 |
| cook | Повар | 123 |
| waiter | Официант | 123 |

## Полезное

- Порт базы — **5433**. На 5432 может работать системный PostgreSQL,
  поэтому наш контейнер слушает другой порт.
- Посмотреть таблицы:

      docker exec -it flagman-db psql -U postgres -d flagman -c "\dt"

- Полный сброс базы (данные удалятся):

      docker compose down -v
      docker compose up -d

  после этого перезапустить бэкенд — он сам применит миграции и заведёт
  трёх пользователей.

- Фронт по умолчанию работает на заглушке. Чтобы переключить на настоящий
  сервер, в `frontend/src/config.ts` поставьте `USE_MOCK = false`.

## Структура

    backend/    — ASP.NET Core API
    frontend/   — React + TypeScript
    design/     — макеты экранов
    docs/       — ТЗ