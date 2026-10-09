const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.join(__dirname, 'prototype-浅水区-海图标-四海色.html');

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  let bad = 0;
  for (const vw of [320, 375, 390, 414, 430, 600, 768, 834, 1024, 1280, 1440, 1920]) {
    const ctx = await b.newContext({ viewport: { width: vw, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(file, { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 6000))]));
    await p.waitForTimeout(400);

    const res = await p.evaluate(() => {
      const h1 = document.getElementById('heroTitle');
      // 按字符的 top 坐标切分出行
      const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
      const lines = new Map();
      let n;
      while ((n = walker.nextNode())) {
        for (let i = 0; i < n.data.length; i++) {
          if (!n.data[i].trim()) continue;
          const r = document.createRange();
          r.setStart(n, i); r.setEnd(n, i + 1);
          const rect = r.getBoundingClientRect();
          if (!rect.width && !rect.height) continue;
          const key = Math.round(rect.top);
          if (!lines.has(key)) lines.set(key, []);
          lines.get(key).push({ el: n.parentElement.className || n.parentElement.tagName, ch: n.data[i], left: Math.round(rect.left), right: Math.round(rect.right) });
        }
      }
      const keys = [...lines.keys()].sort((a, c) => a - c);
      const rows = keys.map(k => ({
        text: lines.get(k).map(x => x.ch).join(''),
        left: Math.min(...lines.get(k).map(x => x.left)),
        right: Math.max(...lines.get(k).map(x => x.right)),
      }));
      // 不可断词组必须全部落在同一视觉行：
      // 含嵌套 <em> 的 span 会返回多个 clientRect（每个内联盒一个），
      // 因此判定依据是这些矩形的 top 是否一致，而不是矩形数量。
      const nbSplit = [...h1.querySelectorAll('.nb, em')].map(el => {
        const rects = [...el.getClientRects()].filter(r => r.width || r.height);
        const tops = [...new Set(rects.map(r => Math.round(r.top)))];
        return { text: el.textContent, rects: rects.length, lineCount: tops.length };
      }).filter(x => x.lineCount > 1);
      return {
        lineCount: rows.length,
        rows,
        nbSplit,
        h1Overflow: h1.scrollWidth - h1.clientWidth,
        font: getComputedStyle(h1).fontSize,
        h1Left: Math.round(h1.getBoundingClientRect().left),
      };
    });

    const okSplit = res.nbSplit.length === 0;
    const okFit = res.h1Overflow <= 0;
    const ok = okSplit && okFit;
    if (!ok) bad++;
    console.log(`\n── ${vw}px (${res.font}) — ${res.lineCount} 行 ${ok ? '✓' : '✗'}`);
    res.rows.forEach((r, i) => console.log(`   L${i + 1}: 「${r.text}」  ${r.left}→${r.right}`));
    if (!okSplit) console.log('   ✗ 词组被拆行:', res.nbSplit.map(x => `「${x.text}」占 ${x.rects} 行`).join(', '));
    if (!okFit) console.log(`   ✗ 标题横向溢出 ${res.h1Overflow}px`);
    await ctx.close();
  }
  await b.close();
  console.log(bad === 0 ? '\n✓ 全部视口下标题断行均落在词组边界，无拆词、无溢出' : `\n✗ ${bad} 个视口存在问题`);
  process.exitCode = bad === 0 ? 0 : 1;
})();
