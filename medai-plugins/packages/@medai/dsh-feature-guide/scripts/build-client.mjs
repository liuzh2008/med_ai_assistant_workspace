/**
 * 构建 DSH client bundle（对齐 @medai/dsh-ui-report-card scripts/build-client.mjs）。
 *
 * 产物格式对齐 DSH `client-modules` 期望：
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ...CJS...; return module.exports } })
 * - react / react/jsx-runtime / react-dom 为 external（由 DSH 宿主模块表 require 提供）
 * - bundle 导出 apply/inject/name（client 插件激活契约；禁止 default 导出）
 *
 * 用法：node scripts/build-client.mjs
 */

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, 'package.json'), 'utf8'))
const id = pkg.name

const banner = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(id)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
`

const footer = `
    return module.exports;
  }
});`

const result = await build({
  entryPoints: [resolve(pkgRoot, 'src/client/index.ts')],
  outfile: resolve(pkgRoot, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2020'],
  external: ['react', 'react/jsx-runtime', 'react-dom'],
  banner: { js: banner },
  footer: { js: footer },
  sourcemap: false,
  minify: false,
  logLevel: 'info',
})

console.log('bundle built:', result.outputFiles?.[0]?.path ?? resolve(pkgRoot, 'lib/client.js'))
