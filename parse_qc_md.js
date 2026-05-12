#!/usr/bin/env node
/**
 * 质控标准 Markdown → JSON 通用生成器
 * ====================================
 * 
 * 用法:
 *   node parse_qc_md.js --file "项目相关\疾病质控标准\慢性肺源性心脏病质控标准.md"
 *   node parse_qc_md.js -f "path/to/file.md" -c "呼吸内科"
 *   node parse_qc_md.js -f "文件.md" -o "med_ai_assistant_1.0_bs_backend\qc-standards"
 *
 * 参数:
 *   -f, --file      (必填) 质控标准 Markdown 文件路径
 *   -c, --category  (可选) 科室类别，如 "呼吸内科" "神经内科"
 *   -o, --output    (可选) 输出目录，默认: ./med_ai_assistant_1.0_bs_backend/qc-standards
 *   --no-manifest   (可选) 不更新 manifest.json
 *   --dry-run       (可选) 仅解析预览，不生成文件
 *
 * 输入格式要求:
 *   - 文档标题: # {病名}（{简码}）质控标准
 *   - 概述段含: **ICD编码**：...
 *   - 三层小节:
 *       ## 第一层：单病种质控标准（QC_STANDARD）
 *       ## 第二层：临床指南推荐（CLINICAL_GUIDELINE）
 *       ## 第三层：专家共识补充（EXPERT_CONSENSUS）
 *   - 每条指标:
 *       #### {编码}：{名称}
 *       - **指标类型**：PROCESS|STRUCTURE|OUTCOME
 *       - **知识来源**：QC_STANDARD|CLINICAL_GUIDELINE|EXPERT_CONSENSUS
 *       - **适用条件**：...
 *       - **诊疗标准**：...
 *       - **时限要求**：...
 *       - **达标判断**：...
 *       - **未达标建议**：...
 *       - **排除条件**：...
 *       - **所需数据**：...
 *       - **优先级**：HIGH|MEDIUM|LOW
 *       - **参考来源**：...
 */

const fs = require('fs');
const path = require('path');

// ==================== 命令行参数 ====================
const args = {};
process.argv.slice(2).forEach((arg, i, arr) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const next = arr[i + 1];
    if (next && !next.startsWith('-')) {
      args[key] = next;
    } else {
      args[key] = true;
    }
  } else if (arg.startsWith('-') && !arg.startsWith('--')) {
    const key = arg.slice(1);
    const next = arr[i + 1];
    if (next && !next.startsWith('-')) {
      args[key] = next;
    } else {
      args[key] = true;
    }
  }
});

const FILE = args.file || args.f;
const CATEGORY = args.category || args.c;
const BASE = args.output || args.o || path.join(process.cwd(), 'med_ai_assistant_1.0_bs_backend', 'qc-standards');
const NO_MANIFEST = args['no-manifest'] === true;
const DRY_RUN = args['dry-run'] === true;

if (!FILE) {
  console.error('❌ 用法: node parse_qc_md.js --file <质控标准.md> [--category <科室>] [--output <目录>]');
  process.exit(1);
}

// ==================== 解析引擎 ====================

/**
 * 解析文档标题，支持三种格式：
 *   1. # {名称}（{CODE}）质控标准
 *   2. # {名称}（{CODE}）单病种质控标准
 *   3. # {名称}单病种质控标准（需补充提取 CODE）
 */
function parseTitle(line, firstCode) {
  // 优先从括号提取 CODE
  const codeMatch = line.match(/[（(]([A-Z]+)[）)]/);
  let code = codeMatch ? codeMatch[1] : '';
  // 没有括号则从首个指标编码提取（如 CVD-HF-01 → HF）
  if (!code && firstCode) {
    const cm = firstCode.match(/^[A-Z]+-([A-Z]+)-/);
    if (cm) code = cm[1];
  }
  code = code || 'UNKNOWN';

  // 提取病种名称
  let name;
  // 格式1/2: 括号前的内容
  const parenName = line.match(/^#\s*(.+?)\s*[（(]/);
  if (parenName) {
    name = parenName[1].trim();
  } else {
    // 格式3: 去掉 "# " 和 "单病种质控标准"
    name = line.replace(/^#\s*/, '').replace(/单病种质控标准/, '').replace(/质控标准/, '').trim();
  }
  return { code, name: name || '未知病种' };
}

/** 从概述中提取 ICD 编码模式 */
function extractICD(content) {
  const m = content.match(/\*\*ICD编码\*\*[：:]\s*([^\n]+)/);
  if (!m) return '';
  // Extract codes like I27.9, I27.8, I63% and return as comma-separated
  const codes = [];
  const parts = m[1].split(/[;；]/);
  for (const part of parts) {
    const cm = part.match(/([A-Z]\d+\.?\d*)/);
    if (cm) codes.push(cm[1] + '%');
  }
  return codes.join(',');
}

/** 根据小节标题识别知识层级 */
function detectSource(heading) {
  if (/QC_STANDARD|单病种质控/.test(heading)) return 'QC_STANDARD';
  if (/CLINICAL_GUIDELINE|临床指南/.test(heading)) return 'CLINICAL_GUIDELINE';
  if (/EXPERT_CONSENSUS|专家共识/.test(heading)) return 'EXPERT_CONSENSUS';
  return null;
}

/** 将文档按知识层级分割 */
function splitSections(content) {
  const sections = [];
  const lines = content.split('\n');
  let buf = [], head = '';
  for (const line of lines) {
    if (/^##\s+/.test(line) && detectSource(line)) {
      if (buf.length) sections.push({ head, content: buf.join('\n') });
      head = line;
      buf = [line];
    } else if (head) {
      buf.push(line);
    }
  }
  if (buf.length) sections.push({ head, content: buf.join('\n') });
  return sections;
}

/** 从内容中提取指标区块 */
function extractBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  let buf = [];
  for (const line of lines) {
    if (/^####\s+[A-Z]+-[A-Z]+-\d+/.test(line)) {
      if (buf.length) blocks.push(buf.join('\n'));
      buf = [line];
    } else if (buf.length) {
      buf.push(line);
    }
  }
  if (buf.length) blocks.push(buf.join('\n'));
  return blocks;
}

/** 解析单条指标区块 */
function parseBlock(block, source) {
  const lines = block.split('\n');
  // 第1行: #### {编码}：{名称}
  const h = lines[0];
  const hm = h.match(/####\s+([\w-]+)[：:]\s*(.+)/);
  if (!hm) return null;

  const code = hm[1];
  const name = hm[2].trim();

  // 提取字段
  const fields = {};
  let curKey = '', curVal = '';
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fm = line.match(/^- \*\*(.+?)\*\*[：:]\s*(.*)/);
    if (fm) {
      if (curKey) fields[curKey] = curVal.trim();
      curKey = fm[1];
      curVal = fm[2];
    } else if (curKey) {
      curVal += ' ' + line.replace(/^- /, '');
    }
  }
  if (curKey) fields[curKey] = curVal.trim();

  // 构建 assessmentRule
  const rule = [
    fields['诊疗标准'] || '',
    fields['达标判断'] ? '达标判断：' + fields['达标判断'] : '',
    fields['未达标建议'] ? '未达标建议：' + fields['未达标建议'] : '',
    fields['排除条件'] ? '排除条件：' + fields['排除条件'] : '',
  ].filter(Boolean).join('');

  return {
    indicatorCode: code,
    indicatorName: name,
    indicatorType: fields['指标类型'] || 'PROCESS',
    knowledgeSource: fields['知识来源'] || source,
    assessmentRule: rule,
    dataRequirements: fields['所需数据'] || '',
    timeLimit: fields['时限要求'] || '',
    targetValue: (fields['知识来源'] || source) === 'EXPERT_CONSENSUS' ? '达标/不达标' : '应完成',
    priority: fields['优先级'] || 'MEDIUM',
    isActive: true,
    detail: {
      numeratorDesc: fields['达标判断'] || '',
      denominatorDesc: fields['适用条件'] || '',
      exclusionCriteria: fields['排除条件'] || '',
      referenceSource: fields['参考来源'] || '',
    },
  };
}

// ==================== 辅助函数 ====================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJSON(fp, obj) {
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
  console.log('  ✓ ' + path.basename(fp));
}

// ==================== 主流程 ====================

function main() {
  console.log('═══════════════════════════════════════');
  console.log('  质控标准 Markdown → JSON 生成器');
  console.log('═══════════════════════════════════════\n');

  // 1. 读取
  const mdPath = path.resolve(FILE);
  if (!fs.existsSync(mdPath)) {
    console.error('❌ 文件不存在:', mdPath);
    process.exit(1);
  }
  const content = fs.readFileSync(mdPath, 'utf-8');
  console.log('📄 输入:', mdPath);

  // 2. 解析文档头部
  const titleLine = content.split('\n').find(l => /^#\s+/.test(l));
  if (!titleLine) {
    console.error('❌ 无法解析文档标题');
    process.exit(1);
  }

  // 预扫描第一条指标编码（用于解析标题时无括号的格式）
  const firstCode = (content.match(/^####\s+([A-Z]+-[A-Z]+-\d+)/m) || [])[1];
  const { code: diseaseId, name: diseaseName } = parseTitle(titleLine, firstCode);
  const icdPattern = extractICD(content);
  const diseaseCategory = CATEGORY || '呼吸内科';

  console.log(`🏥 病种: ${diseaseName} (${diseaseId})`);
  console.log(`📋 ICD:  ${icdPattern || '未识别'}`);
  console.log(`🏛️  科室: ${diseaseCategory}`);
  if (DRY_RUN) console.log('🔍 模式: dry-run (仅预览)\n');

  // 3. 按知识层级分割并解析指标
  const sections = splitSections(content);
  const all = [];
  for (const sec of sections) {
    const source = detectSource(sec.head);
    if (!source) continue;
    const blocks = extractBlocks(sec.content);
    for (const blk of blocks) {
      const ind = parseBlock(blk, source);
      if (ind) {
        ind.diseaseId = diseaseId;
        all.push(ind);
      }
    }
    console.log(`  📊 [${source}] ${blocks.length} 项`);
  }

  console.log(`\n✅ 共解析 ${all.length} 项指标\n`);

  if (all.length === 0) {
    console.error('❌ 未解析到任何指标，请检查 Markdown 格式');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('─── 预览前 5 条 ───');
    all.slice(0, 5).forEach(ind => {
      console.log(`  ${ind.indicatorCode}  ${ind.indicatorName}  [${ind.knowledgeSource}]  ${ind.priority}`);
    });
    if (all.length > 5) console.log(`  ... 共 ${all.length} 条`);
    console.log('\n✅ Dry-run 完成，未生成文件');
    return;
  }

  // 4. 疾病配置
  const diseaseCfg = {
    diseaseId,
    diseaseName,
    icdCodePattern: icdPattern,
    diseaseCategory,
    description: `${diseaseName}（${diseaseId}）质控标准，含 ${all.length} 项指标（${all.filter(i => i.knowledgeSource === 'QC_STANDARD').length} 项质控标准 + ${all.filter(i => i.knowledgeSource === 'CLINICAL_GUIDELINE').length} 项临床指南 + ${all.filter(i => i.knowledgeSource === 'EXPERT_CONSENSUS').length} 项专家共识）`,
    isActive: true,
  };

  console.log('📁 生成文件:');
  const dDir = path.join(BASE, 'diseases');
  ensureDir(dDir);
  if (!DRY_RUN) writeJSON(path.join(dDir, diseaseId + '.json'), diseaseCfg);

  const iDir = path.join(BASE, 'indicators', diseaseId);
  ensureDir(iDir);
  for (const ind of all) {
    const { diseaseId: _, ...data } = ind;
    if (!DRY_RUN) writeJSON(path.join(iDir, ind.indicatorCode + '.json'), data);
  }

  // 5. Manifest
  if (!NO_MANIFEST && !DRY_RUN) {
    console.log('\n📝 更新 manifest...');
    const mp = path.join(BASE, 'manifest.json');
    let mf = { version: '1.0.0', lastUpdated: new Date().toISOString(), diseases: [], indicators: [] };
    if (fs.existsSync(mp)) mf = JSON.parse(fs.readFileSync(mp, 'utf-8'));

    if (!mf.diseases.find(d => d.diseaseId === diseaseId)) {
      mf.diseases.push({ diseaseId, file: `diseases/${diseaseId}.json` });
    }
    for (const ind of all) {
      if (!mf.indicators.find(i => i.indicatorCode === ind.indicatorCode)) {
        mf.indicators.push({ diseaseId, indicatorCode: ind.indicatorCode, file: `indicators/${diseaseId}/${ind.indicatorCode}.json` });
      }
    }
    const ver = mf.version.split('.').map(Number);
    mf.version = `${ver[0]}.${(ver[1] || 0) + 1}.0`;
    mf.lastUpdated = new Date().toISOString();
    writeJSON(mp, mf);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  ✅ 生成完成！`);
  console.log(`  ${diseaseName} (${diseaseId}): ${all.length} 项指标`);
  console.log(`  输出目录: ${BASE}`);
  console.log(`═══════════════════════════════════════`);
}

main();
