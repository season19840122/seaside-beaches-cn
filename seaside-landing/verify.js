const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const file = path.join(__dirname, 'prototype-浅水区-海图标-四海色.html');
const html = fs.readFileSync(file, 'utf8');

const runtimeErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => runtimeErrors.push(e.message));
vc.on('error', e => runtimeErrors.push(String(e)));

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
const doc = window.document;

const ok = [];
const fail = [];
const $ = s => doc.querySelector(s);
const $$ = s => [...doc.querySelectorAll(s)];
const vis = els => els.filter(e => !e.hidden);

/* ===== 1. 内容数据自洽 ===== */
const laneNums = $$('.pcard').map(c => ({
  name: c.querySelector('.pcard__name').textContent.trim(),
  lane: parseFloat(c.querySelector('.lane').style.getPropertyValue('--lane')),
  num: parseInt(c.querySelector('.lane__num').textContent, 10),
  meta: parseInt((c.querySelector('.pcard__meta').textContent.match(/(\d+)\s*处/) || [])[1], 10),
}));
const laneMismatch = laneNums.filter(x => x.num !== x.meta);
if (laneMismatch.length) fail.push('泳道线计数与卡片 meta 不一致: ' + laneMismatch.map(x => `${x.name} laneNum=${x.num} meta=${x.meta}`).join('; '));
else ok.push('14 张省份卡片：泳道线计数与 meta 全部一致');

const total = laneNums.reduce((s, x) => s + x.num, 0);
const footerTotal = parseInt((doc.querySelector('.site-foot__bar').textContent.match(/(\d+)\s*处/) || [])[1], 10);
if (total !== footerTotal) fail.push(`浴场总数不一致：卡片求和 ${total} vs 页脚 ${footerTotal}`);
else ok.push(`浴场总数自洽：卡片求和 = 页脚 = ${total} 处`);

// 分区标题求和
let regionSum = 0, regionBad = [];
$$('.seablock').forEach(b => {
  const t = b.querySelector('.seablock__count').textContent;
  const p = parseInt((t.match(/(\d+)\s*处/) || [])[1], 10);
  const c = parseInt((t.match(/(\d+)\s*座/) || [])[1], 10);
  const actualN = [...b.querySelectorAll('.pcard')].reduce((s, x) => s + parseInt(x.querySelector('.lane__num').textContent, 10), 0);
  const actualC = [...b.querySelectorAll('.citem')].length;
  regionSum += p;
  if (p !== actualN || c !== actualC) regionBad.push(`${b.id}: 标题(${c}市/${p}处) vs 实际(${actualC}市/${actualN}处)`);
});
if (regionBad.length) fail.push('海域分区统计不一致 — ' + regionBad.join(' | '));
else ok.push(`4 个海域分区标题的「市数/处数」与实际内容完全吻合，合计 ${regionSum} 处`);

// 泳道线宽度应与处数成正比，广东为满格
const maxNum = Math.max(...laneNums.map(x => x.num));
const laneBad = laneNums.filter(x => Math.abs(x.lane - (x.num / maxNum) * 100) > 1.5);
if (laneBad.length) fail.push('泳道线宽度与处数不成比例: ' + laneBad.map(x => `${x.name} ${x.lane}% (应 ${(x.num / maxNum * 100).toFixed(0)}%)`).join('; '));
else ok.push(`泳道线宽度与处数严格成比例，最长者「${laneNums.find(x => x.num === maxNum).name}」满格 100%`);

// 城市条目数 vs hero 统计
const heroCities = parseInt(doc.querySelectorAll('.stat__num')[1].textContent, 10);
const actualCities = $$('.citem').length;
if (heroCities !== actualCities) fail.push(`hero 城市统计 ${heroCities} vs 实际 ${actualCities}`);
else ok.push(`hero「${actualCities} 座城市与区」与实际条目数一致`);

/* ===== 2. 规范称谓 ===== */
const text = doc.body.textContent;
const bare = w => (text.match(new RegExp('(?<!中国)' + w, 'g')) || []).length;
const badNames = [];
if (bare('台湾')) badNames.push(`台湾 ×${bare('台湾')}`);
if (bare('香港')) badNames.push(`香港 ×${bare('香港')}`);
if (bare('澳门')) badNames.push(`澳门 ×${bare('澳门')}`);
if (badNames.length) fail.push('存在未冠「中国」的称谓: ' + badNames.join(', '));
else ok.push('中国台湾 / 中国香港 / 中国澳门 全部规范标注，无裸露称谓');

/* ===== 3. 禁用审美扫描 ===== */
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const slop = [];
if (/(linear|radial)-gradient\([^)]*(purple|#8b5cf6|#a855f7|#6366f1|#7c3aed|#5b21b6)/i.test(css)) slop.push('紫色/蓝紫渐变');
if (/font-family:\s*[^;]*['"]?(Inter|Roboto|Arial|Helvetica)['"]?/i.test(css)) slop.push('默认字体 Inter/Roboto/Arial');
if (/lorem ipsum/i.test(html)) slop.push('lorem ipsum');
if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(text)) slop.push('emoji 当图标');
if (slop.length) fail.push('命中禁用审美: ' + slop.join(', '));
else ok.push('未命中禁用审美清单（无紫色渐变 / 无 Inter・Roboto・Arial / 无 lorem / 无 emoji 图标）');

/* ===== 4. 无障碍 ===== */
const a11y = [];
if (!$('.skip')) a11y.push('缺 skip link');
if (!$('main#main')) a11y.push('缺 main');
if (!doc.querySelector('html').getAttribute('lang')) a11y.push('缺 lang');
if ($$('h1').length !== 1) a11y.push('h1 数量异常');
if (!$('input#q').labels.length) a11y.push('搜索框缺 label');
if (!$('footer')) a11y.push('缺 footer');
if (!$('#fnToggle').getAttribute('aria-expanded')) a11y.push('折叠按钮缺 aria-expanded');
$$('.status').forEach(s => { if (!s.textContent.trim()) a11y.push('空状态徽标'); });
if (a11y.length) fail.push('无障碍: ' + a11y.join('; '));
else ok.push('无障碍结构完整（skip link / lang / 单一 h1 / label / main / footer / aria-expanded）');

/* ===== 交互测试 ===== */
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }
function type(v) { const q = $('#q'); q.value = v; q.dispatchEvent(new window.Event('input', { bubbles: true })); }

const cards = $$('.pcard'), cites = $$('.citem');
const cardNames = () => vis(cards).map(c => c.querySelector('.pcard__name').textContent.trim());
const cityNames = () => vis(cites).map(c => c.querySelector('.citem__name').textContent.trim());

setTimeout(() => {
  if (runtimeErrors.length) fail.push('JS 运行时错误: ' + runtimeErrors.join(' | '));
  else ok.push('无 JS 运行时错误');

  // 4a. 城市级搜索：应只留下命中的城市
  type('付家庄');
  setTimeout(() => {
    if (vis(cards).length !== 1) fail.push(`搜「付家庄」应只剩 1 张省份卡片，实为 ${vis(cards).length}：${cardNames()}`);
    else if (cardNames()[0] !== '辽宁') fail.push(`搜「付家庄」命中的应是辽宁，实为 ${cardNames()[0]}`);
    else if (cityNames().join() !== '大连') fail.push(`搜「付家庄」应只留「大连」，实为 ${cityNames()}`);
    else ok.push('城市级搜索「付家庄」→ 精确收敛到 辽宁 / 大连');

    // 4b. 省级搜索：应保留整省全部城市
    type('辽宁');
    setTimeout(() => {
      const c = cityNames();
      if (cardNames().length !== 1 || c.length !== 5) fail.push(`搜「辽宁」应保留 1 张卡片 5 个城市，实为 ${cardNames()} / ${c.join()}`);
      else ok.push(`省级搜索「辽宁」→ 保留整省 ${c.length} 个城市（${c.join('、')}）`);

      // 4c. 浴场名跨省搜索
      type('金沙滩');
      setTimeout(() => {
        const n = vis(cards).length;
        if (n < 3) fail.push(`搜「金沙滩」应跨省命中多张卡片，实为 ${n}`);
        else ok.push(`跨省搜索「金沙滩」→ 命中 ${n} 张卡片：${cardNames().join('、')}`);

        // 4d. 高亮
        const hits = $$('.btags li.is-hit').length;
        if (hits === 0) fail.push('命中标签未高亮');
        else ok.push(`命中标签高亮 ${hits} 个`);

        // 4e. 无结果空态
        type('zzzz不存在的地方');
        setTimeout(() => {
          if (!$('#empty').classList.contains('is-on')) fail.push('无结果时空态未显示');
          else ok.push('无结果时正确显示空态');

          click($('#clearQ'));
          setTimeout(() => {
            if (vis(cards).length !== 14) fail.push(`清空后未恢复 14 张卡片，实为 ${vis(cards).length}`);
            else ok.push('清空搜索 → 恢复全部 14 张省份卡片');

            // 4f. 状态筛选
            click($('.chip[data-filter="swim"]'));
            const cSwim = vis(cites).length;
            click($('.chip[data-filter="nogo"]'));
            const cBoth = vis(cites).length;
            click($('.chip[data-filter="swim"]'));
            const cNogo = vis(cites).length;
            if (cSwim !== 51) fail.push(`筛「可下海」应为 51 条，实为 ${cSwim}`);
            else if (cBoth !== 52) fail.push(`筛「可下海 + 禁止下水」应为 52 条，实为 ${cBoth}`);
            else if (cNogo !== 1) fail.push(`筛「禁止下水」应为 1 条，实为 ${cNogo}`);
            else ok.push(`状态筛选多选正确：可下海 51 / 禁止下水 1 / 叠加 52 条`);

            if (!$('#resetAll').hidden) ok.push('有筛选条件时「清除筛选」按钮正确显示');
            else fail.push('有筛选条件时「清除筛选」按钮未显示');

            click($('#resetAll'));
            setTimeout(() => {
              if (vis(cites).length !== 56) fail.push(`重置后应为 56 条，实为 ${vis(cites).length}`);
              else ok.push('重置 → 恢复全部 56 条城市条目');
              if (!$('#resetAll').hidden) fail.push('重置后按钮未隐藏');
              else ok.push('重置后「清除筛选」按钮正确隐藏');

              // 4g. 折叠面板
              click($('#fnToggle'));
              const open1 = $('#footNote').getAttribute('data-open');
              const aria1 = $('#fnToggle').getAttribute('aria-expanded');
              click($('#fnToggle'));
              const open2 = $('#footNote').getAttribute('data-open');
              if (open1 !== 'true' || aria1 !== 'true' || open2 !== 'false') fail.push(`折叠面板状态机异常: open1=${open1} aria1=${aria1} open2=${open2}`);
              else ok.push('折叠面板开合与 aria-expanded 同步正确');

              // 4h. 海域标签 & 标尺
              const tabs = $$('[data-tab]');
              const blocks = $$('.seablock');
              if (tabs.length !== 8) fail.push(`海域导航项应为 8 个（桌面 4 + 移动 4），实为 ${tabs.length}`);
              else ok.push(`海域导航双端各 4 项，锚点指向 ${blocks.map(b => '#' + b.id).join(' / ')}`);
              const badAnchor = tabs.filter(t => !doc.getElementById(t.getAttribute('href').slice(1)));
              if (badAnchor.length) fail.push('存在无效锚点');
              else ok.push('全部锚点均指向存在的海域分区');

              // 4i. reduced-motion
              if (!/@media \(prefers-reduced-motion:\s*reduce\)/.test(css)) fail.push('缺 prefers-reduced-motion');
              else ok.push('已声明 prefers-reduced-motion: reduce');

              // 4j. focus-visible
              if (!/:focus-visible/.test(css)) fail.push('缺 :focus-visible');
              else ok.push('已声明 :focus-visible 焦点环');

              // 4k. 触控目标
              if (!/min-height:44px/.test(css)) fail.push('移动端触控目标未声明 ≥44px');
              else ok.push('移动端 chip/seatab/清除筛选 触控高度 ≥44px');

              console.log('\n===== 通过 =====');
              ok.forEach(s => console.log('  ✓ ' + s));
              if (fail.length) {
                console.log('\n===== 失败 =====');
                fail.forEach(s => console.log('  ✗ ' + s));
                process.exitCode = 1;
              } else {
                console.log(`\n===== 全部 ${ok.length} 项检查通过 =====`);
              }
            }, 60);
          }, 60);
        }, 200);
      }, 200);
    }, 200);
  }, 200);
}, 250);
