/* Flip Light — Pre-Purchase Deal Check / 买入前红绿灯
   Pure client-side underwriting model. No data leaves the browser.
   Algorithm: ceiling ARV -> itemised renovation -> reverse max-bid -> stress tests.
*/
'use strict';

/* ---------------- Renovation catalogue ----------------
   cat: 'system' = invisible infrastructure (roof, wiring, plumbing, HVAC)
        'visible' = what buyers pay for (kitchen, baths, floors, curb appeal)
        'mixed'   = in between (windows/doors)
*/
const RENO_ITEMS = [
  { id: 'roof',        zh: '新屋顶 + 水槽',        en: 'New roof + gutters',            cat: 'system',  def: 18000 },
  { id: 'rewire',      zh: '全屋换线 + 配电箱',    en: 'Whole-house rewire + panel',    cat: 'system',  def: 16000 },
  { id: 'replumb',     zh: '全新水管',              en: 'Full replumb',                  cat: 'system',  def: 12000 },
  { id: 'hvac',        zh: '全新 HVAC 冷暖系统',   en: 'New HVAC system',               cat: 'system',  def: 14000 },
  { id: 'windows',     zh: '双层窗 + 推拉门',      en: 'Dual-pane windows + sliders',   cat: 'mixed',   def: 18000 },
  { id: 'kitchen',     zh: '全新厨房',              en: 'Full kitchen remodel',          cat: 'visible', def: 48000 },
  { id: 'baths',       zh: '卫生间全拆重做 (×2)',  en: 'Bathrooms gutted (x2)',         cat: 'visible', def: 38000 },
  { id: 'flooring',    zh: '全屋地板',              en: 'Flooring throughout',           cat: 'visible', def: 13000 },
  { id: 'paint',       zh: '内外墙漆',              en: 'Interior + exterior paint',     cat: 'visible', def: 10000 },
  { id: 'doors',       zh: '全部内外门',            en: 'All interior/exterior doors',   cat: 'mixed',   def: 8000 },
  { id: 'deck',        zh: '新建 Deck 平台',       en: 'New deck',                      cat: 'visible', def: 15000 },
  { id: 'landscaping', zh: '前后院景观',            en: 'Front/back landscaping',        cat: 'visible', def: 20000 },
  { id: 'misc',        zh: '许可/垃圾清运/杂项',   en: 'Permits / dump / misc',         cat: 'system',  def: 5000 },
];

/* ---------------- Case study preset: 155 Lily Blossom Ct ---------------- */
const LILY = {
  address: '155 Lily Blossom Ct, San Jose, CA 95123',
  price: 1160000, arv: 1400000, sqft: 1782, beds: 4, baths: 2, tier: 'mid',
  loan: 1000000, rate: 10.5, months: 5.6, monthlyCarrying: 1100,
  buyPct: 1, sellPct: 4, target: 100000,
  reno: { roof: 18000, rewire: 16000, replumb: 12000, hvac: 14000, windows: 18000,
          kitchen: 48000, baths: 38000, flooring: 13000, paint: 10000, doors: 8000,
          deck: 15000, landscaping: 20000, misc: 5000 },
};

/* ---------------- Core algorithm (pure, testable) ---------------- */
function compute(inp) {
  const renoTotal = RENO_ITEMS.reduce((s, it) => s + (Number(inp.reno[it.id]) || 0), 0);
  const systemCost = RENO_ITEMS.filter(i => i.cat === 'system')
    .reduce((s, it) => s + (Number(inp.reno[it.id]) || 0), 0);
  const interest = (x, months) => x.loan * (x.rate / 100) * (months / 12);
  const holdingFor = (x, months) => interest(x, months) + x.monthlyCarrying * months;

  const holding = holdingFor(inp, inp.months);
  const buyClose = inp.price * inp.buyPct / 100;
  const sellCost = inp.arv * inp.sellPct / 100;
  const profit = inp.arv - inp.price - renoTotal - buyClose - holding - sellCost;

  // Reverse max-bid: solve price so that profit == target (holding held constant at entered loan terms)
  const maxBidTarget = (inp.arv - renoTotal - holding - sellCost - inp.target) / (1 + inp.buyPct / 100);
  const maxBidBE = (inp.arv - renoTotal - holding - sellCost) / (1 + inp.buyPct / 100);

  const profitWith = (arvMul, renoMul, extraMonths) => {
    const arv2 = inp.arv * arvMul;
    return arv2 - inp.price - renoTotal * renoMul - buyClose
      - holdingFor(inp, inp.months + extraMonths) - arv2 * inp.sellPct / 100;
  };
  const stresses = [
    { id: 'arv',   profit: profitWith(0.95, 1, 0) },
    { id: 'reno',  profit: profitWith(1, 1.20, 0) },
    { id: 'hold',  profit: profitWith(1, 1, 3) },
    { id: 'combo', profit: profitWith(0.95, 1.20, 3) },
  ];
  const stressesPassed = stresses.filter(s => s.profit >= 0).length;

  let verdict = 'red';
  if (inp.price <= maxBidTarget) verdict = 'green';
  else if (inp.price <= maxBidBE) verdict = 'yellow';

  return {
    renoTotal, systemCost,
    systemShare: renoTotal > 0 ? systemCost / renoTotal : 0,
    interest: interest(inp, inp.months), holding,
    buyClose, sellCost, profit,
    grossSpread: inp.arv - inp.price,
    maxBidTarget, maxBidBE,
    overpayVsBE: inp.price - maxBidBE,
    dailyBurn: inp.loan * (inp.rate / 100) / 365 + inp.monthlyCarrying / 30.4,
    arvPerSqft: inp.sqft > 0 ? inp.arv / inp.sqft : 0,
    stresses, stressesPassed, verdict,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compute, RENO_ITEMS, LILY };
}

/* ---------------- i18n ---------------- */
const T = {
  zh: {
    title: 'Flip 红绿灯', subtitle: '买入前决策报告 · Pre-Purchase Deal Check',
    tagline: 'AI 不替代经纪人 — 它只做刹车和账本。签约之前，先算最高可买价。',
    loadCase: '载入案例：155 Lily Blossom（San Jose）', clear: '清空 / 新单',
    uploadData: '上传资料 (CSV / JSON)', uploadPhotos: '上传照片 / 文件',
    uploadNote: '文件只在你自己的浏览器里读取，不会发送到任何服务器。',
    downloadTemplate: '下载资料模板 CSV', downloadDeal: '下载本单数据 CSV', downloadReport: '下载报告', print: '打印 / 存 PDF',
    secProperty: '房屋信息', secDeal: '交易数字', secReno: '装修清单（勾选并可改价）', secFinance: '资金与持有',
    address: '地址', price: '买入价 / 要价 ($)', arv: '预估售价 ARV ($)', sqft: '面积 (sq ft)',
    beds: '卧室', baths: '卫浴', tier: '市场档位', tierLux: '豪宅（Palo Alto 级）', tierMid: '中端（San Jose 级）', tierEntry: '入门',
    loan: '贷款金额 ($)', rate: '年利率 (%)', months: '预计持有 (月)', monthlyCarrying: '每月持有杂费 ($ 税/保险/水电)',
    buyPct: '买入过户费 (%)', sellPct: '卖出成本 (%)', target: '目标利润 ($)',
    renoTotal: '装修合计', systemShare: '其中看不见的系统项占比',
    verdictGreen: '🟢 绿灯 — 可以买', verdictYellow: '🟡 黄灯 — 只有降价或砍装修才行', verdictRed: '🔴 红灯 — 不要买',
    rMaxTarget: '最高可买价（留目标利润）', rMaxBE: '保本最高价（利润 = 0）', rProfit: '按当前买价的预计利润',
    rSpread: '毛差价（ARV − 买价）', rHolding: '持有成本（含利息）', rDaily: '每天烧钱', rArvSqft: 'ARV 每尺价',
    bridgeTitle: '利润桥（钱去哪了）', stressTitle: '压力测试（单子有多脆）',
    sArv: '售价跌 5%', sReno: '装修超支 20%', sHold: '多持有 3 个月', sCombo: '三项一起来',
    pass: '扛得住', fail: '击穿', survived: '4 项压力测试扛住了 {n} 项 — 纪律要求：至少扛住前 3 项里的 2 项',
    warnSystem: '⚠️ 系统项（屋顶/电线/水管/HVAC）占比过高：这类钱买家看不见。在中端/入门市场，它们多半收不回来 — 考虑砍到「必修 + 看得见」的版本。',
    warnPrice: '⚠️ 买价已高出保本线 {x}：哪怕一切顺利，这单也注定亏。',
    howTitle: '算法怎么算的', howBody: '1) 用同街区装修后成交定 ARV 天花板，不用希望价；2) 装修逐项计价；3) 倒算最高可买价 = ARV − 装修 − 交易成本 − 持有利息 − 目标利润；4) 压力测试逐项砸：售价、超支、延期。AI 不找房、不谈判、不判断客户信任 — 那些是经纪人的活。',
    photosTitle: '已上传的资料（仅在本机浏览器中）', disclaimer: '原型工具：数字为估算，不构成投资建议。成交与贷款请以正式文件为准。',
    reportHead: '买入前红绿灯报告', generated: '生成时间',
  },
  en: {
    title: 'Flip Light', subtitle: 'Pre-Purchase Deal Check · 买入前决策报告',
    tagline: 'AI does not replace the agent — it is the brake and the ledger. Compute the max bid BEFORE you sign.',
    loadCase: 'Load case study: 155 Lily Blossom (San Jose)', clear: 'Clear / New deal',
    uploadData: 'Upload data (CSV / JSON)', uploadPhotos: 'Upload photos / files',
    uploadNote: 'Files are read only inside your own browser — nothing is sent to any server.',
    downloadTemplate: 'Download data template CSV', downloadDeal: 'Download this deal CSV', downloadReport: 'Download report', print: 'Print / Save PDF',
    secProperty: 'Property', secDeal: 'Deal numbers', secReno: 'Renovation scope (tick & edit prices)', secFinance: 'Financing & holding',
    address: 'Address', price: 'Purchase price / Ask ($)', arv: 'Expected sale price, ARV ($)', sqft: 'Living area (sq ft)',
    beds: 'Beds', baths: 'Baths', tier: 'Market tier', tierLux: 'Luxury (Palo Alto tier)', tierMid: 'Mid-market (San Jose tier)', tierEntry: 'Entry',
    loan: 'Loan amount ($)', rate: 'Annual rate (%)', months: 'Planned hold (months)', monthlyCarrying: 'Monthly carrying ($ tax/ins/util)',
    buyPct: 'Buy closing costs (%)', sellPct: 'Sell-side costs (%)', target: 'Target profit ($)',
    renoTotal: 'Renovation total', systemShare: 'of which invisible systems',
    verdictGreen: '🟢 GREEN — Buy', verdictYellow: '🟡 YELLOW — Only at a lower price or leaner scope', verdictRed: '🔴 RED — Walk away',
    rMaxTarget: 'Max bid (keeps target profit)', rMaxBE: 'Max bid (break-even)', rProfit: 'Projected profit at current price',
    rSpread: 'Gross spread (ARV − price)', rHolding: 'Holding cost (incl. interest)', rDaily: 'Daily burn', rArvSqft: 'ARV per sq ft',
    bridgeTitle: 'Profit bridge (where the money goes)', stressTitle: 'Stress tests (how fragile is this deal?)',
    sArv: 'Sale price −5%', sReno: 'Renovation +20%', sHold: 'Hold +3 months', sCombo: 'All three at once',
    pass: 'Survives', fail: 'Breaks', survived: 'Survived {n} of 4 stress tests — house rule: must survive at least 2 of the first 3',
    warnSystem: '⚠️ Invisible systems (roof / wiring / plumbing / HVAC) are a large share of the budget: buyers cannot see this money. In mid/entry markets most of it is not recovered — consider cutting to a "must-fix + visible" scope.',
    warnPrice: '⚠️ The price is already {x} above the break-even line: even if everything goes right, this deal is born losing.',
    howTitle: 'How the algorithm works', howBody: '1) ARV is capped by renovated comps in the same neighbourhood, never by hope; 2) renovation is priced line by line; 3) max bid is solved backwards = ARV − renovation − transaction costs − holding interest − target profit; 4) stress tests hit price, overruns and delays one by one. The AI does not source homes, negotiate, or judge client trust — that stays with the agent.',
    photosTitle: 'Uploaded materials (in this browser only)', disclaimer: 'Prototype tool: figures are estimates, not investment advice. Rely on formal documents for closing and lending.',
    reportHead: 'Pre-Purchase Deal Check Report', generated: 'Generated',
  },
};
let lang = 'zh';
try { lang = localStorage.getItem('fliplight-lang') || 'zh'; } catch (e) {}
const t = k => (T[lang] && T[lang][k]) || T.zh[k] || k;
const fmt = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

/* ---------------- DOM wiring ---------------- */
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let state = JSON.parse(JSON.stringify(LILY));

  function buildRenoRows() {
    const wrap = $('renoRows'); wrap.innerHTML = '';
    RENO_ITEMS.forEach(it => {
      const row = document.createElement('label');
      row.className = 'reno-row';
      row.innerHTML = `<input type="checkbox" id="chk_${it.id}" checked>
        <span class="reno-name">${lang === 'zh' ? it.zh : it.en} <em class="cat">${it.cat}</em></span>
        <input type="number" class="reno-cost" id="reno_${it.id}" value="${it.def}" step="500" min="0">`;
      wrap.appendChild(row);
    });
  }

  function applyState() {
    $('f_address').value = state.address; $('f_price').value = state.price;
    $('f_arv').value = state.arv; $('f_sqft').value = state.sqft;
    $('f_beds').value = state.beds; $('f_baths').value = state.baths;
    $('f_tier').value = state.tier; $('f_loan').value = state.loan;
    $('f_rate').value = state.rate; $('f_months').value = state.months;
    $('f_carry').value = state.monthlyCarrying; $('f_buyPct').value = state.buyPct;
    $('f_sellPct').value = state.sellPct; $('f_target').value = state.target;
    RENO_ITEMS.forEach(it => {
      const v = Number(state.reno[it.id]) || 0;
      $('chk_' + it.id).checked = v > 0;
      $('reno_' + it.id).value = v > 0 ? v : it.def;
    });
    render();
  }

  function readState() {
    const reno = {};
    RENO_ITEMS.forEach(it => {
      reno[it.id] = $('chk_' + it.id).checked ? Number($('reno_' + it.id).value) || 0 : 0;
    });
    return {
      address: $('f_address').value, price: +$('f_price').value || 0, arv: +$('f_arv').value || 0,
      sqft: +$('f_sqft').value || 0, beds: +$('f_beds').value || 0, baths: +$('f_baths').value || 0,
      tier: $('f_tier').value, loan: +$('f_loan').value || 0, rate: +$('f_rate').value || 0,
      months: +$('f_months').value || 0, monthlyCarrying: +$('f_carry').value || 0,
      buyPct: +$('f_buyPct').value || 0, sellPct: +$('f_sellPct').value || 0, target: +$('f_target').value || 0,
      reno,
    };
  }

  function bar(label, val, max, cls) {
    const w = Math.max(2, Math.min(100, Math.abs(val) / max * 100));
    return `<div class="bar-row"><span class="bar-label">${label}</span>
      <span class="bar-track"><span class="bar-fill ${cls}" style="width:${w}%"></span></span>
      <span class="bar-val">${fmt(val)}</span></div>`;
  }

  function render() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('.reno-name').forEach((el, i) => {
      const it = RENO_ITEMS[i];
      el.innerHTML = `${lang === 'zh' ? it.zh : it.en} <em class="cat">${it.cat}</em>`;
    });
    state = readState();
    const r = compute(state);
    const v = $('verdict');
    v.className = 'verdict ' + r.verdict;
    v.textContent = t('verdict' + r.verdict[0].toUpperCase() + r.verdict.slice(1));
    $('r_maxTarget').textContent = fmt(r.maxBidTarget);
    $('r_maxBE').textContent = fmt(r.maxBidBE);
    $('r_profit').textContent = fmt(r.profit);
    $('r_profit').className = 'big ' + (r.profit >= 0 ? 'pos' : 'neg');
    $('r_spread').textContent = fmt(r.grossSpread);
    $('r_holding').textContent = fmt(r.holding);
    $('r_daily').textContent = fmt(r.dailyBurn) + ' /d';
    $('r_arvSqft').textContent = fmt(r.arvPerSqft);
    $('renoTotal').textContent = fmt(r.renoTotal);
    $('systemShare').textContent = Math.round(r.systemShare * 100) + '%';

    const max = Math.max(state.arv, 1);
    $('bridge').innerHTML =
      bar('ARV', state.arv, max, 'b-pos') +
      bar(lang === 'zh' ? '买入价' : 'Purchase', -state.price, max, 'b-neg') +
      bar(lang === 'zh' ? '装修' : 'Renovation', -r.renoTotal, max, 'b-neg') +
      bar(lang === 'zh' ? '持有+利息' : 'Holding+interest', -r.holding, max, 'b-neg') +
      bar(lang === 'zh' ? '交易成本' : 'Transaction costs', -(r.buyClose + r.sellCost), max, 'b-neg') +
      bar(lang === 'zh' ? '利润' : 'Profit', r.profit, max, r.profit >= 0 ? 'b-pos' : 'b-red');

    const names = { arv: t('sArv'), reno: t('sReno'), hold: t('sHold'), combo: t('sCombo') };
    $('stresses').innerHTML = r.stresses.map(s =>
      `<div class="stress ${s.profit >= 0 ? 'ok' : 'bad'}"><span>${names[s.id]}</span>
       <b>${fmt(s.profit)}</b><em>${s.profit >= 0 ? t('pass') : t('fail')}</em></div>`).join('') +
      `<p class="survived">${t('survived').replace('{n}', r.stressesPassed)}</p>`;

    const warns = [];
    if (r.systemShare > 0.25 && state.tier !== 'lux') warns.push(t('warnSystem'));
    if (r.overpayVsBE > 0) warns.push(t('warnPrice').replace('{x}', fmt(r.overpayVsBE)));
    $('warnings').innerHTML = warns.map(w => `<div class="warn">${w}</div>`).join('');
  }

  /* ----- CSV / JSON handling ----- */
  const CSV_KEYS = ['address','price','arv','sqft','beds','baths','tier','loan','rate','months','monthlyCarrying','buyPct','sellPct','target'];
  function stateToCSV(s) {
    const head = [...CSV_KEYS, ...RENO_ITEMS.map(i => 'reno_' + i.id)];
    const row = [...CSV_KEYS.map(k => k === 'address' || k === 'tier' ? `"${String(s[k]).replace(/"/g, '""')}"` : s[k]),
                 ...RENO_ITEMS.map(i => s.reno[i.id] || 0)];
    return head.join(',') + '\n' + row.join(',') + '\n';
  }
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/); if (lines.length < 2) return null;
    const head = lines[0].split(',').map(h => h.trim());
    const vals = lines[1].match(/("[^"]*"|[^,]+)/g).map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
    const o = {}; head.forEach((h, i) => o[h] = vals[i]); return o;
  }
  function applyImported(o) {
    if (!o) return;
    const s = JSON.parse(JSON.stringify(LILY));
    CSV_KEYS.forEach(k => { if (o[k] !== undefined && o[k] !== '') s[k] = isNaN(+o[k]) ? o[k] : +o[k]; });
    RENO_ITEMS.forEach(it => { const v = o['reno_' + it.id]; if (v !== undefined && v !== '') s.reno[it.id] = +v; });
    if (o.reno && typeof o.reno === 'object') Object.assign(s.reno, o.reno);
    state = s; applyState();
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function reportText() {
    const r = compute(state);
    return `# ${t('reportHead')} — ${state.address}\n${t('generated')}: ${new Date().toLocaleString()}\n\n` +
      `${t('verdict' + r.verdict[0].toUpperCase() + r.verdict.slice(1))}\n` +
      `${t('rMaxTarget')}: ${fmt(r.maxBidTarget)}\n${t('rMaxBE')}: ${fmt(r.maxBidBE)}\n` +
      `${t('rProfit')}: ${fmt(r.profit)}\n${t('renoTotal')}: ${fmt(r.renoTotal)}\n${t('rHolding')}: ${fmt(r.holding)}\n` +
      r.stresses.map(s => `- stress: ${fmt(s.profit)}`).join('\n') + `\n\n${t('disclaimer')}\n`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildRenoRows();
    document.querySelectorAll('input,select').forEach(el => el.addEventListener('input', render));
    $('langBtn').addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem('fliplight-lang', lang); } catch (e) {}
      $('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
      render();
    });
    $('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
    $('btnCase').addEventListener('click', () => { state = JSON.parse(JSON.stringify(LILY)); applyState(); });
    $('btnClear').addEventListener('click', () => {
      state = { address: '', price: 0, arv: 0, sqft: 0, beds: 3, baths: 2, tier: 'mid', loan: 0, rate: 10,
        months: 6, monthlyCarrying: 1000, buyPct: 1, sellPct: 4, target: 100000, reno: {} };
      RENO_ITEMS.forEach(it => state.reno[it.id] = it.def);
      applyState();
    });
    $('btnTemplate').addEventListener('click', () => download('flip-deal-template.csv', stateToCSV(LILY), 'text/csv'));
    $('btnDeal').addEventListener('click', () => download('flip-deal.csv', stateToCSV(state), 'text/csv'));
    $('btnReport').addEventListener('click', () => download('flip-light-report.md', reportText()));
    $('btnPrint').addEventListener('click', () => window.print());
    $('fileData').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { applyImported(f.name.endsWith('.json') ? JSON.parse(rd.result) : parseCSV(rd.result)); }
        catch (err) { alert('Parse error / 解析失败: ' + err.message); }
      };
      rd.readAsText(f);
    });
    $('filePhotos').addEventListener('change', e => {
      const grid = $('photoGrid');
      [...e.target.files].forEach(f => {
        if (f.type.startsWith('image/')) {
          const img = document.createElement('img'); img.src = URL.createObjectURL(f); grid.appendChild(img);
        } else {
          const d = document.createElement('div'); d.className = 'file-chip'; d.textContent = '📄 ' + f.name; grid.appendChild(d);
        }
      });
      $('photosSec').style.display = 'block';
    });
    applyState();
  });
}
