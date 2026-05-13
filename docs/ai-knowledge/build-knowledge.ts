/**
 * @description 知识库构建脚本 - 从 VitePress 文档提取二级标题章节，生成 knowledge.json
 * @module medai-docs-ai-worker/build-knowledge
 *
 * 用法：npx tsx ai-knowledge/build-knowledge.ts
 * 输出：ai-knowledge/knowledge.json（已加入 .gitignore，需在 CI 中构建）
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceFiles = [
  '../guide/getting-started.md',
  '../guide/patient-management.md',
  '../guide/ai-assistant.md',
  '../faq/index.md',
];

interface KnowledgeItem {
  title: string;
  content: string;
}

const knowledge: KnowledgeItem[] = [];

for (const relPath of sourceFiles) {
  const filePath = path.resolve(__dirname, relPath);
  if (!fs.existsSync(filePath)) {
    console.warn(`文件不存在，跳过: ${filePath}`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n');

  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTitle !== null) {
        knowledge.push({
          title: currentTitle,
          content: currentLines.join('\n').trim(),
        });
      }
      currentTitle = line.slice(3).trim();
      currentLines = [];
    } else if (currentTitle !== null) {
      currentLines.push(line);
    }
  }

  if (currentTitle !== null) {
    knowledge.push({
      title: currentTitle,
      content: currentLines.join('\n').trim(),
    });
  }
}

const outPath = path.resolve(__dirname, 'knowledge.json');
fs.writeFileSync(outPath, JSON.stringify(knowledge, null, 2), 'utf-8');
console.log(`知识库构建完成，共 ${knowledge.length} 条，输出到: ${outPath}`);
