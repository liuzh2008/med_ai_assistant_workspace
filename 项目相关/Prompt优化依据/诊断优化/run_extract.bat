@echo off
rem ============================================================
rem  诊断分析数据提取 - 一键执行入口
rem  使用前：修改下方 CONN 为生产库连接串（只读账号即可）
rem  执行后：本目录生成 2 个文件
rem    - diagnosis_analysis_records.txt  (AI诊断+依据原文)
rem    - current_diagnoses.txt          (目前诊断)
rem ============================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem 关键：NLS_LANG 必须设置，否则中文 LIKE 匹配会失败
set NLS_LANG=SIMPLIFIED CHINESE_CHINA.AL32UTF8

rem ==== 修改此处：生产库连接串（格式：用户名/密码@//主机:端口/服务名）====
set CONN=system/Liuzh_123@//127.0.0.1:1521/FREE
rem ==========================================================================

echo [1/3] 数据量摸底...
sqlplus -s %CONN% @extract_01_count.sql

echo.
echo [2/3] 导出诊断分析记录...
sqlplus -s %CONN% @extract_02_results.sql

echo.
echo [3/3] 导出目前诊断...
sqlplus -s %CONN% @extract_03_diagnoses.sql

echo.
echo 全部完成。请检查本目录下的两个 txt 文件。
pause
