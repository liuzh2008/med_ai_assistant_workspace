<!--
  @component AiChat
  @description VitePress 文档站 AI 聊天浮动窗口组件
  功能：浮动气泡按钮 → 聊天窗口 → 非流式 AI 回复（阿里云函数计算代理）
  支持：暗色模式自适应、IP 限流提示、快捷问题、移动端适配
-->
<template>
  <div class="ai-chat-wrapper">
    <!-- 浮动气泡按钮 -->
    <button
      v-if="!isOpen"
      class="chat-bubble"
      aria-label="打开 AI 助手"
      @click="openChat"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>

    <!-- 聊天窗口 -->
    <Transition name="chat-window">
      <div v-if="isOpen" class="chat-window">
        <!-- 顶部标题栏 -->
        <div class="chat-header">
          <div class="chat-header-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
              <path d="M9 18h6" />
            </svg>
            <span>AI 助手</span>
          </div>
          <button class="chat-close-btn" aria-label="关闭聊天窗口" @click="closeChat">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- 消息列表区 -->
        <div ref="messagesRef" class="chat-messages">
          <!-- 欢迎界面 -->
          <div v-if="messages.length === 0" class="welcome-screen">
            <div class="welcome-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                <path d="M9 18h6" />
              </svg>
            </div>
            <p class="welcome-title">你好！我是医疗 AI 助手</p>
            <p class="welcome-desc">你可以问我关于系统使用的任何问题</p>
            <div class="quick-questions">
              <button
                v-for="q in quickQuestions"
                :key="q"
                class="quick-question-btn"
                @click="sendQuickQuestion(q)"
              >
                {{ q }}
              </button>
            </div>
          </div>

          <!-- 消息列表 -->
          <template v-else>
            <div
              v-for="(msg, index) in messages"
              :key="index"
              :class="['message-row', msg.role === 'user' ? 'message-user' : 'message-assistant']"
            >
              <div class="message-bubble">
                <div class="message-content">{{ msg.content }}</div>
              </div>
            </div>
            <!-- AI 正在输入指示器 -->
            <div v-if="isLoading" class="message-row message-assistant">
              <div class="message-bubble loading-bubble">
                <div class="typing-indicator">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          </template>

          <!-- 错误提示 -->
          <div v-if="errorMessage" class="chat-error">
            {{ errorMessage }}
          </div>
        </div>

        <!-- 底部输入区 -->
        <div class="chat-input-area">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="chat-input"
            placeholder="请输入问题，Shift+Enter 换行..."
            rows="1"
            :disabled="isLoading"
            @keydown="handleKeydown"
            @input="autoResize"
          />
          <button
            class="chat-send-btn"
            :disabled="!inputText.trim() || isLoading"
            aria-label="发送消息"
            @click="sendMessage"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'

// ==================== 配置 ====================
// 自动检测：本地开发使用本地 Worker，生产环境使用阿里云函数计算
const ALIYUN_FC_URL = 'https://medai-docs-gzwldrdfvn.cn-chengdu.fcapp.run'

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8787'
  : ALIYUN_FC_URL

// ==================== 类型 ====================
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ==================== 状态 ====================
const isOpen = ref(false)
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const messagesRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// 快捷问题
const quickQuestions = [
  '如何登录系统？',
  '如何查看质控结果？',
  '如何使用 AI 诊断？',
  '如何管理患者信息？'
]

// ==================== 方法 ====================
function openChat() {
  isOpen.value = true
  nextTick(() => {
    inputRef.value?.focus()
    scrollToBottom()
  })
}

function closeChat() {
  isOpen.value = false
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  const newHeight = Math.min(el.scrollHeight, 120)
  el.style.height = newHeight + 'px'
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function sendQuickQuestion(question: string) {
  inputText.value = question
  sendMessage()
}

// 监听消息变化，自动滚动
watch(
  () => messages.value.length,
  () => nextTick(scrollToBottom)
)

// ==================== 发送消息 ====================
async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  // 添加用户消息
  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  isLoading.value = true
  errorMessage.value = ''

  // 重置输入框高度
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
    scrollToBottom()
  })

  // 构建历史记录
  const history = messages.value.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content
  }))

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        message: text,
        history
      })
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后再试')
      }
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || `请求失败: ${response.status}`)
    }

    const data = await response.json()
    const content = data.content || ''
    messages.value.push({ role: 'assistant', content })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '网络错误，请检查连接后重试'
    errorMessage.value = message
  } finally {
    isLoading.value = false
    nextTick(() => {
      scrollToBottom()
      inputRef.value?.focus()
    })
  }
}

// ==================== SSR 兼容 ====================
onMounted(() => {
  // 客户端 mounted 后才能安全访问 DOM
})
</script>

<style scoped>
/* ==================== 浮动气泡 ==================== */
.chat-bubble {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--vp-c-brand-1, #2563eb);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 9999;
}

.chat-bubble:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(37, 99, 235, 0.45);
}

.chat-bubble:active {
  transform: scale(0.95);
}

/* ==================== 聊天窗口 ==================== */
.chat-window {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 380px;
  height: 500px;
  background: var(--vp-c-bg, #ffffff);
  border: 1px solid var(--vp-c-border, #e2e8f0);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  z-index: 9999;
}

/* 窗口展开/收起动画 */
.chat-window-enter-active,
.chat-window-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.chat-window-enter-from,
.chat-window-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

/* ==================== 顶部标题栏 ==================== */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: var(--vp-c-brand-1, #2563eb);
  color: #fff;
  flex-shrink: 0;
}

.chat-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.chat-close-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
}

.chat-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* ==================== 消息列表区 ==================== */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-messages::-webkit-scrollbar {
  width: 5px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--vp-c-border, #e2e8f0);
  border-radius: 3px;
}

/* ==================== 欢迎界面 ==================== */
.welcome-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  gap: 12px;
}

.welcome-icon {
  color: var(--vp-c-brand-1, #2563eb);
  opacity: 0.8;
}

.welcome-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1, #0f172a);
  margin: 0;
}

.welcome-desc {
  font-size: 13px;
  color: var(--vp-c-text-2, #475569);
  margin: 0;
}

.quick-questions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: 8px;
}

.quick-question-btn {
  background: var(--vp-c-bg-soft, #f8fafc);
  border: 1px solid var(--vp-c-border, #e2e8f0);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  color: var(--vp-c-text-1, #0f172a);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.quick-question-btn:hover {
  background: var(--vp-c-brand-soft, rgba(37, 99, 235, 0.14));
  border-color: var(--vp-c-brand-1, #2563eb);
}

/* ==================== 消息气泡 ==================== */
.message-row {
  display: flex;
  width: 100%;
}

.message-user {
  justify-content: flex-end;
}

.message-assistant {
  justify-content: flex-start;
}

.message-bubble {
  max-width: 82%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}

.message-user .message-bubble {
  background: var(--vp-c-brand-1, #2563eb);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-assistant .message-bubble {
  background: var(--vp-c-bg-mute, #f1f5f9);
  color: var(--vp-c-text-1, #0f172a);
  border-bottom-left-radius: 4px;
}

/* ==================== 打字指示器 ==================== */
.loading-bubble {
  padding: 14px 18px;
}

.typing-indicator {
  display: flex;
  gap: 5px;
  align-items: center;
}

.typing-indicator span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vp-c-text-3, #94a3b8);
  animation: typingBounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typingBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ==================== 错误提示 ==================== */
.chat-error {
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.25);
  color: var(--vp-c-danger, #dc2626);
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  text-align: center;
}

/* ==================== 底部输入区 ==================== */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--vp-c-border, #e2e8f0);
  background: var(--vp-c-bg, #ffffff);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  border: 1px solid var(--vp-c-border, #e2e8f0);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  background: var(--vp-c-bg-soft, #f8fafc);
  color: var(--vp-c-text-1, #0f172a);
  font-family: inherit;
  max-height: 120px;
  min-height: 42px;
  transition: border-color 0.15s ease;
}

.chat-input::placeholder {
  color: var(--vp-c-text-3, #94a3b8);
}

.chat-input:focus {
  border-color: var(--vp-c-brand-1, #2563eb);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chat-send-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background: var(--vp-c-brand-1, #2563eb);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.chat-send-btn:hover:not(:disabled) {
  background: var(--vp-c-brand-2, #1d4ed8);
}

.chat-send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ==================== 移动端适配 ==================== */
@media (max-width: 480px) {
  .chat-window {
    right: 0;
    bottom: 0;
    width: 100%;
    height: 70vh;
    border-radius: 16px 16px 0 0;
  }

  .chat-bubble {
    right: 16px;
    bottom: 16px;
  }

  .chat-window-enter-from,
  .chat-window-leave-to {
    transform: translateY(30px);
  }
}
</style>
