import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // 하위 경로에 배포해도 동작하도록 상대 경로로 빌드 (design.md A11)
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    environment: 'node',
  },
})
