const { chromium } = require('playwright');
const path = require('path');
const file = 'file://' + path.join(__dirname, 'prototype-浅水区-海图标-四海色.html');

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });

  // 阻断所有字体 CDN 请求，模拟 Google Fonts 不可达
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await ctx.route('**/*', route => {
    const u = route.request().url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.abort();
    return route.continue();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  const t0 = Date.now();
  await p.goto(file, { waitUntil: 'domcontentloaded' });

  // 首屏内容在字体被阻断的情况下是否已经可见（不应白屏等待）
  await p.waitForSelector('#heroTitle', { state: 'visible' });
  const firstPaint = Date.now() - t0;

  await p.waitForTimeout(2500);

  const r = await p.evaluate(() => {
    const cs = el => getComputedStyle(el);
    const h1 = document.getElementById('heroTitle');
    const de = document.documentElement;
    // 实际生效的字体（降级后应落到系统字体，而非默认 serif 兜底）
    const used = el => {
      const fam = cs(el).fontFamily;
      return fam.split(',')[0].replace(/['"]/g, '');
    };
    return {
      首屏h1可见: !!h1.getBoundingClientRect().height,
      h1字体栈: cs(h1).fontFamily,
      body字体栈: cs(document.body).fontFamily,
      横向溢出: de.scrollWidth - de.clientWidth,
      h1行数: (() => {
        const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
        const tops = new Set(); let n;
        while ((n = walker.nextNode())) {
          for (let i = 0; i < n.data.length; i++) {
            if (!n.data[i].trim()) continue;
            const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
            const rect = rg.getBoundingClientRect();
            if (rect.height) tops.add(Math.round(rect.top));
          }
        }
        return tops.size;
      })(),
      泳道线正常: document.querySelectorAll('.lane__gauge').length === 14,
      卡片数: document.querySelectorAll('.pcard').length,
    };
  });

  console.log('===== 字体 CDN 被阻断（模拟国内网络）=====');
  console.log(JSON.stringify(r, null, 2));
  console.log(`首屏标题可见耗时: ${firstPaint}ms`);
  console.log(errs.length ? '页面错误: ' + errs.join(' | ') : '页面错误: 无');
  console.log(r.横向溢出 === 0 ? '✓ 降级后无横向溢出' : `✗ 溢出 ${r.横向溢出}px`);
  console.log(firstPaint < 2000 ? '✓ 字体不可达时首屏不阻塞（<2s 即可见）' : `✗ 首屏被字体阻塞 ${firstPaint}ms`);

  await p.screenshot({ path: path.join(__dirname, 'shot-fallback-fonts.png'), clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  await p.evaluate(() => document.getElementById('nanhai').scrollIntoView());
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(__dirname, 'shot-fallback-fonts-cards.png') });

  await b.close();
})();
