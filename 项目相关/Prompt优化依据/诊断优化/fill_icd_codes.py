# -*- coding: utf-8 -*-
"""
诊断编码词典构建器（第2步：ICD 编码回填）

前提：生产库已用（已加 ICD10Code 末位字段的）extract_03_diagnoses.sql 重新导出
      current_diagnoses.txt —— 每行：患者哈希 | 诊断文本 | IsPrimary | StatusFlag |
      ModificationType | DiagnosisIndex | ICD10Code

流程：
  1. 从 current_diagnoses.txt 建立「医生标准名 → ICD10Code」（同名多码取最高频）
  2. 读取 诊断编码词典_骨架.json，按 standard_name / ai_name 回填 icd10_code
  3. 输出最终词典 诊断编码词典.json + 更新 医生标准名清单.json
  4. 打印回填率统计（覆盖 AI 条数比例 = 词典对 AI 输出的 ICD 合规覆盖能力）

用法：python fill_icd_codes.py
"""
import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime

BASE = os.path.dirname(os.path.abspath(__file__))
SEP = '|#|'

CODE_RE = re.compile(r'^[A-Z]\d+(?:\.\d+)?(?:x\d+)?$', re.I)


def load_doc_codes():
    """医生标准名 -> Counter(ICD10Code)"""
    m = defaultdict(Counter)
    n_with_code = 0
    total = 0
    with open(os.path.join(BASE, 'current_diagnoses.txt'), encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\r\n')
            if not line:
                continue
            parts = line.split(SEP, maxsplit=6)
            if len(parts) < 6:
                continue
            text = parts[1].strip().replace('\\u000A', '\n').replace('\\u0009', '\t')
            code = (parts[6].strip() if len(parts) > 6 else '').upper()
            total += 1
            if code:
                n_with_code += 1
                m[text][code] += 1
    print('目前诊断行 %d，其中带 ICD10Code %d（%.1f%%）' %
          (total, n_with_code, 100.0 * n_with_code / total if total else 0))
    return {name: codes.most_common(1)[0][0] for name, codes in m.items()}, total, n_with_code


def fill():
    doc_codes, total, n_code = load_doc_codes()

    skel_path = os.path.join(BASE, '诊断编码词典_骨架.json')
    if not os.path.exists(skel_path):
        print('[ERR] 缺少 诊断编码词典_骨架.json，先运行 build_dict_skeleton.py')
        return
    with open(skel_path, encoding='utf-8') as f:
        skel = json.load(f)

    filled = 0
    for e in skel['entries']:
        # 仅高置信度桥接（adopted / modified-high）自动回填；低置信度/人工映射留待审核后补
        if e.get('confidence') == 'high':
            code = doc_codes.get(e['standard_name'], '')
            if not code:
                code = doc_codes.get(e['ai_name'], '')
            e['icd10_code'] = code
        if e['icd10_code']:
            filled += 1

    ai_items = skel['stats']['ai_items_total']
    filled_items = 0
    for e in skel['entries']:
        if e['icd10_code']:
            filled_items += e['freq']

    # 输出最终词典
    out = dict(skel)
    out['schema_version'] = '1.1'
    out['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M')
    out['stats'].update({
        'icd_filled_names': filled,
        'icd_filled_items': filled_items,
        'icd_filled_item_ratio': round(100.0 * filled_items / ai_items, 1) if ai_items else 0,
    })
    path = os.path.join(BASE, '诊断编码词典.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # 更新医生标准名清单
    doc_path = os.path.join(BASE, '医生标准名清单.json')
    if os.path.exists(doc_path):
        with open(doc_path, encoding='utf-8') as f:
            doc_list = json.load(f)
        doc_filled = 0
        for e in doc_list['entries']:
            e['icd10_code'] = doc_codes.get(e['standard_name'], '')
            if e['icd10_code']:
                doc_filled += 1
        with open(doc_path, 'w', encoding='utf-8') as f:
            json.dump(doc_list, f, ensure_ascii=False, indent=1)
        print('[OK] 医生标准名清单.json 回填 %d/%d 个编码' % (doc_filled, len(doc_list['entries'])))

    print('[OK] 诊断编码词典.json  (%d 条，回填编码 %d 条，覆盖 AI 条数 %.1f%%)'
          % (len(skel['entries']), filled, out['stats']['icd_filled_item_ratio']))
    print('  未回填编码的条目（%d 条）需人工在审核清单中补 ICD-10 编码' % (len(skel['entries']) - filled))


if __name__ == '__main__':
    fill()
