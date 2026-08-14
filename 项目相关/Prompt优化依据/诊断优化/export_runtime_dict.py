# -*- coding: utf-8 -*-
"""
运行时诊断词典导出器（诊断编码词典注入功能配套工具）

用途：将构建产物《诊断编码词典.json》（2577 条 AI 诊断名 → 国临版标准名 + ICD 编码）
转换为随后端包发布的运行时精简格式：

    src/main/resources/diagnosis_dict/diagnosis_dict.json

与《诊断编码词典注入TDD实施指南.md》中的字段定义一致：
  - name        源诊断名（AI 常用名）
  - standard    国临版标准名
  - code        ICD-10 编码（为空表示未映射）
  - confidence  high / medium / low
  - note        备注（人工校正表说明；非标准条目缺省补充提示语）
  - nonStandard 是否已知非标准表述（未映射的 785 条 = true）

用法：
  python export_runtime_dict.py [源词典路径] [输出路径]

默认：
  源：  本目录 诊断编码词典.json
  输出：../../../med_ai_assistant_1.0_bs_backend/src/main/resources/diagnosis_dict/diagnosis_dict.json

注意：
  - 归一化/同义词清单见 build_icd_dict.py（Java 端 DiagnosisDictNormalizer 与之一致）
  - 词典更新链路：build_icd_dict.py 重建 → 本脚本转换 → 后端重新构建部署
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SRC = os.path.join(BASE, '诊断编码词典.json')
DEFAULT_OUT = os.path.normpath(os.path.join(
    BASE, '..', '..', '..', 'med_ai_assistant_1.0_bs_backend',
    'src', 'main', 'resources', 'diagnosis_dict', 'diagnosis_dict.json'))

# 非标准条目缺省备注（与注入段格式对齐：⚠非标准诊断表述（备注））
NON_STANDARD_NOTE = '请勿作为诊断名输出'


def convert(src_path, out_path):
    with open(src_path, encoding='utf-8') as f:
        source = json.load(f)

    entries = []
    for e in source.get('entries', []):
        name = (e.get('ai_name') or '').strip()
        if not name:
            continue
        code = e.get('icd10_code') or ''
        standard = e.get('icd_name') or ''
        confidence = e.get('confidence') or 'low'
        note = e.get('note') or ''
        non_standard = not code
        if non_standard and not note:
            note = NON_STANDARD_NOTE
        entries.append({
            'name': name,
            'standard': standard,
            'code': code,
            'confidence': confidence,
            'note': note,
            'nonStandard': non_standard,
        })

    out = {
        'schema_version': source.get('schema_version', '3.0'),
        'source': 'ICD-10国临版2.0 筛查 2026-08-14',
        'count': len(entries),
        'entries': entries,
    }
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    mapped = sum(1 for e in entries if e['code'])
    print('[OK] %s' % out_path)
    print('  条目总数: %d（已映射 %d / 非标准 %d）' % (len(entries), mapped, len(entries) - mapped))


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) >= 2 else DEFAULT_SRC
    out = sys.argv[2] if len(sys.argv) >= 3 else DEFAULT_OUT
    convert(src, out)
