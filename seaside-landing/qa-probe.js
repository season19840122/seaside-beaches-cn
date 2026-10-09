const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const file = 'file://' + path.join(__dirname, 'prototype-浅水区-海图标-四海色.html');
const html = fs.readFileSync(path.join(__dirname, 'prototype-浅水区-海图标-四海色.html'), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(file, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 6000))]));
  await p.waitForTimeout(600);

  const data = await p.evaluate(() => {
    const out = {};
    const all = [...document.querySelectorAll('*')];

    // ---- 字号分布 ----
    const sizes = {};
    all.forEach(el => {
      if (!el.textContent.trim()) return;
      const fs = getComputedStyle(el).fontSize;
      sizes[fs] = (sizes[fs] || 0) + 1;
    });
    out.fontSizes = Object.entries(sizes).sort((a, c) => parseFloat(a) - parseFloat(c));

    // ---- 行高 ----
    const lh = {};
    ['.hero h1', '.hero__lede', '.pcard__name', '.citem__name', '.btags li', '.citem__note', '.seablock__desc', '.stat__label']
      .forEach(s => { const e = document.querySelector(s); if (e) lh[s] = getComputedStyle(e).lineHeight + ' / ' + getComputedStyle(e).fontSize; });
    out.lineHeights = lh;

    // ---- 间距值收集 ----
    const spacing = { padding: {}, margin: {}, gap: {} };
    all.forEach(el => {
      const cs = getComputedStyle(el);
      ['paddingTop','paddingRight','paddingBottom','paddingLeft'].forEach(k => {
        const v = cs[k]; if (v && v !== '0px' && !v.includes('%')) spacing.padding[v] = (spacing.padding[v]||0)+1;
      });
      ['marginTop','marginBottom'].forEach(k => {
        const v = cs[k]; if (v && v !== '0px' && !v.includes('%')) spacing.margin[v] = (spacing.margin[v]||0)+1;
      });
      ['rowGap','columnGap'].forEach(k => {
        const v = cs[k]; if (v && v !== '0px' && v !== 'normal') spacing.gap[v] = (spacing.gap[v]||0)+1;
      });
    });
    out.spacing = spacing;

    // ---- 过渡时长 ----
    const trans = {};
    all.forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.transitionDuration && cs.transitionDuration !== '0s') {
        trans[cs.transitionDuration] = (trans[cs.transitionDuration]||0)+1;
      }
    });
    out.transitions = trans;

    // ---- 触控目标（移动端标准需在移动视口测，这里先取桌面值）----
    out.touch = {};
    [['.chip','筛选 chip'], ['.seatab','海域标签'], ['.search__clear','清空按钮'], ['.filters__reset','清除筛选'], ['.foot-note__toggle','折叠按钮'], ['.rail__item','标尺项'], ['.seablock__title a','-']]
      .forEach(([sel, name]) => {
        const e = document.querySelector(sel);
        if (e) { const r = e.getBoundingClientRect(); out.touch[name] = `${Math.round(r.width)}×${Math.round(r.height)}`; }
      });

    // ---- 强调色面积占比 ----
    const totalArea = document.documentElement.scrollWidth * document.body.scrollHeight;
    let accentArea = 0, seaArea = 0, deepArea = 0;
    all.forEach(el => {
      const cs = getComputedStyle(el);
      const bg = cs.backgroundColor;
      const r = el.getBoundingClientRect();
      const a = r.width * r.height;
      if (!a) return;
      if (bg === 'rgb(232, 80, 47)' || cs.color === 'rgb(232, 80, 47)') accentArea += a;
      if (['rgb(122, 155, 142)','rgb(201, 164, 92)','rgb(74, 143, 168)','rgb(15, 94, 107)'].includes(bg)) seaArea += a;
      if (bg === 'rgb(11, 79, 92)') deepArea += a;
    });
    out.accentPct = +(accentArea / totalArea * 100).toFixed(3);
    out.seaPct = +(seaArea / totalArea * 100).toFixed(3);
    out.deepPct = +(deepArea / totalArea * 100).toFixed(3);

    // ---- 圆角分布 ----
    const radii = {};
    all.forEach(el => { const v = getComputedStyle(el).borderRadius; if (v && v !== '0px') radii[v] = (radii[v]||0)+1; });
    out.radii = Object.entries(radii).sort((a,c)=>parseFloat(a)-parseFloat(c));

    // ---- 标题层级连续性 ----
    out.headings = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => h.tagName + ' ' + getComputedStyle(h).fontSize + ' w' + getComputedStyle(h).fontWeight);

    // ---- 交互元素统计 ----
    out.interactive = {
      button: document.querySelectorAll('button').length,
      a: document.querySelectorAll('a').length,
      input: [...document.querySelectorAll('input')].map(i => i.type || 'text'),
      divOnclick: document.querySelectorAll('[onclick]:not(button):not(a)').length,
      positiveTabindex: document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length,
    };
    return out;
  });

  // ---- 移动端触控目标 ----
  const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(file, { waitUntil: 'domcontentloaded' });
  await mp.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1000))]));
  await mp.waitForTimeout(400);
  const mobileTouch = await mp.evaluate(() => {
    const res = {};
    [['.chip','筛选 chip'], ['.seatab','海域标签'], ['.search__clear','清空按钮'], ['.search input','搜索框'], ['.filters__reset','清除筛选'], ['.foot-note__toggle','折叠按钮']]
      .forEach(([sel, name]) => {
        const e = document.querySelector(sel);
        if (e) { const r = e.getBoundingClientRect(); res[name] = { w: Math.round(r.width), h: Math.round(r.height), pass44h: r.height >= 44 }; }
      });
    return res;
  });

  // ---- CSS 层状态覆盖 ----
  const stateAudit = {};
  ['.chip', '.seatab', '.search input', '.search__clear', '.filters__reset', '.foot-note__toggle', '.pcard', '.btags li', '.rail__item']
    .forEach(sel => {
      const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      stateAudit[sel] = {
        hover: new RegExp(esc + '[^{]*:hover').test(css) || new RegExp(esc.replace(/\\/g,'') + ':hover').test(css),
        active: new RegExp(esc + ':active').test(css),
        focus: new RegExp(esc + ':focus').test(css),
      };
    });
  stateAudit['全局 :focus-visible'] = { focus: /:focus-visible/.test(css) };
  stateAudit['全局 prefers-reduced-motion'] = { focus: /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/.test(css) };

  console.log(JSON.stringify({ ...data, mobileTouch, stateAudit }, null, 2));
  await b.close();
})();
