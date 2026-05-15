import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '医疗AI辅助系统',
  description: '智能病历质控与DRG分析平台',
  base: '/med_ai_assistant_workspace/',

  // 本地开发时移除 favicon 引用（无 .ico 文件）

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '功能介绍', link: '/features/ai-diagnosis' },
      { text: '使用指南', link: '/guide/getting-started' },
      { text: '常见问题', link: '/faq/' },
      { text: '意见反馈', link: '/feedback/' }
    ],

    sidebar: {
      '/features/': [
        {
          text: '功能介绍',
          items: [
            { text: 'AI辅助诊断', link: '/features/ai-diagnosis' },
            { text: '病历质控', link: '/features/quality-control' },
            { text: 'DRG分析', link: '/features/drg-analysis' },
            { text: '诊疗计划生成', link: '/features/treatment-plan' },
            { text: '数据采集建议', link: '/features/data-collection' }
          ]
        }
      ],
      '/guide/': [
        {
          text: '使用指南',
          items: [
            { text: '快速入门', link: '/guide/getting-started' },
            { text: '患者管理', link: '/guide/patient-management' },
            { text: 'AI助手使用', link: '/guide/ai-assistant' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    footer: {
      message: '医疗AI辅助系统 - 智能病历质控与DRG分析平台',
      copyright: 'Copyright © 2024-present MedAiAssistant'
    },

  }
})
