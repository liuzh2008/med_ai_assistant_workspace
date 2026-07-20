#!/usr/bin/env python3
"""
JSON 精确编辑器 —— 避免 SearchReplace 文本匹配出错
用法:
  python json_editor.py <文件> get    <路径>                  # 读取值
  python json_editor.py <文件> set    <路径> <值> [--type]     # 设置值
  python json_editor.py <文件> delete <路径>                   # 删除键
  python json_editor.py <文件> append <路径> <值> [--type]     # 数组追加
  python json_editor.py <文件> merge  <路径> <JSON片段>        # 合并对象

路径格式: 点号分隔的键名，数组索引用 [N]
  例: "patients[0].name"   "config.server.port"   "items[2].tags"

值类型自动推断，也可用 --type 显式指定: str int float bool null json
  - 裸字符串: python json_editor.py config.json set server.host 192.168.1.1 --type str
  - JSON值:   python json_editor.py config.json set server.port 8080
  - 复杂对象: python json_editor.py config.json merge server '{"host":"x","port":80}'

保护机制:
  - 修改前自动备份为 <文件>.bak
  - 修改后强制 JSON 解析验证
  - 验证失败自动回滚备份

PowerShell 注意: 含双引号的 JSON 参数需用反引号转义内部引号
"""

import json
import sys
import os
import shutil
import re
from pathlib import Path


# ── 路径解析 ──────────────────────────────────────────────

def parse_path(path_str: str):
    """将 'a.b[0].c' 解析为 ['a', 'b', 0, 'c']"""
    tokens = []
    for part in path_str.split('.'):
        m = re.match(r'^(.+?)\[(\d+)\]$', part)
        if m:
            tokens.append(m.group(1))
            tokens.append(int(m.group(2)))
        elif re.match(r'^\[\d+\]$', part):
            tokens.append(int(part[1:-1]))
        else:
            tokens.append(part)
    return tokens


def navigate(data, tokens, create_missing=False):
    """按 tokens 导航到目标位置，返回 (parent, last_key)"""
    if not tokens:
        return None, None

    current = data
    for i, token in enumerate(tokens[:-1]):
        next_token = tokens[i + 1]

        if isinstance(token, int):
            # 当前层是数组
            if isinstance(current, list) and token < len(current):
                current = current[token]
            elif create_missing:
                return None, None
            else:
                raise IndexError(f"数组索引越界: [{token}], 数组长度={len(current)}")
        else:
            # 当前层是字典
            if isinstance(current, dict) and token in current:
                current = current[token]
            elif isinstance(current, dict) and create_missing:
                current[token] = [] if isinstance(next_token, int) else {}
                current = current[token]
            elif isinstance(current, dict):
                raise KeyError(f"键不存在: '{token}', 可用键: {list(current.keys())}")
            else:
                raise TypeError(f"无法用键 '{token}' 访问类型 {type(current).__name__}")

    return current, tokens[-1]


# ── 值解析 ──────────────────────────────────────────────

def parse_value(raw: str, vtype: str = None):
    """将命令行字符串转为 Python 值"""
    if vtype is None:
        return _auto_parse(raw)
    
    vtype = vtype.lower()
    parsers = {
        'int': lambda s: int(s),
        'float': lambda s: float(s),
        'bool': lambda s: s.lower() in ('true', '1', 'yes'),
        'null': lambda s: None,
        'str': lambda s: s,
        'json': lambda s: json.loads(s),
    }
    if vtype not in parsers:
        raise ValueError(f"未知类型 '{vtype}', 可选: {list(parsers.keys())}")
    return parsers[vtype](raw)


def _auto_parse(raw: str):
    """自动推断值类型"""
    if raw is None:
        return None
    s = raw.strip()
    # null
    if s.lower() == 'null':
        return None
    # bool
    if s.lower() == 'true':
        return True
    if s.lower() == 'false':
        return False
    # int
    try:
        return int(s)
    except ValueError:
        pass
    # float
    try:
        return float(s)
    except ValueError:
        pass
    # JSON (object or array)
    if (s.startswith('{') and s.endswith('}')) or (s.startswith('[') and s.endswith(']')):
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            pass
    # 默认字符串
    return raw


# ── 核心操作 ──────────────────────────────────────────────

def do_get(filepath: str, path_str: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    parent, key = navigate(data, parse_path(path_str))
    if parent is None:
        print(f"错误: 路径 '{path_str}' 不存在")
        sys.exit(1)
    value = parent[key] if isinstance(parent, (dict, list)) else parent
    print(json.dumps(value, ensure_ascii=False, indent=2))


def do_set(filepath: str, path_str: str, raw_value: str, vtype: str = None):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tokens = parse_path(path_str)
    value = parse_value(raw_value, vtype)

    parent, key = navigate(data, tokens, create_missing=True)
    if parent is None and isinstance(key, int):
        print(f"错误: 不能自动创建数组索引 {key}")
        sys.exit(1)

    if isinstance(parent, list):
        parent[key] = value
    elif isinstance(parent, dict):
        parent[key] = value
    else:
        print(f"错误: 无法在类型 {type(parent).__name__} 上设置值")
        sys.exit(1)

    _safe_write(filepath, data)
    print(f"[OK] 已设置: {path_str} = {json.dumps(value, ensure_ascii=False)}")


def do_delete(filepath: str, path_str: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tokens = parse_path(path_str)
    parent, key = navigate(data, tokens)
    if parent is None:
        print(f"错误: 路径 '{path_str}' 不存在")
        sys.exit(1)

    if isinstance(parent, list):
        del parent[key]
    else:
        del parent[key]

    _safe_write(filepath, data)
    print(f"[OK] 已删除: {path_str}")


def do_append(filepath: str, path_str: str, raw_value: str, vtype: str = None):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tokens = parse_path(path_str)
    parent, key = navigate(data, tokens)
    if parent is None:
        print(f"错误: 路径 '{path_str}' 不存在")
        sys.exit(1)

    target = parent[key] if isinstance(parent, dict) else parent
    if not isinstance(target, list):
        print(f"错误: 路径 '{path_str}' 不是数组，类型为 {type(target).__name__}")
        sys.exit(1)

    value = parse_value(raw_value, vtype)
    target.append(value)

    _safe_write(filepath, data)
    print(f"[OK] 已追加到 {path_str}: {json.dumps(value, ensure_ascii=False)}")


def do_merge(filepath: str, path_str: str, raw_json: str):
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    try:
        merge_data = json.loads(raw_json)
    except json.JSONDecodeError as e:
        print(f"错误: 无效的 JSON: {e}")
        sys.exit(1)

    if not path_str:
        # 合并到根
        if not isinstance(data, dict) or not isinstance(merge_data, dict):
            print("错误: 根合并要求两边都是对象")
            sys.exit(1)
        data.update(merge_data)
    else:
        tokens = parse_path(path_str)
        parent, key = navigate(data, tokens)
        if parent is None:
            print(f"错误: 路径 '{path_str}' 不存在")
            sys.exit(1)
        target = parent[key] if isinstance(parent, dict) else parent
        if not isinstance(target, dict) or not isinstance(merge_data, dict):
            print(f"错误: merge 要求目标和值都是对象，实际: {type(target).__name__}, {type(merge_data).__name__}")
            sys.exit(1)
        target.update(merge_data)

    _safe_write(filepath, data)
    print(f"[OK] 已合并到 {path_str or '(根)'}")


# ── 安全写入 ──────────────────────────────────────────────

def _safe_write(filepath: str, data):
    """备份 → 写入 → 验证 → 失败则回滚"""
    # 1. 格式化 JSON
    try:
        new_content = json.dumps(data, ensure_ascii=False, indent=2)
    except (TypeError, ValueError) as e:
        print(f"错误: JSON 序列化失败: {e}")
        sys.exit(1)

    # 2. 验证（再解析一次）
    try:
        json.loads(new_content)
    except json.JSONDecodeError as e:
        print(f"严重错误: 写入前验证失败（不应发生）: {e}")
        sys.exit(1)

    # 3. 备份原文件
    bak_path = filepath + '.bak'
    if os.path.exists(filepath):
        shutil.copy2(filepath, bak_path)

    # 4. 写入
    temp_path = filepath + '.tmp'
    try:
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
            f.write('\n')

        # 5. 验证写入的文件
        with open(temp_path, 'r', encoding='utf-8') as f:
            json.load(f)  # 必须能解析

        # 6. 原子替换
        os.replace(temp_path, filepath)
    except Exception as e:
        # 回滚
        if os.path.exists(bak_path):
            shutil.copy2(bak_path, filepath)
        print(f"写入失败，已回滚: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        sys.exit(1)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ── CLI ────────────────────────────────────────────────────

def print_usage():
    print(__doc__)


def main():
    if len(sys.argv) < 3 or sys.argv[1] in ('-h', '--help', 'help'):
        print_usage()
        sys.exit(0)

    filepath = sys.argv[1]
    command = sys.argv[2].lower()

    if not os.path.exists(filepath):
        print(f"错误: 文件不存在: {filepath}")
        sys.exit(1)

    # 解析 --type 参数
    vtype = None
    args = list(sys.argv[3:])
    for i, arg in enumerate(args):
        if arg == '--type' and i + 1 < len(args):
            vtype = args[i + 1]
            args = args[:i] + args[i+2:]
            break

    try:
        if command == 'get':
            do_get(filepath, args[0])
        elif command == 'set':
            do_set(filepath, args[0], args[1], vtype)
        elif command == 'delete':
            do_delete(filepath, args[0])
        elif command == 'append':
            do_append(filepath, args[0], args[1], vtype)
        elif command == 'merge':
            do_merge(filepath, args[0] if args else '', args[-1])
        else:
            print(f"未知命令: {command}")
            print_usage()
            sys.exit(1)
    except IndexError:
        print(f"错误: '{command}' 命令缺少参数")
        print_usage()
        sys.exit(1)
    except (KeyError, IndexError, TypeError) as e:
        print(f"错误: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"错误: JSON 解析失败: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

