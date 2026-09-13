# -*- coding: utf-8 -*-
"""
clinical-rules 规则一致性校验（P0-7 本地可测）
校验项：
  1. manifest.json 可解析、rules 数组每条的 file 真实存在
  2. 每个规则 JSON 可解析，且字段齐备（keywordMatch/ruleName/clinicalExperience/diagnosisCategory/priority/isActive）
  3. keywordMatch 与 ruleName 在 manifest 与规则文件之间一致
  4. 类别合法性：仅允许"操作术语禁区""非诊断性条目禁区"（P0 新增）与既有正向类别
  5. 规则文件无孤儿（rules/ 下未被 manifest 引用）
用法：python -X utf8 AI诊断-规则一致性校验-20260913.py
"""
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = r'D:\MedAiAssistant 1.0 BS\med_ai_assistant_1.0_bs_backend\clinical-rules'
MANIFEST = os.path.join(BASE, 'manifest.json')
RULES_DIR = os.path.join(BASE, 'rules')

KNOWN_CATEGORIES = {'操作术语禁区', '非诊断性条目禁区', '心血管', '内分泌'}
REQUIRED_FIELDS = ['keywordMatch', 'ruleName', 'clinicalExperience', 'diagnosisCategory', 'priority', 'isActive']

fails = []
warns = []


def ok(label):
    print('[PASS] %s' % label)


def fail(label):
    fails.append(label)
    print('[FAIL] %s' % label)


with open(MANIFEST, encoding='utf-8') as f:
    manifest = json.load(f)
ok('manifest 可解析 (version=%s, rules=%d)' % (manifest.get('version'), len(manifest.get('rules', []))))

declared_files = set()
for entry in manifest.get('rules', []):
    rel = entry.get('file', '')
    declared_files.add(rel.replace('/', os.sep))
    path = os.path.join(BASE, rel.replace('/', os.sep))
    if not os.path.exists(path):
        fail('manifest 引用的文件不存在: %s' % rel)
        continue
    with open(path, encoding='utf-8') as f:
        rule = json.load(f)
    missing = [k for k in REQUIRED_FIELDS if k not in rule]
    if missing:
        fail('%s 缺字段 %s' % (rel, missing))
        continue
    if rule['keywordMatch'] != entry.get('keywordMatch'):
        fail('%s keywordMatch 不一致: 文件=%s manifest=%s' % (rel, rule['keywordMatch'], entry.get('keywordMatch')))
    if rule['ruleName'] != entry.get('ruleName'):
        fail('%s ruleName 不一致: 文件=%s manifest=%s' % (rel, rule['ruleName'], entry.get('ruleName')))
    if rule['diagnosisCategory'] not in KNOWN_CATEGORIES:
        fail('%s 类别未知: %s' % (rel, rule['diagnosisCategory']))
    if not str(rule['clinicalExperience']).strip():
        fail('%s clinicalExperience 为空' % rel)
    if rule.get('isActive') is not True:
        fail('%s isActive 不为 true' % rel)
ok('全部 %d 条规则文件字段/一致性校验完成' % len(manifest.get('rules', [])))

# 孤儿文件检查（排除 treatment-rules 目录）
actual = {f for f in os.listdir(RULES_DIR) if f.endswith('.json')}
declared_names = {os.path.basename(p) for p in declared_files if p.startswith('rules' + os.sep)}
orphans = actual - declared_names
if orphans:
    warns.append('未被 manifest 引用的规则文件: %s' % sorted(orphans))
    print('[WARN] %s' % warns[-1])
else:
    ok('无孤儿规则文件（rules/ 下 %d 个全部被 manifest 引用）' % len(actual))

# 禁区规则统计
by_cat = {}
for entry in manifest.get('rules', []):
    path = os.path.join(BASE, entry['file'].replace('/', os.sep))
    if os.path.exists(path):
        with open(path, encoding='utf-8') as f:
            c = json.load(f).get('diagnosisCategory')
        by_cat[c] = by_cat.get(c, 0) + 1
print('\n类别分布: %s' % json.dumps(by_cat, ensure_ascii=False))
print('合计 %d 条，失败 %d 项' % (len(manifest.get('rules', [])), len(fails)))
sys.exit(1 if fails else 0)
