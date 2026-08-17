import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // workspace 无 jsdom 依赖；卡片渲染断言用 react-dom/server renderToString（node 环境）
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/client/index.ts', 'src/index.ts'], // slot 注册/装配薄层（GI-C1 集成覆盖）
      thresholds: {
        lines: 85, // 质量门禁 §5.1 #1
        statements: 85,
      },
    },
  },
})
