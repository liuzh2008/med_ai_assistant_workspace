# -*- coding: utf-8 -*-
"""
生成 Gate 1 / Gate 2 模板 prompt 的行级 diff（改前 = git HEAD，改后 = 工作区）

说明：模板 JSON 的 prompt 是单行超长字符串，git diff 不可读；
本脚本先解析 JSON 取出 prompt，再按行做 unified diff，输出人工可审查的对照。
用法：python -X utf8 AI诊断-模板改动diff生成-20260913.py
"""
import difflib
import io
import json
import os
import subprocess
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

REPO = r'D:\MedAiAssistant 1.0 BS\med_ai_assistant_1.0_bs_backend'
OUT = r'D:\MedAiAssistant 1.0 BS\doc\调研\AI诊断-模板改动diff-20260913.md'

FILES = [
    ('prompt-templates/诊断分析/诊断分析.json', 'Gate 1 诊断分析.json（P0-1 ~ P0-4）'),
    ('prompt-templates/诊断分析/诊断审查.json', 'Gate 2 诊断审查.json（P0-5 ~ P0-6）'),
]

sections = ['# Gate 1 / Gate 2 模板改动 diff（prompt 行级，2026-09-13）\n',
            '> 改前 = `git HEAD`；改后 = 工作区。JSON 的 prompt 为单行超长字符串，'
            '此处按行展开后对比，便于人工审查。\n']

for rel, title in FILES:
    old_raw = subprocess.run(['git', '-C', REPO, 'show', 'HEAD:' + rel],
                             capture_output=True, check=True).stdout.decode('utf-8')
    with open(os.path.join(REPO, rel), encoding='utf-8') as f:
        new_raw = f.read()
    old_prompt = json.loads(old_raw)['prompt'].split('\n')
    new_prompt = json.loads(new_raw)['prompt'].split('\n')
    diff = list(difflib.unified_diff(
        old_prompt, new_prompt,
        fromfile=title + ' 改前', tofile=title + ' 改后',
        lineterm='', n=2))
    added = sum(1 for l in diff if l.startswith('+') and not l.startswith('+++'))
    removed = sum(1 for l in diff if l.startswith('-') and not l.startswith('---'))
    sections.append('## %s\n\n- prompt 行数：%d → %d；diff +%d / -%d 行\n\n```diff\n%s\n```\n'
                    % (title, len(old_prompt), len(new_prompt), added, removed, '\n'.join(diff)))
    print('%s: 行数 %d → %d, +%d/-%d' % (title, len(old_prompt), len(new_prompt), added, removed))

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sections))
print('written: %s' % OUT)
