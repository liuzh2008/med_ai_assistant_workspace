import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import FeedbackForm from './components/FeedbackForm.vue'
import AiChat from './components/AiChat.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => h(AiChat)
    })
  },
  enhanceApp({ app }) {
    app.component('FeedbackForm', FeedbackForm)
  }
}
