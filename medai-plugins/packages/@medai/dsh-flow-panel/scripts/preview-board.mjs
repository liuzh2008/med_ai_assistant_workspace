/**
 * 流程看板显示效果预览生成器（开发辅助，非运行时代码）。
 *
 * 用样例数据 renderToString 三路 UI（看板 Tab / 概要角标 / toolview 卡片），
 * 拼上 MEDAI_FLOW_STYLES 输出单文件 preview-board.html，浏览器直接打开即可
 * 预览亮/暗两种主题下的显示效果（无需 DSH、无需后端）。
 *
 * 用法：node scripts/preview-board.mjs （产物：packages/@medai/dsh-flow-panel/preview-board.html）
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// 临时入口：把 TSX 渲染逻辑打包为 CJS
const entry = resolve(pkgRoot, 'src/client/preview.tsx')
const outfile = resolve(pkgRoot, '.preview.cjs')
await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: ['node20'],
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  logLevel: 'error',
})

const mod = await import(`file://${outfile.replaceAll('\\', '/')}`)
const html = mod.renderPreviewHTML()
writeFileSync(resolve(pkgRoot, 'preview-board.html'), html, 'utf8')
console.log('preview written:', resolve(pkgRoot, 'preview-board.html'))
