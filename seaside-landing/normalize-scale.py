#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把散落的野生字号/间距收敛到设计系统标尺上。每一步都校验命中数，不符预期立即中止。"""
import re, sys, io

P = 'prototype-浅水区-海图标-四海色.html'
src = open(P, encoding='utf-8').read()
orig = src
log = []
fail = []

def rep(old, new, expect):
    global src
    n = src.count(old)
    if n != expect:
        fail.append(f'命中 {n} 次（预期 {expect}）: {old[:60]}')
        return
    src = src.replace(old, new)
    log.append(f'{n:>3}× {old[:52]:<52} → {new[:34]}')

# ============ 字号：收敛到 11 / 12.5 / 13.5 / 14.5 / 16 / 17 / 21 / 26 / 30 / 42 / 60 ============
rep('font-size:10px',    'font-size:11px',    1)   # .brand__sub  10 → micro 11
rep('font-size:12px',    'font-size:12.5px',  4)   # 12 与 12.5 是近似重复档，合并到 caption
rep('font-size:13px',    'font-size:13.5px',  2)   # 13 与 13.5 合并到 label
rep('font-size:14px',    'font-size:14.5px',  4)   # 14 与 14.5 合并到 small
rep('font-size:19px',    'font-size:21px',    2)   # 19 是野生档 → h3
rep('font-size:20px',    'font-size:21px',    1)   # 20 是野生档 → h3

# 移动端 hero lede 的 15.5px 野生态：直接撤掉该覆盖，统一用 17px
rep('  .hero__lede{font-size:15.5px}\n', '', 1)

# ============ 间距：全部落到 4px 标尺 ============
rep('padding:3px 8px;',                      'padding:4px 8px;',                       1)  # .btags li 3 → 2xs
rep('padding:4px 8px 4px 6px;',              'padding:4px 8px;',                       1)  # .status 去掉 6px 不对称值
rep('padding:0 9px;',                        'padding:0 8px;',                         1)  # .pcard__flag 9 → xs
rep('padding-left:10px;',                    'padding-left:12px;',                     1)  # .citem__note 10 → sm
rep('padding:var(--s-md) var(--s-md) 14px;', 'padding:var(--s-md) var(--s-md) 16px;',  1)  # .stat 14 → md
rep('padding:0 var(--s-sm) 0 34px;',         'padding:0 var(--s-sm) 0 32px;',          1)  # .search input 34 → xl
rep('margin-top:9px}',                       'margin-top:8px}',                        1)  # 列表点对齐 9 → xs
rep('right:6px;top:50%',                     'right:4px;top:50%',                      1)  # .search__clear 偏移 6 → 2xs

# gap 6px / 7px → xs 8px
gap6 = src.count('gap:6px')
src = src.replace('gap:6px', 'gap:8px')
if gap6 == 0: fail.append('未找到 gap:6px')
else: log.append(f'{gap6:>3}× gap:6px → gap:8px')
gap7 = src.count('gap:7px')
src = src.replace('gap:7px', 'gap:8px')
if gap7 == 0: fail.append('未找到 gap:7px')
else: log.append(f'{gap7:>3}× gap:7px → gap:8px')

# 搜索图标位置随 padding 一起左移，保持 7px 视觉间隔
rep('position:absolute;left:11px;top:50%;transform:translateY(-50%);',
    'position:absolute;left:10px;top:50%;transform:translateY(-50%);', 1)

if fail:
    print('中止，未写入任何改动：')
    for f in fail: print('  ✗ ' + f)
    sys.exit(1)

open(P, 'w', encoding='utf-8').write(src)
print('已应用改动：')
for l in log: print('  ' + l)
