/**
 * 全国海滨浴场落地页 — 项目专属业务断言
 *
 * 通用检查（溢出/对比度/无障碍/断行/标尺…）由 html-prototype-qa 技能承担，
 * 这里只保留与「海滨浴场」内容强绑定的业务逻辑校验。
 *
 * 用法：
 *   ~/.agents/skills/html-prototype-qa/scripts/qa.sh \
 *     prototype-浅水区-海图标-四海色.html --asserts qa-asserts.cjs
 *
 * 页面结构或内容大改后，需要同步更新本文件里的期望值。
 */

module.exports = async (page) => {
  const out = [];
  const fail = (sev, msg, suggest) => out.push({ sev, msg, suggest });

  const cases = () => page.$$eval('.pcard:not([hidden])', els =>
    els.map(e => e.querySelector('.pcard__name').textContent.trim()));

  /* ---------- 1. 搜索：城市级精确收敛 ---------- */
  await page.fill('#q', '付家庄');
  await page.waitForTimeout(400);
  let names = await cases();
  if (names.length !== 1 || names[0] !== '辽宁') {
    fail('p0', '搜「付家庄」应只剩辽宁一张卡片，实为 [' + names.join(', ') + ']');
  }

  /* ---------- 2. 搜索：省级应保留整省全部城市 ---------- */
  await page.fill('#q', '辽宁');
  await page.waitForTimeout(400);
  const lnCards = await cases();
  const cities = await page.$$eval('.citem:not([hidden])', els =>
    els.map(e => e.querySelector('.citem__name').textContent.trim()));
  if (lnCards.length !== 1 || cities.length !== 5) {
    fail('p0', '搜「辽宁」应保留 1 张卡片 5 个城市，实为 ' +
      lnCards.length + ' 张卡片 / ' + cities.length + ' 个城市 [' + cities.join('、') + ']');
  }

  /* ---------- 3. 搜索：浴场名应跨省命中 ---------- */
  await page.fill('#q', '金沙滩');
  await page.waitForTimeout(400);
  names = await cases();
  if (names.length < 3) fail('p0', '搜「金沙滩」应跨省命中至少 3 张卡片，实为 ' + names.length);

  /* ---------- 4. 命中标签高亮 ---------- */
  const hits = await page.$$eval('.btags li.is-hit', els => els.length);
  if (hits === 0) fail('p0', '搜索命中时标签未高亮');

  /* ---------- 5. 无结果空态 ---------- */
  await page.fill('#q', 'zzzz不存在的地方');
  await page.waitForTimeout(400);
  const emptyOn = await page.$eval('#empty', el => el.classList.contains('is-on'));
  if (!emptyOn) fail('p1', '无搜索结果时空态未显示');

  /* ---------- 6. 清空恢复 ---------- */
  await page.click('#clearQ');
  await page.waitForTimeout(400);
  const restored = (await cases()).length;
  if (restored !== 14) fail('p0', '清空搜索应恢复 14 张省份卡片，实为 ' + restored);

  /* ---------- 7. 状态筛选多选叠加 ---------- */
  const countVisible = () => page.$$eval('.citem:not([hidden])', els => els.length);
  await page.click('.chip[data-filter="swim"]');
  await page.waitForTimeout(250);
  const cSwim = await countVisible();
  await page.click('.chip[data-filter="nogo"]');
  await page.waitForTimeout(250);
  const cBoth = await countVisible();
  await page.click('.chip[data-filter="swim"]');
  await page.waitForTimeout(250);
  const cNogo = await countVisible();
  if (cSwim !== 51) fail('p0', '筛「可下海」应为 51 条，实为 ' + cSwim);
  if (cBoth !== 52) fail('p0', '筛「可下海 + 仅人工」应为 52 条，实为 ' + cBoth);
  if (cNogo !== 1) fail('p0', '筛「仅人工」应为 1 条，实为 ' + cNogo);

  /* ---------- 8. 清除筛选按钮的显隐 ---------- */
  const shownWithFilter = await page.$eval('#resetAll', el => !el.hidden);
  if (!shownWithFilter) fail('p1', '有筛选条件时「清除筛选」按钮未显示');
  await page.click('#resetAll');
  await page.waitForTimeout(300);
  if ((await countVisible()) !== 56) fail('p0', '重置筛选后应恢复 56 条城市条目');
  const hiddenAfter = await page.$eval('#resetAll', el => el.hidden);
  if (!hiddenAfter) fail('p1', '重置后「清除筛选」按钮未隐藏');

  /* ---------- 9. 折叠面板状态机与 aria 同步 ---------- */
  await page.click('#fnToggle');
  const open1 = await page.$eval('#footNote', el => el.getAttribute('data-open'));
  const aria1 = await page.$eval('#fnToggle', el => el.getAttribute('aria-expanded'));
  await page.click('#fnToggle');
  const open2 = await page.$eval('#footNote', el => el.getAttribute('data-open'));
  if (open1 !== 'true' || aria1 !== 'true' || open2 !== 'false') {
    fail('p0', '折叠面板开合与 aria-expanded 未同步: open1=' + open1 + ' aria1=' + aria1 + ' open2=' + open2);
  }

  /* ---------- 10. 数据自洽：泳道线计数 = 卡片 meta = 分区统计 = 页脚总数 ---------- */
  const nums = await page.$$eval('.pcard', els => els.map(e => ({
    name: e.querySelector('.pcard__name').textContent.trim(),
    lane: parseInt(e.querySelector('.lane__num').textContent, 10),
    meta: parseInt((e.querySelector('.pcard__meta').textContent.match(/(\d+)\s*处/) || [])[1], 10),
    pct: parseFloat(e.querySelector('.lane').style.getPropertyValue('--lane')),
  })));
  const mismatch = nums.filter(x => x.lane !== x.meta);
  if (mismatch.length) {
    fail('p0', '泳道线计数与卡片 meta 不一致: ' +
      mismatch.map(x => x.name + ' lane=' + x.lane + ' meta=' + x.meta).join('; '));
  }

  const sum = nums.reduce((s, x) => s + x.lane, 0);
  const footer = await page.$eval('.site-foot__bar', el =>
    parseInt((el.textContent.match(/(\d+)\s*处/) || [])[1], 10));
  if (sum !== footer) fail('p0', '浴场总数不自洽：卡片求和 ' + sum + ' vs 页脚 ' + footer);

  const maxNum = Math.max.apply(null, nums.map(x => x.lane));
  const laneBad = nums.filter(x => Math.abs(x.pct - (x.lane / maxNum) * 100) > 1.5);
  if (laneBad.length) {
    fail('p1', '泳道线宽度与处数不成比例: ' +
      laneBad.map(x => x.name + ' ' + x.pct + '% (应 ' + ((x.lane / maxNum) * 100).toFixed(0) + '%)').join('; '));
  }

  /* ---------- 11. 分区标题统计与实际内容吻合 ---------- */
  const regionBad = await page.$$eval('.seablock', blocks => {
    const bad = [];
    blocks.forEach(b => {
      const t = b.querySelector('.seablock__count').textContent;
      const p = parseInt((t.match(/(\d+)\s*处/) || [])[1], 10);
      const c = parseInt((t.match(/(\d+)\s*座/) || [])[1], 10);
      const actualN = Array.from(b.querySelectorAll('.pcard'))
        .reduce((s, x) => s + parseInt(x.querySelector('.lane__num').textContent, 10), 0);
      const actualC = b.querySelectorAll('.citem').length;
      if (p !== actualN || c !== actualC) {
        bad.push(b.id + ': 标题 ' + c + '市/' + p + '处 vs 实际 ' + actualC + '市/' + actualN + '处');
      }
    });
    return bad;
  });
  if (regionBad.length) fail('p0', '海域分区统计不一致 — ' + regionBad.join(' | '));

  /* ---------- 12. 规范称谓：中国台湾 / 中国香港 / 中国澳门 ---------- */
  const text = await page.evaluate(() => document.body.textContent);
  ['台湾', '香港', '澳门'].forEach(w => {
    const n = (text.match(new RegExp('(?<!中国)' + w, 'g')) || []).length;
    if (n) fail('p0', '存在未冠「中国」的称谓: ' + w + ' ×' + n + '，应写作「中国' + w + '」');
  });

  return out;
};
