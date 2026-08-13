# DSH 定制变更日志

每条记录：日期 · 主题 · 对应补丁 · 摘要。补丁按编号升序应用。

| 日期 | 主题 | 补丁 | 摘要 |
|---|---|---|---|
| 2026-08-13 | 修复局域网 IP 打开工作区报错 | `patches/0001-fix-client-insecure-context-randomuuid.patch` | `crypto.randomUUID` 仅在安全上下文（HTTPS/localhost）存在，`http://192.168.x.x:3080` 下打开工作区时 `AbstractApiClient.mintRpcId()` 直接调用导致 `crypto.randomUUID is not a function`。新增 `randomUuid()` 兜底（优先原生 API，回退 `crypto.getRandomValues` 生成 v4 UUID），共修复 3 处浏览器路径：apiproxy `fetch/client.ts`（RPC id）、llm `message.ts`（消息 id）、ui-conversation `service.ts`（附件草稿 id），并补充回归测试。 |
