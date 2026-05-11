---
trigger: always_on
alwaysApply: true
---

# Vue 前端编码规范

## 组件结构

- ✓ 顺序：`<template>` → `<script>` → `<style scoped>`
- ✓ 使用 Options API（`export default { name, data, computed, methods, ... }`）
- ✗ 禁止 `<script setup>` / Composition API

## Props

- ✓ 始终定义 `type` 和 `default`，对象/数组用工厂函数
- ✓ JSDoc 注释 `@type`
- ✗ 禁止无 type 的 props

## Vuex

- ✓ 所有模块 `namespaced: true`
- ✓ Mutation：`UPPER_SNAKE_CASE`（如 `SET_PATIENTS`、`SET_LOADING`）
- ✓ Action：`camelCase`，以 `fetch`/`set`/`reset`/`update` 开头
- ✗ 禁止 Mutation 中写异步逻辑

## 样式

- ✓ 所有组件 `<style scoped>`
- ✓ CSS 类名 kebab-case（如 `.patient-list`）
- ✗ 禁止 BEM 命名
- ✗ 禁止覆盖 Element Plus 组件内部样式

## API

- ✓ 按业务域分文件：`patient.js`、`drg.js`、`qc.js`、`auth.js`
- ✓ 导出具名函数：`getPatientList`、`addPatient`、`updateDiagnosis`、`deleteAlert`
- ✓ 函数名前缀：`get*`/`add*`/`update*`/`delete*`/`fetch*`
- ✗ 禁止默认导出整个 API 对象

## 错误处理

- ✓ Action 中 `try-catch` 不抛异常，用 `commit` 设置错误状态
- ✓ 组件中用 `Element Plus` 的 `ElMessage.error()` 提示用户
- ✗ 禁止 Action 中 `throw` 冒泡到组件

## 路由

- ✓ `name` 用中文（如 `name: '病人列表'`）
- ✓ `path` 用英文 kebab-case（如 `path: '/patient-search'`）
- ✓ 首屏直接 `import`，其余懒加载 `() => import(...)`

## 文件命名

- ✓ 组件：`PascalCase.vue`（如 `PatientList.vue`）
- ✓ 其他：`lowercase.js`（如 `patient.js`、`request.js`）
- ✗ 禁止 camelCase.js 文件名

## 请求编码

- ✓ Axios Content-Type 含 `charset=utf-8`
- ✗ 禁止省略 charset 的请求头
