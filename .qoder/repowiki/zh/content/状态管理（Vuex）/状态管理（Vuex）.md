# 状态管理（Vuex）

<cite>
**本文档引用的文件**   
- [src/store/index.js](file://src\store\index.js)
- [src/store/modules/ai.js](file://src\store\modules\ai.js)
- [src/store/modules/patient.js](file://src\store\modules\patient.js)
- [src/store/modules/user.js](file://src\store\modules\user.js)
- [src/components/ai/AIResponse.vue](file://src\components\ai\AIResponse.vue)
- [src/components/ai/AIResults.vue](file://src\components\ai\AIResults.vue)
- [src/components/ai/PromptList.vue](file://src\components\ai\PromptList.vue)
- [src/components/patient/ExaminationReports.vue](file://src\components\patient\ExaminationReports.vue)
- [src/components/TopMenu.vue](file://src\components\TopMenu.vue)
- [src/components/ai/AISettings.vue](file://src\components\ai\AISettings.vue)
</cite>

## 目录
1. [状态管理（Vuex）](#状态管理vuex)
2. [AI状态管理模块 (ai.js)](#ai状态管理模块-aijs)
3. [患者状态管理模块 (patient.js)](#患者状态管理模块-patientjs)
4. [用户状态管理模块 (user.js)](#用户状态管理模块-userjs)
5. [Vuex Store 入口配置 (index.js)](#vuex-store-入口配置-indexjs)
6. [组件中访问全局状态的实践](#组件中访问全局状态的实践)
7. [状态变更的可预测性与最佳实践](#状态变更的可预测性与最佳实践)

## AI状态管理模块 (ai.js)

`ai.js` 模块负责管理与AI分析任务相关的所有状态，包括当前执行的Prompt、分析结果、诊断信息以及系统设置。

### 状态 (State)
该模块定义了多个关键状态属性：
- **prompts**: 存储从后端获取的已执行和待处理的Prompt列表。
- **currentPrompt**: 记录当前选中的Prompt详情，包括其内容、执行时间和状态。
- **selectedPromptIndex**: 记录当前选中Prompt在列表中的索引，用于UI状态同步。
- **result**: 存储AI分析任务的最终结果内容。
- **aiDiagnosis**: 存储从AI分析结果中解析出的潜在诊断列表。
- **currentDiagnosis**: 存储当前患者已有的诊断列表。
- **response**: 存储与AI模型的实时对话响应。
- **editingTemplate**: 存储当前正在编辑的Prompt模板信息。
- **modelSettings**: 存储AI模型的配置参数，如模型类型和温度。
- **promptTemplates**: 存储从后端加载的Prompt模板树形结构数据。

### 变更 (Mutations)
变更函数是唯一可以修改状态的途径，确保了状态变更的可预测性。
```javascript
mutations: {
  SET_CURRENT_PROMPT(state, prompt) {
    state.currentPrompt = prompt;
  },
  SET_SELECTED_PROMPT_INDEX(state, index) {
    state.selectedPromptIndex = index;
  },
  SET_RESULT(state, result) {
    state.result = result;
  },
  SET_AI_DIAGNOSIS(state, diagnosis) {
    state.aiDiagnosis = diagnosis;
  },
  // ... 其他变更函数
  RESET_STATE(state) {
    // 重置所有状态到初始值
    state.currentPrompt = null;
    state.result = null;
    state.aiDiagnosis = [];
    // ... 重置其他状态
  }
}
```

### 动作 (Actions)
动作用于处理异步操作和业务逻辑。
- **fetchPrompts**: 异步调用 `getPatientPromptDetails` API，获取指定患者的所有Prompt详情，并通过 `SET_PROMPTS` 变更函数更新状态。
- **fetchPromptTemplates**: 异步调用 `getAllPromptTemplates` API，获取所有Prompt模板。它会将平铺的模板数据转换为树形结构（按 `promptType` 分组），然后通过 `SET_PROMPT_TEMPLATES` 变更函数更新状态。

### 计算属性 (Getters)
计算属性提供了对状态的派生访问。
```javascript
getters: {
  prompts: state => state.prompts,
  currentPrompt: state => state.currentPrompt,
  selectedPromptIndex: state => state.selectedPromptIndex,
  result: state => state.result,
  aiDiagnosis: state => state.aiDiagnosis,
  // ... 其他getter
}
```

**模块来源**
- [src/store/modules/ai.js](file://src\store\modules\ai.js#L0-L142)

## 患者状态管理模块 (patient.js)

`patient.js` 模块负责维护患者信息的加载、缓存和相关医疗数据的管理。

### 状态 (State)
该模块的核心状态包括：
- **currentPatient**: 存储当前选中的患者对象，是整个患者视图的数据基础。
- **longTermOrders**: 存储患者的长期医嘱数据。
- **isLongTermOrdersLoading**: 布尔值，表示长期医嘱数据的加载状态。
- **temporaryOrders**: 存储患者的临时医嘱数据。
- **isTemporaryOrdersLoading**: 布尔值，表示临时医嘱数据的加载状态。
- **examinationReports**: 存储患者的检查报告数据。
- **isExaminationReportsLoading**: 布尔值，表示检查报告数据的加载状态。
- **dicInputData**: 存储从后端获取的字典输入数据。
- **diagnoses**: 存储患者的诊断列表。
- **isDiagnosesLoading**: 布尔值，表示诊断数据的加载状态。
- **memoryOrders**: 一个特殊的缓存字段，用于存储用户在AI对话中生成的、尚未保存的医嘱文本。

### 变更 (Mutations)
变更函数不仅更新数据，还管理加载状态。
```javascript
mutations: {
  SET_CURRENT_PATIENT(state, patient) {
    state.currentPatient = patient
    // 当患者变更时，重置AI模块状态和内存医嘱
    this.commit('ai/RESET')
    state.memoryOrders = null
  },
  SET_LONG_TERM_ORDERS(state, orders) {
    state.longTermOrders = orders
  },
  SET_LONG_TERM_ORDERS_LOADING(state, isLoading) {
    state.isLongTermOrdersLoading = isLoading
  },
  // ... 其他变更函数
}
```

### 动作 (Actions)
动作负责与API交互并管理数据流。
- **fetchLongTermOrders / fetchTemporaryOrders / fetchExaminationReports**: 这些动作都遵循相同的模式：首先通过 `SET_XXX_LOADING(true)` 设置加载状态，然后调用相应的API获取数据，将API返回的原始数据格式化为前端组件需要的格式，最后通过 `SET_XXX` 变更函数更新状态，并在 `finally` 块中将加载状态设为 `false`。
- **fetchDiagnoses**: 获取患者的诊断列表。
- **addDiagnosis, deleteDiagnosis, updateDiagnosis**: 处理诊断的增删改操作。这些动作在成功调用API后，会自动调用 `fetchDiagnoses` 来刷新本地状态，确保UI与后端数据保持一致。
- **saveMemoryOrders**: 将新的医嘱文本追加到 `memoryOrders` 缓存中，实现“追加模式”的临时存储。

### 计算属性 (Getters)
除了直接映射状态，还提供了便捷的ID访问。
```javascript
getters: {
  currentPatientId: state => state.currentPatient?.patientId || null,
  longTermOrders: state => state.longTermOrders,
  isLongTermOrdersLoading: state => state.isLongTermOrdersLoading,
  // ... 其他getter
}
```

**模块来源**
- [src/store/modules/patient.js](file://src\store\modules\patient.js#L0-L311)

## 用户状态管理模块 (user.js)

`user.js` 模块是三个模块中最简单的，专注于管理用户界面的配置。

### 状态 (State)
- **showTooltip**: 一个布尔值，控制应用内所有提示框（Tooltip）的显示与隐藏。

### 变更 (Mutations)
- **SET_SHOW_TOOLTIP**: 唯一的变更函数，用于修改 `showTooltip` 状态。

### 动作 (Actions)
- **updateShowTooltip**: 一个封装动作，它接收一个值并提交 `SET_SHOW_TOOLTIP` 变更。

### 计算属性 (Getters)
- **showTooltip**: 提供对 `showTooltip` 状态的访问。

**模块来源**
- [src/store/modules/user.js](file://src\store\modules\user.js#L0-L19)

## Vuex Store 入口配置 (index.js)

`store/index.js` 是Vuex Store的入口文件，负责创建根Store实例并注册所有模块。

### 模块注册
```javascript
import { createStore } from 'vuex'
import patient from './modules/patient'
import ai from './modules/ai'
import user from './modules/user'

export default createStore({
  modules: {
    patient,
    ai,
    user
  },
  // ... actions
})
```
此配置将 `ai.js`、`patient.js` 和 `user.js` 三个模块注册为根Store的命名空间模块。这意味着每个模块的状态、变更、动作和计算属性都位于其各自的命名空间下（例如 `state.ai.currentPrompt`），避免了命名冲突。

### 根级动作 (Root Actions)
该文件定义了一个全局的 `resetState` 动作，用于重置整个应用的状态。
```javascript
actions: {
  resetState({ commit }) {
    commit('patient/RESET_STATE')
    commit('ai/RESET_STATE')
    commit('user/SET_SHOW_TOOLTIP', true)
  }
}
```
这个动作通过命名空间化的提交（commit），依次调用各个模块的重置逻辑，提供了一种统一的“软重启”机制。

**模块来源**
- [src/store/index.js](file://src\store\index.js#L0-L18)

## 组件中访问全局状态的实践

Vue组件通过Vuex提供的辅助函数来访问和修改全局状态，这使得代码更加简洁和可维护。

### 使用 `mapState` 和 `mapGetters`
组件通过 `mapState` 和 `mapGetters` 将全局状态映射到自身的计算属性中。
```javascript
// AIResponse.vue
import { mapState, mapGetters } from 'vuex'

computed: {
  ...mapState('ai', ['response']),
  ...mapGetters('patient', ['currentPatientId'])
}
```
这使得组件可以直接在模板中使用 `this.response` 和 `this.currentPatientId`。

### 使用 `mapMutations`
组件通过 `mapMutations` 将变更函数映射到自身的 `methods` 中。
```javascript
// AIResponse.vue
import { mapMutations } from 'vuex'

methods: {
  ...mapMutations('ai', ['SET_RESPONSE']),
  sendMessage() {
    // ... 处理逻辑
    this.SET_RESPONSE(newResponse); // 直接调用映射的变更函数
  }
}
```

### 使用 `mapActions`
组件通过 `mapActions` 将动作映射到自身的 `methods` 中。
```javascript
// ExaminationReports.vue
import { mapActions } from 'vuex'

methods: {
  ...mapActions('patient', ['fetchExaminationReports']),
  mounted() {
    this.fetchExaminationReports(); // 调用异步动作
  }
}
```

### 直接访问Store实例
在某些情况下，组件会直接访问 `$store` 实例。
```javascript
// TopMenu.vue
handleCommand(command) {
  if (command === '/ai-assistant') {
    // 检查是否有选中的患者
    if (!this.$store.state.patient.currentPatient) {
      this.$message.warning('请先选择一个病人！');
      return;
    }
    this.$router.push(command);
  }
}
```

**组件来源**
- [src/components/ai/AIResponse.vue](file://src\components\ai\AIResponse.vue#L99-L131)
- [src/components/ai/AIResults.vue](file://src\components\ai\AIResults.vue#L107-L113)
- [src/components/ai/PromptList.vue](file://src\components\ai\PromptList.vue#L81-L104)
- [src/components/patient/ExaminationReports.vue](file://src\components\patient\ExaminationReports.vue#L120)
- [src/components/TopMenu.vue](file://src\components\TopMenu.vue#L238-L243)

## 状态变更的可预测性与最佳实践

本项目严格遵循Vuex的核心原则，确保了状态管理的可预测性和可调试性。

### 可预测性
- **单一数据源 (SSOT)**: 所有组件共享同一份全局状态，避免了数据不一致。
- **状态不可变性**: 组件不能直接修改状态。所有变更都必须通过提交（commit）命名空间化的变更函数（mutations）来完成。这使得每一次状态变更都是显式的、可追踪的。
- **动作处理异步**: 所有异步操作（如API调用）都在动作（actions）中进行，动作在完成后提交变更来同步状态。这保证了状态变更仍然是同步的、可预测的。

### 调试便利性
- **Vuex Devtools**: 由于所有状态变更都通过提交变更函数进行，开发者工具可以精确地记录每一次变更，包括变更的类型、载荷（payload）以及变更前后的状态快照，支持时间旅行调试。

### 最佳实践
- **避免直接修改state**: 文档明确指出，应避免直接修改 `state`。例如，在 `AIResponse.vue` 中，代码通过 `this.SET_RESPONSE(newResponse)` 而不是 `this.$store.state.ai.response = newResponse` 来更新状态。
- **模块化与命名空间**: 将状态按功能拆分为 `ai`、`patient`、`user` 模块，并启用 `namespaced: true`，有效组织了代码，防止了大型应用中的命名冲突。
- **状态重置**: 通过 `RESET_STATE` 变更函数和 `resetState` 根级动作，提供了一种清晰的机制来清理和重置应用状态，这对于处理用户登出或切换患者等场景至关重要。