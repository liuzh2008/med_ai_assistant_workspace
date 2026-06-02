/**
 * @description 知识库构建脚本 - 从 source/ 和 help/ 目录提取所有 .md 文件的二级标题章节，生成 knowledge.json
 * @module medai-docs-ai-worker/build-knowledge
 *
 * 扫描目录：
 *   - ai-knowledge/source/   : AI 问答专用知识源文件（纯文本）
 *   - help/                  : VitePress 帮助页面（自动过滤图片语法 ![ 行）
 *
 * 用法：npx tsx ai-knowledge/build-knowledge.ts
 * 输出：ai-knowledge/knowledge.json（已加入 .gitignore，需在 CI 中构建）
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface KnowledgeItem {
  title: string;
  content: string;
}

/**
 * 判断某行是否为 Markdown 图片语法，需要被过滤
 * 匹配: ![alt](url) 或 ![alt] 开头的行
 */
function isImageLine(line: string): boolean {
  return /^!\[.*\]\(.*\)/.test(line.trim()) || /^!\[.*\]/.test(line.trim());
}

/**
 * 从 .md 文件集合中提取知识条目
 * @param files - .md 文件路径数组
 * @param sourceLabel - 来源标签（用于日志）
 * @param filterImages - 是否过滤图片语法行
 */
function extractKnowledge(
  files: string[],
  sourceLabel: string,
  filterImages: boolean,
): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');

    let currentTitle: string | null = null;
    let currentLines: string[] = [];

    for (const line of lines) {
      // 如果开启了图片过滤，跳过图片语法行
      if (filterImages && isImageLine(line)) {
        continue;
      }

      if (line.startsWith('## ')) {
        if (currentTitle !== null) {
          items.push({
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
      items.push({
        title: currentTitle,
        content: currentLines.join('\n').trim(),
      });
    }
  }

  console.log(`  [${sourceLabel}] ${files.length} 个文件 → ${items.length} 条知识`);
  return items;
}

// ===== 收集源文件 =====

// 1. ai-knowledge/source/（纯文本知识源文件）
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

// 2. help/（VitePress 帮助页面，需过滤图片）
const helpDir = path.resolve(__dirname, '..', 'help');
let helpFiles: string[] = [];
if (fs.existsSync(helpDir)) {
  helpFiles = fs.readdirSync(helpDir)
    .filter((f: string) => f.endsWith('.md'))
    .sort()
    .map((f: string) => path.join(helpDir, f));
} else {
  console.warn(`帮助文档目录不存在，跳过: ${helpDir}`);
}

// ===== 提取知识 =====
console.log('开始构建知识库...');

const knowledge: KnowledgeItem[] = [];

// source/ 不过滤图片（这些文件本是纯文本，不含图片）
knowledge.push(...extractKnowledge(sourceFiles, 'source', false));
// help/ 过滤图片语法（帮助页面包含截图）
knowledge.push(...extractKnowledge(helpFiles, 'help', true));

// ===== 输出 =====
const outPath = path.resolve(__dirname, 'knowledge.json');
fs.writeFileSync(outPath, JSON.stringify(knowledge, null, 2), 'utf-8');
console.log(`知识库构建完成，共 ${knowledge.length} 条，输出到: ${outPath}`);
