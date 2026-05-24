<template>
  <!--
    首页卡片图片弹窗组件 ImageModal
    - 单图模式：cardImageMap 中值为字符串，显示单张截图
    - 轮播模式：cardImageMap 中值为数组，5秒自动轮播，底部指示器可手动跳转
    - 关闭方式：点击遮罩 / Escape键 / ✕按钮
    - 通过 cardImageMap 映射卡片标题到图片路径，新增卡片只需加一行
    - 暗色主题自动适配遮罩和容器样式
  -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="image-modal-overlay" @click.self="close">
        <div class="image-modal-container">
          <button class="image-modal-close" @click="close" title="关闭">✕</button>
          <!-- 轮播指示器 -->
          <div v-if="isCarousel" class="carousel-indicators">
            <span
              v-for="(img, idx) in images"
              :key="idx"
              class="carousel-dot"
              :class="{ active: idx === currentIndex }"
              @click.stop="switchTo(idx)"
            ></span>
          </div>
          <!-- 图片 -->
          <Transition name="img-swap" mode="out-in">
            <img
              :key="currentSrc"
              :src="currentSrc"
              :alt="imageAlt"
              class="image-modal-img"
            />
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useData } from 'vitepress'

export default {
  name: 'ImageModal',
  setup() {
    const visible = ref(false)
    const images = ref([])       // 图片数组（字符串或数组统一为数组）
    const currentIndex = ref(0)
    const imageAlt = ref('')
    let carouselTimer = null
    const { site } = useData()

    const isCarousel = computed(() => images.value.length > 1)
    const currentSrc = computed(() => images.value[currentIndex.value] || '')

    function showImage(src, alt) {
      const srcList = Array.isArray(src) ? src : [src]
      images.value = srcList
      currentIndex.value = 0
      imageAlt.value = alt || ''
      visible.value = true
      startCarousel()
    }

    function close() {
      visible.value = false
      stopCarousel()
    }

    function startCarousel() {
      stopCarousel()
      if (images.value.length <= 1) return
      carouselTimer = setInterval(() => {
        currentIndex.value = (currentIndex.value + 1) % images.value.length
      }, 5000)
    }

    function stopCarousel() {
      if (carouselTimer) {
        clearInterval(carouselTimer)
        carouselTimer = null
      }
    }

    function switchTo(idx) {
      currentIndex.value = idx
      // 重置计时器
      startCarousel()
    }

    function onKeydown(e) {
      if (e.key === 'Escape' && visible.value) {
        close()
      }
    }

    // 卡片标题 → 图片路径映射（字符串=单图，数组=轮播）
    const cardImageMap = {
      'AI辅助诊断': 'screenshots/AI诊断.png',
      '质控驱动的临床实践': 'screenshots/质量控制驱动的临床实践.png',
      '一键生成病历': 'screenshots/一键生成病历.png',
      'DRG智能分析': 'screenshots/DRG.png',
      '临床指引': 'screenshots/临床指引.png',
      '数据采集建议': 'screenshots/数据采集建议.png',
      '床旁完成病历记录': [
        'screenshots/语音转文字并整理1.png',
        'screenshots/语音转文字并整理2.png'
      ]
    }

    function handleFeatureCardClick(e) {
      const card = e.target.closest('.VPFeature')
      if (!card) return
      const titleEl = card.querySelector('.title')
      if (!titleEl) return
      const title = titleEl.textContent.trim()
      const imagePath = cardImageMap[title]
      if (!imagePath) return
      e.preventDefault()
      e.stopPropagation()
      const base = site.value.base || '/'
      const src = Array.isArray(imagePath)
        ? imagePath.map(p => `${base}${p}`)
        : `${base}${imagePath}`
      showImage(src, `${title}界面截图`)
    }

    onMounted(() => {
      document.addEventListener('keydown', onKeydown)
      document.addEventListener('click', handleFeatureCardClick, true)
    })

    onUnmounted(() => {
      document.removeEventListener('keydown', onKeydown)
      document.removeEventListener('click', handleFeatureCardClick, true)
      stopCarousel()
    })

    return { visible, images, currentIndex, imageAlt, currentSrc, isCarousel, close, switchTo }
  }
}
</script>

<style scoped>
/* 遮罩层 */
.image-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
}

/* 弹窗容器 - 液态玻璃 */
.image-modal-container {
  position: relative;
  max-width: 92vw;
  max-height: 90vh;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(24px) saturate(200%);
  -webkit-backdrop-filter: blur(24px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 20px;
  box-shadow:
    0 24px 80px rgba(0, 30, 80, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.2) inset;
  overflow: hidden;
  padding: 8px;
}

/* 图片 */
.image-modal-img {
  display: block;
  max-width: calc(92vw - 16px);
  max-height: calc(90vh - 16px);
  width: auto;
  height: auto;
  border-radius: 14px;
}

/* 关闭按钮 */
.image-modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: all 0.25s ease;
  line-height: 1;
}

.image-modal-close:hover {
  background: rgba(0, 0, 0, 0.55);
  transform: scale(1.1);
}

/* 暗色主题 */
.dark .image-modal-overlay {
  background: rgba(0, 0, 0, 0.7);
}

.dark .image-modal-container {
  background: rgba(20, 25, 45, 0.75);
  border-color: rgba(80, 110, 180, 0.3);
}

/* 过渡动画 */
.modal-fade-enter-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-active .image-modal-container {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}

.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}
.modal-fade-leave-active .image-modal-container {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-fade-enter-from {
  opacity: 0;
}
.modal-fade-enter-from .image-modal-container {
  transform: scale(0.92);
  opacity: 0;
}

.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-leave-to .image-modal-container {
  transform: scale(0.95);
  opacity: 0;
}

/* ========== 轮播指示器 ========== */
.carousel-indicators {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
}

.carousel-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(4px);
}

.carousel-dot.active {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 1);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.5);
  transform: scale(1.3);
}

.carousel-dot:hover {
  background: rgba(255, 255, 255, 0.7);
  transform: scale(1.2);
}

.carousel-dot.active:hover {
  transform: scale(1.3);
}

.dark .carousel-dot {
  background: rgba(150, 180, 220, 0.35);
  border-color: rgba(150, 180, 220, 0.5);
}

.dark .carousel-dot.active {
  background: rgba(200, 220, 255, 0.85);
  border-color: rgba(200, 220, 255, 1);
  box-shadow: 0 0 8px rgba(150, 180, 255, 0.5);
}

/* ========== 图片切换动画 ========== */
.img-swap-enter-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.img-swap-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.img-swap-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.img-swap-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
