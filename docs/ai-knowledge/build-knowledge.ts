/**
 * @description 知识库构建脚本 - 从 source/ 目录提取所有 .md 文件的二级标题章节，生成 knowledge.json
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

// 从 source/ 目录读取所有 .md 文件
const sourceDir = path.resolve(__dirname, 'source');
let sourceFiles: string[] = [];
if (fs.existsSync(sourceDir)) {
  sourceFiles = fs.readdirSync(sourceDir)
    .filter((f: string) => f.endsWith('.md'))
    .sort()
    .map((f: string) => path.join(sourceDir, f));
} else {
  console.warn(`源文档目录不存在，跳过: ${sourceDir}`);
}

interface KnowledgeItem {
  title: string;
  content: string;
}

const knowledge: KnowledgeItem[] = [];

for (const filePath of sourceFiles) {
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
