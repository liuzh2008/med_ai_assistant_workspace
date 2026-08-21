import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // 纯函数 + renderToString 渲染测试，node 环境足够
    environment: 'node',
  },
})
