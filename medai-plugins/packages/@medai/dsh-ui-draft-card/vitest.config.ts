import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // 卡片组件测试需要 DOM（T2.5 draftCard.test.tsx）
    environment: 'jsdom',
  },
})
