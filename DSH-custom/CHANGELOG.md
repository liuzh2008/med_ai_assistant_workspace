# DSH 定制变更日志

每条记录：日期 · 主题 · 对应补丁 · 摘要。补丁按编号升序应用。

| 日期 | 主题 | 补丁 | 摘要 |
|---|---|---|---|
| 2026-08-21 | DSH 助手打开慢修复：静态资源 immutable 长缓存 | `patches/0002-fix-static-cache-headers.patch` | 每次刷新/重新打开 DSH GUI 页面都慢（工作站 iframe 嵌 3080，44 个 client bundle 每次全量重传约 10MB）。根因：`client/modules` 的 `/plugins/<id>/client.js?rev=<sha1>` 路由硬编码 `cache-control: no-cache` 且无 ETag/Last-Modified，浏览器无法条件请求只能全量 200 重传——而 URL 自带内容哈希 rev（内容变→rev 变→URL 变），本可 immutable。修复：①`client/modules` serveBundle 改 `public, max-age=31536000, immutable`（bundle+map）；②`frontend-static` 对 `/assets/` 下 Vite hash 产物同样 immutable，index.html 显式 `no-cache`（boot manifest 动态注入需每次验证）。验证：44/44 bundle immutable；Cypress `verify-3080-fix.cy.js` 4/4 全绿；二次访问传输 10MB→0。 |
| 2026-08-13 | 修复局域网 IP 打开工作区报错 | `patches/0001-fix-client-insecure-context-randomuuid.patch` | `crypto.randomUUID` 仅在安全上下文（HTTPS/localhost）存在，`http://192.168.x.x:3080` 下打开工作区时 `AbstractApiClient.mintRpcId()` 直接调用导致 `crypto.randomUUID is not a function`。新增 `randomUuid()` 兜底（优先原生 API，回退 `crypto.getRandomValues` 生成 v4 UUID），共修复 3 处浏览器路径：apiproxy `fetch/client.ts`（RPC id）、llm `message.ts`（消息 id）、ui-conversation `service.ts`（附件草稿 id），并补充回归测试。 |
