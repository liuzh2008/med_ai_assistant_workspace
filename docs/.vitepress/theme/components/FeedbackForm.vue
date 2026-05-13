<template>
  <div class="feedback-card">
    <div class="feedback-header">
      <h2 class="feedback-title">意见反馈</h2>
      <p class="feedback-desc">我们非常重视您的使用体验和建议。如果您在使用医疗AI辅助系统过程中有任何想法、建议或遇到问题，请在下方提交您的反馈。支持上传截图，帮助我们更好地理解您的需求。</p>
    </div>
    <div class="feedback-form">
      <!-- 意见内容 -->
      <div class="form-group">
        <label class="form-label">意见内容 <span class="required">*</span></label>
        <textarea
          v-model="form.message"
          class="form-textarea"
          placeholder="请描述您的建议或遇到的问题..."
          rows="5"
        ></textarea>
        <div v-if="errors.message" class="form-error">{{ errors.message }}</div>
      </div>

      <!-- 图片上传 -->
      <div class="form-group">
        <label class="form-label">截图上传（可选，最多5张）</label>
        <div
          class="upload-area"
          :class="{ 'upload-dragover': isDragover }"
          @dragover.prevent="isDragover = true"
          @dragleave.prevent="isDragover = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput"
        >
          <div class="upload-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p class="upload-text">点击或拖拽图片到此区域</p>
          <p class="upload-hint">支持 JPG、PNG、GIF 格式，单张不超过 5MB</p>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          style="display: none"
          @change="handleFileSelect"
        />
        <div v-if="form.images.length" class="image-preview-list">
          <div v-for="(img, index) in form.images" :key="index" class="image-preview-item">
            <img :src="img.preview" :alt="'截图 ' + (index + 1)" />
            <button class="image-remove" @click="removeImage(index)" title="删除">×</button>
          </div>
        </div>
      </div>

      <!-- 联系方式 -->
      <div class="form-group">
        <label class="form-label">联系方式（可选）</label>
        <input
          v-model="form.contact"
          type="text"
          class="form-input"
          placeholder="邮箱或手机号，方便我们回复您"
        />
      </div>

      <!-- 提交者名称 -->
      <div class="form-group">
        <label class="form-label">您的称呼（可选）</label>
        <input
          v-model="form.name"
          type="text"
          class="form-input"
          placeholder="您的称呼"
        />
      </div>

      <!-- 上传进度提示 -->
      <transition name="fade">
        <div v-if="uploadProgress" class="form-message info">
          {{ uploadProgress }}
        </div>
      </transition>

      <!-- 提交按钮 -->
      <div class="form-actions">
        <button
          class="submit-btn"
          :disabled="isSubmitting || cooldownRemaining > 0 || rateLimited"
          @click="handleSubmit"
        >
          <span v-if="isSubmitting" class="btn-loading">
            <span class="spinner"></span>
            提交中...
          </span>
          <span v-else-if="cooldownRemaining > 0">
            请等待 {{ cooldownRemaining }}s
          </span>
          <span v-else-if="rateLimited">
            提交过于频繁，请稍后再试
          </span>
          <span v-else>提交反馈</span>
        </button>
      </div>

      <!-- 提示信息 -->
      <transition name="fade">
        <div v-if="submitSuccess" class="form-message success">
          感谢您的反馈！我们会认真阅读每一条意见。
        </div>
      </transition>
      <transition name="fade">
        <div v-if="submitError" class="form-message error">
          {{ submitError }}
        </div>
      </transition>
      <transition name="fade">
        <div v-if="rateLimitMessage" class="form-message warn">
          {{ rateLimitMessage }}
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'

// GitHub 配置（通过环境变量注入，配置在 docs/.env.local 中）
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN || ''
const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || 'liuzh2008'
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || 'medai-feedback'

// 防刷常量
const COOLDOWN_SECONDS = 60
const RATE_LIMIT_MS = 5 * 60 * 1000 // 5分钟
const RATE_LIMIT_KEY = 'feedback_last_submit'
const MAX_IMAGES = 5
const MAX_IMAGE_SIZE_KB = 500

// 表单数据
const form = reactive({
  message: '',
  contact: '',
  name: '',
  images: [] // { file, preview, compressed, ext }
})

const errors = reactive({
  message: ''
})

// 状态
const isSubmitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref('')
const rateLimited = ref(false)
const rateLimitMessage = ref('')
const isDragover = ref(false)
const cooldownRemaining = ref(0)
const fileInput = ref(null)
const uploadProgress = ref('')

let cooldownTimer = null

// 检查频率限制
function checkRateLimit() {
  const lastSubmit = localStorage.getItem(RATE_LIMIT_KEY)
  if (lastSubmit) {
    const elapsed = Date.now() - parseInt(lastSubmit, 10)
    if (elapsed < RATE_LIMIT_MS) {
      const remainMin = Math.ceil((RATE_LIMIT_MS - elapsed) / 60000)
      rateLimited.value = true
      rateLimitMessage.value = `您已提交过反馈，请 ${remainMin} 分钟后再试`
      return false
    }
  }
  rateLimited.value = false
  rateLimitMessage.value = ''
  return true
}

// 启动冷却倒计时
function startCooldown() {
  cooldownRemaining.value = COOLDOWN_SECONDS
  cooldownTimer = setInterval(() => {
    cooldownRemaining.value--
    if (cooldownRemaining.value <= 0) {
      cooldownRemaining.value = 0
      clearInterval(cooldownTimer)
      cooldownTimer = null
      // 冷却结束后再检查频率限制
      checkRateLimit()
    }
  }, 1000)
}

// 图片压缩（Canvas 降质）
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        let width = img.width
        let height = img.height

        // 限制最大分辨率
        const maxDim = 1600
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // 逐步降低质量直到满足大小要求
        let quality = 0.8
        let dataUrl = canvas.toDataURL('image/jpeg', quality)

        while (dataUrl.length > MAX_IMAGE_SIZE_KB * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        // 如果仍然过大，缩小尺寸再压缩
        if (dataUrl.length > MAX_IMAGE_SIZE_KB * 1024 * 1.37) {
          const scale = 0.5
          canvas.width = Math.round(width * scale)
          canvas.height = Math.round(height * scale)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          quality = 0.7
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }

        resolve(dataUrl)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// 处理文件选择
async function handleFileSelect(event) {
  const files = Array.from(event.target.files || [])
  await addImages(files)
  // 重置 input 以便再次选择相同文件
  event.target.value = ''
}

// 处理拖拽
async function handleDrop(event) {
  isDragover.value = false
  const files = Array.from(event.dataTransfer.files || []).filter(
    (f) => f.type.startsWith('image/')
  )
  await addImages(files)
}

// 获取文件扩展名
function getExtension(file) {
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  }
  return mimeMap[file.type] || 'jpg'
}

// 添加图片
async function addImages(files) {
  const remaining = MAX_IMAGES - form.images.length
  const toAdd = files.slice(0, remaining)

  for (const file of toAdd) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 5 * 1024 * 1024) continue // 5MB限制

    const preview = URL.createObjectURL(file)
    const compressed = await compressImage(file)
    const ext = getExtension(file)
    form.images.push({ file, preview, compressed, ext })
  }
}

// 删除图片
function removeImage(index) {
  const removed = form.images.splice(index, 1)[0]
  if (removed && removed.preview) {
    URL.revokeObjectURL(removed.preview)
  }
}

// 触发文件选择
function triggerFileInput() {
  if (form.images.length >= MAX_IMAGES) return
  fileInput.value?.click()
}

// 格式化时间
function formatTime() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

// 生成时间戳文件名
function generateImageFilename(ext) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 6)
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-${random}.${ext}`
}

// 上传单张图片到 GitHub
async function uploadImageToGithub(imageData, filename) {
  // 从 dataURL 提取 base64 内容
  const base64Content = imageData.split(',')[1]

  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/feedback-images/${filename}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `feedback image: ${filename}`,
        content: base64Content
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 401) {
      throw new Error('GitHub Token 无效，请联系管理员')
    }
    if (response.status === 422) {
      throw new Error('文件已存在或仓库路径错误')
    }
    throw new Error(errorData.message || `图片上传失败 (${response.status})`)
  }

  const data = await response.json()
  return data.content.download_url
}

// 创建 GitHub Issue
async function createGithubIssue(title, body) {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        body,
        labels: ['user-feedback']
      })
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    if (response.status === 401) {
      throw new Error('GitHub Token 无效，请联系管理员')
    }
    if (response.status === 422) {
      throw new Error('仓库不存在或标签未创建')
    }
    throw new Error(errorData.message || `创建 Issue 失败 (${response.status})`)
  }

  return await response.json()
}

// 表单验证
function validate() {
  let valid = true
  errors.message = ''

  if (!form.message.trim()) {
    errors.message = '请输入意见内容'
    valid = false
  }

  return valid
}

// 提交
async function handleSubmit() {
  submitSuccess.value = false
  submitError.value = ''

  if (!validate()) return
  if (!checkRateLimit()) return
  if (isSubmitting.value || cooldownRemaining.value > 0) return

  isSubmitting.value = true

  try {
    // 第一步：上传图片到 GitHub
    const imageUrls = []
    const failedImages = []

    if (form.images.length > 0) {
      for (let i = 0; i < form.images.length; i++) {
        const img = form.images[i]
        uploadProgress.value = `正在上传图片 ${i + 1}/${form.images.length}...`

        try {
          const filename = generateImageFilename(img.ext)
          const url = await uploadImageToGithub(img.compressed, filename)
          imageUrls.push({ filename, url })
        } catch (imgErr) {
          console.error(`图片上传失败: ${imgErr.message}`)
          failedImages.push({ filename: `image-${i + 1}.${img.ext}`, error: imgErr.message })
        }
      }
      uploadProgress.value = ''
    }

    // 第二步：构建 Issue 内容
    const messagePreview = form.message.trim().substring(0, 30)
    const title = `意见反馈: ${messagePreview}${form.message.trim().length > 30 ? '...' : ''}`

    let body = `## 意见内容\n\n${form.message.trim()}\n`

    if (imageUrls.length > 0 || failedImages.length > 0) {
      body += `\n## 附件图片\n\n`
      for (const item of imageUrls) {
        body += `![${item.filename}](${item.url})\n`
      }
      if (failedImages.length > 0) {
        body += `\n> ⚠️ 以下图片上传失败：\n`
        for (const fail of failedImages) {
          body += `> - ${fail.filename}: ${fail.error}\n`
        }
      }
    }

    body += `\n## 提交信息\n\n`
    body += `- 提交者: ${form.name.trim() || '匿名'}\n`
    body += `- 联系方式: ${form.contact.trim() || '未提供'}\n`
    body += `- 提交时间: ${formatTime()}\n`
    body += `- 来源页面: ${window.location.href}\n`

    uploadProgress.value = '正在创建反馈工单...'

    // 第三步：创建 GitHub Issue
    await createGithubIssue(title, body)

    uploadProgress.value = ''
    submitSuccess.value = true

    // 记录提交时间
    localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()))

    // 重置表单
    form.message = ''
    form.contact = ''
    form.name = ''
    form.images.forEach((img) => {
      if (img.preview) URL.revokeObjectURL(img.preview)
    })
    form.images.length = 0

    // 启动冷却
    startCooldown()

    // 5秒后隐藏成功提示
    setTimeout(() => {
      submitSuccess.value = false
    }, 5000)
  } catch (err) {
    console.error('Feedback submission failed:', err)
    uploadProgress.value = ''
    submitError.value = err.message || '提交失败，请稍后重试'
    setTimeout(() => {
      submitError.value = ''
    }, 8000)
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => {
  checkRateLimit()
})

onUnmounted(() => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
  }
  form.images.forEach((img) => {
    if (img.preview) URL.revokeObjectURL(img.preview)
  })
})
</script>

<style scoped>
.feedback-card {
  max-width: 680px;
  margin: 2rem auto;
  background: var(--vp-c-bg-soft, #f9fafb);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  padding: 2rem;
  border: 1px solid var(--vp-c-divider, #e2e8f0);
}

.feedback-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--vp-c-divider, #e2e8f0);
}

.feedback-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0 0 0.5rem 0;
}

.feedback-desc {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.6;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--vp-c-text-1, #1f2937);
  margin-bottom: 0.4rem;
}

.required {
  color: #ef4444;
}

.form-textarea,
.form-input {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--vp-c-divider, #d1d5db);
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--vp-c-text-1, #1f2937);
  background: var(--vp-c-bg, #ffffff);
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}

.form-textarea:focus,
.form-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
}

.form-error {
  color: #ef4444;
  font-size: 0.8rem;
  margin-top: 0.3rem;
}

/* 上传区域 */
.upload-area {
  border: 2px dashed var(--vp-c-divider, #d1d5db);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  background: var(--vp-c-bg, #ffffff);
}

.upload-area:hover,
.upload-dragover {
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.04);
}

.upload-icon {
  color: var(--vp-c-text-3, #9ca3af);
  margin-bottom: 0.4rem;
}

.upload-text {
  font-size: 0.9rem;
  color: var(--vp-c-text-2, #6b7280);
  margin: 0.3rem 0;
}

.upload-hint {
  font-size: 0.78rem;
  color: var(--vp-c-text-3, #9ca3af);
  margin: 0;
}

/* 图片预览 */
.image-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.image-preview-item {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider, #e2e8f0);
}

.image-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.2s;
}

.image-remove:hover {
  background: rgba(239, 68, 68, 0.9);
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  padding: 0.7rem 1.5rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 提示消息 */
.form-message {
  margin-top: 0.75rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  font-size: 0.88rem;
  text-align: center;
}

.form-message.success {
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid #a7f3d0;
}

.form-message.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.form-message.warn {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}

.form-message.info {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

/* 暗色主题适配 */
:root.dark .form-message.success {
  background: rgba(6, 95, 70, 0.15);
  border-color: rgba(6, 95, 70, 0.3);
}

:root.dark .form-message.error {
  background: rgba(153, 27, 27, 0.15);
  border-color: rgba(153, 27, 27, 0.3);
}

:root.dark .form-message.warn {
  background: rgba(146, 64, 14, 0.15);
  border-color: rgba(146, 64, 14, 0.3);
}

:root.dark .form-message.info {
  background: rgba(30, 64, 175, 0.15);
  border-color: rgba(30, 64, 175, 0.3);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 移动端适配 */
@media (max-width: 640px) {
  .feedback-card {
    margin: 1rem 0;
    padding: 1.25rem;
    border-radius: 8px;
  }

  .upload-area {
    padding: 1rem;
  }

  .image-preview-item {
    width: 64px;
    height: 64px;
  }
}
</style>
