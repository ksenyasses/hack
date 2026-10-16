# Сборка фронтенда и раздача статики через nginx.
#
# Двухстадийная сборка, как у бэкенда: в итоговый образ попадает
# только готовый dist без Node.js и исходников.

# --- сборка ---
FROM node:22-alpine AS build
WORKDIR /app

# Сначала только манифесты: пока они не менялись, слой с зависимостями
# не пересобирается и кэш Docker работает.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Адрес API на хостинге — относительный. nginx на этом же сервере
# раздаёт статику и проксирует /api на бэкенд, поэтому отдельный домен
# не нужен и CORS не требуется.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# --- раздача ---
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80