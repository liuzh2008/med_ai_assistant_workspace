/**
 * @description 知识库与系统提示词模块 - 提供 AI 聊天所需的 Prompt 和上下文
 * @module medai-docs-ai-worker/knowledge
 */
import knowledgeData from './knowledge-data.json';

/**
 * @description 获取系统提示词，定义 AI 助手角色与行为约束
 * @returns {string} 系统提示词文本
 */
export function getSystemPrompt(): string {
  return `你是「医疗AI辅助系统」的使用顾问。

规则：
- 只回答软件操作相关问题（如何登录、查看患者、发起质控等）
- 如果问题与软件使用无关，礼貌拒绝并引导用户提出软件操作问题
- 禁止回答临床医学问题、给出诊疗建议
- 回答语言：中文，简洁清晰
- 基于以下知识库回答，不编造信息
- 如果知识库中没有相关信息，明确告知用户，不要编造内容
- 涉及医疗数据时，提醒用户注意数据安全和隐私保护`;
}

/**
 * @description 将知识库 JSON 数据拼接为纯文本上下文，供 AI 模型参考
 * @returns {string} 拼接后的知识库文本，无数据时返回空字符串
 */
export function getKnowledgeContext(): string {
  if (!Array.isArray(knowledgeData) || knowledgeData.length === 0) {
    return '';
  }

  return knowledgeData
    .map((item: any) => {
      if (typeof item === 'string') return item;
      if (item && typeof item.content === 'string') return item.content;
      return JSON.stringify(item);
    })
    .join('\n\n');
}
