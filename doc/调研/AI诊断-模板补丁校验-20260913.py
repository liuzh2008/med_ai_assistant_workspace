# -*- coding: utf-8 -*-
"""
Gate 1 / Gate 2 模板补丁内容校验（P0-1 ~ P0-6）
可复跑：python -X utf8 AI诊断-模板补丁校验-20260913.py
"""
import io
import json
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE = r'D:\MedAiAssistant 1.0 BS\med_ai_assistant_1.0_bs_backend\prompt-templates\诊断分析'
F_G1 = os.path.join(BASE, '诊断分析.json')
F_G2 = os.path.join(BASE, '诊断审查.json')

with open(F_G1, encoding='utf-8') as f:
    g1 = json.load(f)['prompt']
with open(F_G2, encoding='utf-8') as f:
    g2 = json.load(f)['prompt']

results = []


def check(label, cond, detail=''):
    results.append((label, bool(cond), detail))


# ---------- P0-1 ----------
check('P0-1 新增段落存在', '【诊断资格与禁止清单】' in g1)
check('P0-1 位于全覆盖规则之后', g1.find('不得自行移除医生已录入的任何诊断。') < g1.find('【诊断资格与禁止清单】'))
check('P0-1 位于分析要求之前', g1.find('【诊断资格与禁止清单】') < g1.find('\n分析要求：'))
check('P0-1 四类禁止齐备',
      all(k in g1 for k in ['1.正常或阴性检查结果', '2.检验项目名+结果的表述', '3.未达到疾病诊断标准的单纯指标异常', '4.影像学偶然发现']))
check('P0-1 低T3例外保留', '正常甲状腺功能病态综合征' in g1)
check('P0-1 明确目前诊断仍全覆盖', '须在【删除建议】段逐条列出并注明' in g1)

# ---------- P0-2 ----------
check('P0-2 旧第2条已移除', '如果诊断主要依据辅助检查结果，辅助检查结果满足该诊断，则需要列出' not in g1)
check('P0-2 新第2条存在', '2.辅助检查结果达到某一疾病实体的公认诊断标准时' in g1)

# ---------- P0-3 ----------
check('P0-3a 第5条已扩展', '5.辅助检查/检验的名称与结果均不能作为诊断名称或其组成部分' in g1)
check('P0-3b 凝血错误示例已改', '该条不应作为诊断；仅有纤维蛋白原升高而无疾病实体时删除该条' in g1)
check('P0-3c 肝功错误示例已改', '不得使用"肝功能异常"作为诊断名' in g1)
check('P0-3d 旧"应为凝血功能异常"示范已移除', '→ 应为"凝血功能异常"' not in g1)
check('P0-3e 旧"应为肝功能异常"示范已移除', '→ 应为"肝功能异常"' not in g1)

# ---------- P0-4 ----------
check('P0-4 错误7-10 齐备', all(('错误%d：' % i) in g1 for i in (7, 8, 9, 10)))
check('P0-4 覆盖四类条目',
      all(k in g1 for k in ['肾功能正常', '尿隐血阴性', '糖化血红蛋白升高', '高密度脂蛋白胆固醇升高', '副脾']))
check('P0-4 追加在错误6之后', g1.find('错误6：') < g1.find('错误7：'))

# ---------- P0-5 ----------
check('P0-5 矩阵新增非诊断性条目行', '非诊断性条目（检验结果/正常阴性值/单纯指标异常' in g2)
check('P0-5 矩阵新增影像偶然发现行', '影像学偶然发现（无症状、无需处理、与本次住院诊疗无关）' in g2)
check('P0-5 新增行位于"无问题"之前', g2.find('非诊断性条目（检验结果') < g2.find('| 无问题 | 保留原样 | 原诊断 |'))

# ---------- P0-6 ----------
check('P0-6a 约束6已加诊断资格审查授权', '属于名称层面的审查范围，必须审查并按审查决策矩阵处理' in g2)
check('P0-6b 约束7已加限定', '本条仅适用于构成疾病实体的诊断' in g2)
check('P0-6c 新增约束10', '10. 非诊断性条目' in g2 and '禁止为其构造替代疾病诊断' in g2)
check('P0-6d 约束10 在约束9之后', g2.find('9. Gate 1 输出末尾') < g2.find('10. 非诊断性条目'))

# ---------- 回归：原有契约未被破坏 ----------
check('回归 Gate1 全覆盖规则仍在', '【目前诊断全覆盖规则】（最高优先级，必须严格遵守）' in g1)
check('回归 Gate1 删除建议段仍在', '### 删除建议' in g1)
check('回归 Gate1 格式强制声明仍在', '【格式强制声明】' in g1)
check('回归 Gate1 实验室指标判读规范仍在', '实验室指标判读规范' in g1)
check('回归 Gate2 修订追溯格式仍在', '## 修订追溯段落格式' in g2)
check('回归 Gate2 dataCompleteness 仍在', 'dataCompleteness' in g2)
check('回归 Gate2 错诊替换规则仍在', '## 错诊替换规则' in g2)
check('回归 Gate2 输出不含独立删除建议段', '【不包含】独立的【删除建议】段' in g2)

failed = [r for r in results if not r[1]]
for label, ok, detail in results:
    print('%s %s' % ('[PASS]' if ok else '[FAIL]', label))
print('\n合计 %d 项，通过 %d，失败 %d' % (len(results), len(results) - len(failed), len(failed)))
print('Gate1 prompt=%d 字符, Gate2 prompt=%d 字符' % (len(g1), len(g2)))
sys.exit(1 if failed else 0)
