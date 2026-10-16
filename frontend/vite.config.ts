import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages отдаёт проект по подпути /hack/, а не с корня домена.
  // Без этого собранные ссылки на ассеты будут вести в никуда.
  // Пустое значение — обычная сборка с корня, как на любом хостинге.
  base: process.env.VITE_BASE || '/',
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Прокси нужен, чтобы локально проверять ровно ту сборку,
    // что уедет на Vercel: там фронт обращается к /api на своём же
    // домене. Здесь это превращается в запрос к локальному бэкенду.
    proxy: {
      '/api': 'http://localhost:5071'
    }
  },
})