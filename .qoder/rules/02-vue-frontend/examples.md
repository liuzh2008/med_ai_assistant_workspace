# Vue 前端编码示例

## 组件结构完整模板

```vue
<!-- ✓ 正确：template → script → style scoped，Options API -->
<template>
  <div class="patient-list">
    <el-table :data="patients" v-loading="loading">
      <el-table-column prop="name" label="姓名" />
    </el-table>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'

/**
 * @type {Object}
 * @description 患者列表组件
 */
export default {
  name: 'PatientList',
  props: {
    /** @type {string} 当前科室ID */
    deptId: {
      type: String,
      default: ''
    },
    /** @type {Array} 预加载的患者数据 */
    initialPatients: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      loading: false
    }
  },
  computed: {
    ...mapState('patient', ['patients'])
  },
  created() {
    this.fetchPatients()
  },
  methods: {
    ...mapActions('patient', ['fetchPatients']),
    handleRefresh() {
      this.fetchPatients()
    }
  }
}
</script>

<style scoped>
.patient-list {
  padding: 16px;
}
</style>

<!-- ✗ 错误：script setup -->
<script setup>
import { ref } from 'vue'   // 禁止 Composition API
const patients = ref([])
</script>
```

## Props 定义正反例

```javascript
// ✓ 正确：type + default，对象/数组用工厂函数
props: {
  /** @type {string} 患者ID */
  patientId: {
    type: String,
    default: ''
  },
  /** @type {Object} 患者基本信息 */
  patientInfo: {
    type: Object,
    default: () => ({})       // 工厂函数
  },
  /** @type {Array} 诊断列表 */
  diagnoses: {
    type: Array,
    default: () => []         // 工厂函数
  }
}

// ✗ 错误
props: {
  patientId: String,          // 无 default
  patientInfo: {
    type: Object,
    default: {}               // 对象引用共享
  },
  diagnoses: {
    type: Array,
    default: []               // 数组引用共享
  }
}
```

## Vuex Store 模块模板

```javascript
// store/modules/patient.js
export default {
  namespaced: true,

  state: {
    patients: [],
    currentPatient: null,
    loading: false,
    error: null
  },

  mutations: {
    SET_PATIENTS(state, patients) {
      state.patients = patients
    },
    SET_CURRENT_PATIENT(state, patient) {
      state.currentPatient = patient
    },
    SET_LOADING(state, loading) {
      state.loading = loading
    },
    SET_ERROR(state, error) {
      state.error = error
    }
  },

  actions: {
    async fetchPatients({ commit }) {
      commit('SET_LOADING', true)
      try {
        const response = await getPatientList()
        commit('SET_PATIENTS', response.data)
      } catch (error) {
        commit('SET_ERROR', error.message)
        // ✓ 不抛异常，用 commit 设置错误状态
      } finally {
        commit('SET_LOADING', false)
      }
    },

    updateCurrentPatient({ commit }, patient) {
      commit('SET_CURRENT_PATIENT', patient)
    },

    resetPatientState({ commit }) {
      commit('SET_PATIENTS', [])
      commit('SET_CURRENT_PATIENT', null)
    }
  }
}
```

## API 模块文件模板

```javascript
// api/qc.js
import service from './request'

/**
 * 获取病种匹配结果
 * @param {string} patientId - 患者ID
 * @returns {Promise<Object>} 匹配结果
 */
export function getDiseaseMatch(patientId) {
  return service.get(`/qc/disease-match/${patientId}`)
}

/**
 * 确诊病种
 * @param {Object} data - 确诊数据
 * @param {string} data.patientId - 患者ID
 * @param {string} data.diseaseCode - 疾病编码
 * @returns {Promise<Object>} 确诊结果
 */
export function confirmDisease(data) {
  return service.post('/qc/confirm', data)
}

/**
 * 更新评估结果
 * @param {string} patientId - 患者ID
 * @param {Object} params - 更新参数
 * @returns {Promise<Object>} 更新结果
 */
export function updateAssessmentResult(patientId, params) {
  return service.put(`/qc/assessment/${patientId}`, params)
}

/**
 * 删除忽略的病种
 * @param {string} patientId - 患者ID
 * @param {string} diseaseCode - 疾病编码
 * @returns {Promise<Object>} 删除结果
 */
export function deleteIgnoredDisease(patientId, diseaseCode) {
  return service.delete(`/qc/ignored/${patientId}/${diseaseCode}`)
}
```

## 错误处理模式

```javascript
// ✓ 正确：Action 中 try-catch 不抛异常
actions: {
  async fetchPatients({ commit }) {
    commit('SET_LOADING', true)
    try {
      const response = await getPatientList()
      commit('SET_PATIENTS', response.data)
    } catch (error) {
      commit('SET_ERROR', error.message)
      // 不 throw，错误已通过 state 传递
    } finally {
      commit('SET_LOADING', false)
    }
  }
}

// ✓ 正确：组件中用 ElMessage 提示
methods: {
  async handleSave() {
    try {
      await this.updatePatient(this.form)
      ElMessage.success('保存成功')
    } catch (error) {
      ElMessage.error('保存失败：' + error.message)
    }
  }
}

// ✗ 错误：Action 中 throw 冒泡
actions: {
  async fetchPatients({ commit }) {
    try {
      const response = await getPatientList()
      commit('SET_PATIENTS', response.data)
    } catch (error) {
      throw error  // 禁止：不要让异常冒泡到组件
    }
  }
}
```

## Axios 编码配置

```javascript
// ✓ 正确：Content-Type 包含 charset=utf-8
const service = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8'
  }
})

// ✗ 错误：未设置 charset
const service = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL,
  timeout: 30000
  // 缺少 headers 配置
})

// ✗ 错误：Content-Type 不完整
headers: {
  'Content-Type': 'application/json'  // 缺少 charset=utf-8
}
```

**注意**：Axios 未设置 `charset=utf-8` 会导致中文参数传输乱码，是项目实际遇到的高频问题。
