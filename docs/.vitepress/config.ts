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
      { text: '帮助文档', link: '/help/login' },
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
      ],
      '/help/': [
        {
          text: '帮助文档',
          items: [
            { text: '登录系统', link: '/help/login' },
            { 
              text: '患者管理',
              link: '/help/patient',
              collapsed: false,
              items: [
                { text: '基本信息', link: '/help/basic-info' },
                { text: '病情小结', link: '/help/patient-summary' }
              ]
            },
            { text: 'AI诊断', link: '/help/ai-diagnosis' },
            { text: 'AI辅助', link: '/help/ai-assistant',
              collapsed: false,
              items: [
                { text: '待办事项', link: '/help/todo' }
              ]
            },
            { text: '病历记录', link: '/help/medical-records' },
            { text: '病历质控', link: '/help/qc',
              collapsed: false,
              items: [
                { text: '质控详情', link: '/help/qc-detail' }
              ]
            },
            { text: 'DRG分析', link: '/help/drg' },
            { text: '诊疗计划', link: '/help/treatment' },
            { text: '临床指引', link: '/help/clinical-guidance' },
            { text: '语音识别', link: '/help/voice' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    footer: {
      message: '医疗AI辅助系统 MedAIAssistant (MAA)',
      copyright: 'Copyright © 2024-present MedAiAssistant'
    },

  }
})
