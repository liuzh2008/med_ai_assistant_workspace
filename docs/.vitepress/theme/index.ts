import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import FeedbackForm from './components/FeedbackForm.vue'
import AiChat from './components/AiChat.vue'
import GlassBackground from './components/GlassBackground.vue'
import ImageModal from './components/ImageModal.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-top': () => h(GlassBackground),
      'layout-bottom': () => [h(ImageModal), h(AiChat)]
    })
  },
  enhanceApp({ app }) {
    app.component('FeedbackForm', FeedbackForm)
  }
}
