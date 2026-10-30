/* Flip Light v2 — Pre-Purchase Deal Check / 买入前红绿灯
   Pure client-side underwriting model. No data leaves the browser.
   v2 adds MARKET PROFILES: the math skeleton is universal; each region ships
   its own parameters (cost defaults, stress sizes, system-cost threshold,
   target-profit mode). An agent's own deal history should override the pack.
*/
'use strict';

/* ---------------- Renovation catalogue (base prices = Bay Area mid-market) ---------------- */
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

/* ---------------- Market profiles (区域参数包) ---------------- */
const PROFILES = {
  lux:     { zh: 'Palo Alto / 半岛豪宅', en: 'Palo Alto / Peninsula Luxury', sellPct: 5, buyPct: 1, months: 10, renoMult: 1.40, sysThreshold: 0.40, arvDrop: 0.08, renoUp: 0.20, extraMonths: 4, targetMode: 'pct', targetPct: 9 },
  mid:     { zh: 'San Jose 中端',        en: 'San Jose Mid-Market',          sellPct: 4, buyPct: 1, months: 6,  renoMult: 1.00, sysThreshold: 0.25, arvDrop: 0.05, renoUp: 0.20, extraMonths: 3, targetMode: 'usd', targetPct: 9 },
  eastbay: { zh: '东湾量贩市场',          en: 'East Bay Volume Market',       sellPct: 4, buyPct: 1, months: 6,  renoMult: 0.95, sysThreshold: 0.25, arvDrop: 0.05, renoUp: 0.20, extraMonths: 3, targetMode: 'usd', targetPct: 9 },
  generic: { zh: '美国通用',              en: 'US Generic',                   sellPct: 5, buyPct: 1, months: 6,  renoMult: 0.80, sysThreshold: 0.30, arvDrop: 0.05, renoUp: 0.20, extraMonths: 3, targetMode: 'pct', targetPct: 8 },
};

/* ---------------- Case study preset: 155 Lily Blossom Ct ---------------- */
const LILY = {
  address: '155 Lily Blossom Ct, San Jose, CA 95123', profile: 'mid',
  price: 1160000, arv: 1400000, arvLow: 1330000, arvHigh: 1470000,
  sqft: 1782, beds: 4, baths: 2,
  loan: 1000000, rate: 10.5, months: 5.6, monthlyCarrying: 1100,
  buyPct: 1, sellPct: 4, target: 100000, targetMode: 'usd', targetPct: 9,
  reno: { roof: 18000, rewire: 16000, replumb: 12000, hvac: 14000, windows: 18000,
          kitchen: 48000, baths: 38000, flooring: 13000, paint: 10000, doors: 8000,
          deck: 15000, landscaping: 20000, misc: 5000 },
};

/* ---------------- Core algorithm (pure, testable) ---------------- */
function compute(inp) {
  const P = PROFILES[inp.profile] || PROFILES.mid;
  const renoTotal = RENO_ITEMS.reduce((s, it) => s + (Number(inp.reno[it.id]) || 0), 0);
  const systemCost = RENO_ITEMS.filter(i => i.cat === 'system')
    .reduce((s, it) => s + (Number(inp.reno[it.id]) || 0), 0);
  const interest = (x, months) => x.loan * (x.rate / 100) * (months / 12);
  const holdingFor = (x, months) => interest(x, months) + x.monthlyCarrying * months;

  const holding = holdingFor(inp, inp.months);
  const buyClose = inp.price * inp.buyPct / 100;
  const targetEff = inp.targetMode === 'pct' ? inp.arv * (inp.targetPct || 0) / 100 : (inp.target || 0);

  const profitAt = (arv, renoMul, extraMonths) => {
    const h = holdingFor(inp, inp.months + extraMonths);
    return arv - inp.price - renoTotal * (renoMul || 1) - buyClose - h - arv * inp.sellPct / 100;
  };
  const sellCost = inp.arv * inp.sellPct / 100;
  const profit = profitAt(inp.arv, 1, 0);

  // Reverse max-bid (holding held constant at entered loan terms)
  const maxBidTarget = (inp.arv - renoTotal - holding - sellCost - targetEff) / (1 + inp.buyPct / 100);
  const maxBidBE = (inp.arv - renoTotal - holding - sellCost) / (1 + inp.buyPct / 100);

  const stresses = [
    { id: 'arv',   profit: profitAt(inp.arv * (1 - P.arvDrop), 1, 0) },
    { id: 'reno',  profit: profitAt(inp.arv, 1 + P.renoUp, 0) },
    { id: 'hold',  profit: profitAt(inp.arv, 1, P.extraMonths) },
    { id: 'combo', profit: profitAt(inp.arv * (1 - P.arvDrop), 1 + P.renoUp, P.extraMonths) },
  ];
  const stressesPassed = stresses.filter(s => s.profit >= 0).length;

  const arvLow = inp.arvLow > 0 ? inp.arvLow : inp.arv * 0.95;
  const arvHigh = inp.arvHigh > 0 ? inp.arvHigh : inp.arv * 1.05;
  const scenarios = [
    { id: 'low', arv: arvLow, profit: profitAt(arvLow, 1, 0) },
    { id: 'base', arv: inp.arv, profit },
    { id: 'high', arv: arvHigh, profit: profitAt(arvHigh, 1, 0) },
  ];

  let verdict = 'red';
  if (inp.price <= maxBidTarget) verdict = 'green';
  else if (inp.price <= maxBidBE) verdict = 'yellow';

  return {
    profile: P, renoTotal, systemCost,
    systemShare: renoTotal > 0 ? systemCost / renoTotal : 0,
    interest: interest(inp, inp.months), holding,
    buyClose, sellCost, profit, targetEff,
    grossSpread: inp.arv - inp.price,
    maxBidTarget, maxBidBE,
    overpayVsBE: inp.price - maxBidBE,
    dailyBurn: inp.loan * (inp.rate / 100) / 365 + inp.monthlyCarrying / 30.4,
    arvPerSqft: inp.sqft > 0 ? inp.arv / inp.sqft : 0,
    stresses, stressesPassed, scenarios, verdict,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { compute, RENO_ITEMS, PROFILES, LILY };
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
    secProperty: '房屋与区域', secDeal: '交易数字', secReno: '装修清单（勾选并可改价）', secFinance: '资金与持有',
    address: '地址', price: '买入价 / 要价 ($)', arv: '预估售价 ARV · 基准 ($)',
    arvLow: 'ARV · 保守（可空 = 基准 −5%）', arvHigh: 'ARV · 乐观（可空 = 基准 +5%）', sqft: '面积 (sq ft)',
    beds: '卧室', baths: '卫浴', profile: '区域参数包',
    profileNote: '切换区域包会套用该区的默认成本、压力幅度和目标口径，并按系数重置装修单价 — 之后仍可逐项手改。经纪人自己的真实数字永远优先于参数包。',
    loan: '贷款金额 ($)', rate: '年利率 (%)', months: '预计持有 (月)', monthlyCarrying: '每月持有杂费 ($ 税/保险/水电)',
    buyPct: '买入过户费 (%)', sellPct: '卖出成本 (%)', target: '目标利润 ($)',
    targetMode: '目标利润口径', tmUsd: '固定金额 $', tmPct: '占售价 %', targetPct: '目标利润占 ARV (%)',
    renoTotal: '装修合计', systemShare: '其中看不见的系统项占比',
    verdictGreen: '🟢 绿灯 — 可以买', verdictYellow: '🟡 黄灯 — 只有降价或砍装修才行', verdictRed: '🔴 红灯 — 不要买',
    rMaxTarget: '最高可买价（留目标利润）', rMaxBE: '保本最高价（利润 = 0）', rProfit: '按当前买价的预计利润',
    rSpread: '毛差价（ARV − 买价）', rHolding: '持有成本（含利息）', rDaily: '每天烧钱', rArvSqft: 'ARV 每尺价',
    bridgeTitle: '利润桥（钱去哪了）', stressTitle: '压力测试（单子有多脆）', scenTitle: '三种售价情形',
    scenLow: '保守售价', scenBase: '基准售价', scenHigh: '乐观售价',
    sArv: '售价下跌', sReno: '装修超支 20%', sHold: '多持有', sCombo: '三项一起来', monthsUnit: '个月',
    pass: '扛得住', fail: '击穿', survived: '4 项压力测试扛住了 {n} 项 — 纪律要求：至少扛住前 3 项里的 2 项',
    warnSystem: '⚠️ 系统项（屋顶/电线/水管/HVAC）占比超过本区域包的警戒线（{th}%）：这类钱买家看不见，在这个市场多半收不回来 — 考虑砍到「必修 + 看得见」的版本。',
    warnPrice: '⚠️ 买价已高出保本线 {x}：哪怕一切顺利，这单也注定亏。',
    warnHigh: '⚠️ 连乐观售价情形都是亏的：这不是定价问题，是买价问题 — 只有卖家降价才有解。',
    howTitle: '算法怎么算的', howBody: '公式全国通用：利润 = ARV − 买价 − 装修 − 交易成本 − 持有利息 − 目标利润，再倒算最高可买价，并做压力测试。随地区变的不是公式，是参数 — 区域参数包预置了各地的装修单价系数、卖出成本、系统项警戒线、压力幅度和目标利润口径；经纪人用自己历史成交的真实数字覆盖默认值后，这本账就变成他自己的。AI 不找房、不谈判、不判断客户信任 — 那些是经纪人的活。',
    photosTitle: '已上传的资料（仅在本机浏览器中）', disclaimer: '原型工具：数字为估算，区域参数包为可调默认值，不构成投资建议。税费与成交请以 escrow 正式文件为准。',
    reportHead: '买入前红绿灯报告', generated: '生成时间',
  },
  en: {
    title: 'Flip Light', subtitle: 'Pre-Purchase Deal Check · 买入前决策报告',
    tagline: 'AI does not replace the agent — it is the brake and the ledger. Compute the max bid BEFORE you sign.',
    loadCase: 'Load case study: 155 Lily Blossom (San Jose)', clear: 'Clear / New deal',
    uploadData: 'Upload data (CSV / JSON)', uploadPhotos: 'Upload photos / files',
    uploadNote: 'Files are read only inside your own browser — nothing is sent to any server.',
    downloadTemplate: 'Download data template CSV', downloadDeal: 'Download this deal CSV', downloadReport: 'Download report', print: 'Print / Save PDF',
    secProperty: 'Property & Market', secDeal: 'Deal numbers', secReno: 'Renovation scope (tick & edit prices)', secFinance: 'Financing & holding',
    address: 'Address', price: 'Purchase price / Ask ($)', arv: 'Expected sale price, ARV · base ($)',
    arvLow: 'ARV · conservative (blank = base −5%)', arvHigh: 'ARV · optimistic (blank = base +5%)', sqft: 'Living area (sq ft)',
    beds: 'Beds', baths: 'Baths', profile: 'Market profile',
    profileNote: 'Switching the profile applies that market\'s default costs, stress sizes and target mode, and rescales renovation unit prices — every field stays editable afterwards. The agent\'s own real numbers always override the pack.',
    loan: 'Loan amount ($)', rate: 'Annual rate (%)', months: 'Planned hold (months)', monthlyCarrying: 'Monthly carrying ($ tax/ins/util)',
    buyPct: 'Buy closing costs (%)', sellPct: 'Sell-side costs (%)', target: 'Target profit ($)',
    targetMode: 'Target profit mode', tmUsd: 'Fixed $ amount', tmPct: '% of ARV', targetPct: 'Target profit (% of ARV)',
    renoTotal: 'Renovation total', systemShare: 'of which invisible systems',
    verdictGreen: '🟢 GREEN — Buy', verdictYellow: '🟡 YELLOW — Only at a lower price or leaner scope', verdictRed: '🔴 RED — Walk away',
    rMaxTarget: 'Max bid (keeps target profit)', rMaxBE: 'Max bid (break-even)', rProfit: 'Projected profit at current price',
    rSpread: 'Gross spread (ARV − price)', rHolding: 'Holding cost (incl. interest)', rDaily: 'Daily burn', rArvSqft: 'ARV per sq ft',
    bridgeTitle: 'Profit bridge (where the money goes)', stressTitle: 'Stress tests (how fragile is this deal?)', scenTitle: 'Three sale-price scenarios',
    scenLow: 'Conservative', scenBase: 'Base', scenHigh: 'Optimistic',
    sArv: 'Sale price drop', sReno: 'Renovation +20%', sHold: 'Hold extra', sCombo: 'All three at once', monthsUnit: 'months',
    pass: 'Survives', fail: 'Breaks', survived: 'Survived {n} of 4 stress tests — house rule: must survive at least 2 of the first 3',
    warnSystem: '⚠️ Invisible systems (roof / wiring / plumbing / HVAC) exceed this market profile\'s warning line ({th}%): buyers cannot see this money and in this market most of it is not recovered — consider a "must-fix + visible" scope.',
    warnPrice: '⚠️ The price is already {x} above the break-even line: even if everything goes right, this deal is born losing.',
    warnHigh: '⚠️ Even the optimistic sale-price scenario loses money: this is not a pricing problem, it is a purchase-price problem — only a seller price cut fixes it.',
    howTitle: 'How the algorithm works', howBody: 'The formula is universal: profit = ARV − price − renovation − transaction costs − holding interest − target profit, solved backwards for the max bid, then stress-tested. What changes by market is not the formula but the parameters — each market profile presets renovation unit-cost multipliers, sell-side costs, the systems warning line, stress sizes and the target-profit mode; once the agent overrides defaults with real numbers from their own closed deals, the ledger becomes theirs. The AI does not source homes, negotiate, or judge client trust — that stays with the agent.',
    photosTitle: 'Uploaded materials (in this browser only)', disclaimer: 'Prototype tool: figures are estimates and market profiles are adjustable defaults, not investment advice. Rely on formal escrow documents for taxes and closing.',
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
  function buildProfileOptions() {
    const sel = $('f_profile'); const cur = sel.value || state.profile || 'mid';
    sel.innerHTML = '';
    Object.entries(PROFILES).forEach(([id, p]) => {
      const o = document.createElement('option');
      o.value = id; o.textContent = lang === 'zh' ? p.zh : p.en; sel.appendChild(o);
    });
    sel.value = PROFILES[cur] ? cur : 'mid';
  }

  function applyState() {
    $('f_address').value = state.address; $('f_profile').value = state.profile || 'mid';
    $('f_price').value = state.price; $('f_arv').value = state.arv;
    $('f_arvLow').value = state.arvLow || ''; $('f_arvHigh').value = state.arvHigh || '';
    $('f_sqft').value = state.sqft; $('f_beds').value = state.beds; $('f_baths').value = state.baths;
    $('f_loan').value = state.loan; $('f_rate').value = state.rate; $('f_months').value = state.months;
    $('f_carry').value = state.monthlyCarrying; $('f_buyPct').value = state.buyPct;
    $('f_sellPct').value = state.sellPct; $('f_target').value = state.target;
    $('f_targetMode').value = state.targetMode || 'usd'; $('f_targetPct').value = state.targetPct || 9;
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
      address: $('f_address').value, profile: $('f_profile').value,
      price: +$('f_price').value || 0, arv: +$('f_arv').value || 0,
      arvLow: +$('f_arvLow').value || 0, arvHigh: +$('f_arvHigh').value || 0,
      sqft: +$('f_sqft').value || 0, beds: +$('f_beds').value || 0, baths: +$('f_baths').value || 0,
      loan: +$('f_loan').value || 0, rate: +$('f_rate').value || 0,
      months: +$('f_months').value || 0, monthlyCarrying: +$('f_carry').value || 0,
      buyPct: +$('f_buyPct').value || 0, sellPct: +$('f_sellPct').value || 0,
      target: +$('f_target').value || 0, targetMode: $('f_targetMode').value,
      targetPct: +$('f_targetPct').value || 0, reno,
    };
  }

  function applyProfile() {
    const P = PROFILES[$('f_profile').value] || PROFILES.mid;
    $('f_sellPct').value = P.sellPct; $('f_buyPct').value = P.buyPct; $('f_months').value = P.months;
    $('f_targetMode').value = P.targetMode; $('f_targetPct').value = P.targetPct;
    RENO_ITEMS.forEach(it => {
      $('reno_' + it.id).value = Math.round(it.def * P.renoMult / 500) * 500;
    });
    render();
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

    const scenNames = { low: t('scenLow'), base: t('scenBase'), high: t('scenHigh') };
    $('scenarios').innerHTML = r.scenarios.map(s =>
      `<div class="stress ${s.profit >= 0 ? 'ok' : 'bad'}"><span>${scenNames[s.id]} · ${fmt(s.arv)}</span><b>${fmt(s.profit)}</b></div>`).join('');

    const max = Math.max(state.arv, 1);
    $('bridge').innerHTML =
      bar('ARV', state.arv, max, 'b-pos') +
      bar(lang === 'zh' ? '买入价' : 'Purchase', -state.price, max, 'b-neg') +
      bar(lang === 'zh' ? '装修' : 'Renovation', -r.renoTotal, max, 'b-neg') +
      bar(lang === 'zh' ? '持有+利息' : 'Holding+interest', -r.holding, max, 'b-neg') +
      bar(lang === 'zh' ? '交易成本' : 'Transaction costs', -(r.buyClose + r.sellCost), max, 'b-neg') +
      bar(lang === 'zh' ? '利润' : 'Profit', r.profit, max, r.profit >= 0 ? 'b-pos' : 'b-red');

    const P = r.profile;
    const names = {
      arv: `${t('sArv')} −${Math.round(P.arvDrop * 100)}%`,
      reno: t('sReno'), hold: `${t('sHold')} +${P.extraMonths} ${t('monthsUnit')}`, combo: t('sCombo'),
    };
    $('stresses').innerHTML = r.stresses.map(s =>
      `<div class="stress ${s.profit >= 0 ? 'ok' : 'bad'}"><span>${names[s.id]}</span>
       <b>${fmt(s.profit)}</b><em>${s.profit >= 0 ? t('pass') : t('fail')}</em></div>`).join('') +
      `<p class="survived">${t('survived').replace('{n}', r.stressesPassed)}</p>`;

    const warns = [];
    if (r.systemShare > P.sysThreshold) warns.push(t('warnSystem').replace('{th}', Math.round(P.sysThreshold * 100)));
    if (r.overpayVsBE > 0) warns.push(t('warnPrice').replace('{x}', fmt(r.overpayVsBE)));
    if (r.scenarios[2].profit < 0) warns.push(t('warnHigh'));
    $('warnings').innerHTML = warns.map(w => `<div class="warn">${w}</div>`).join('');
  }

  /* ----- CSV / JSON handling ----- */
  const CSV_KEYS = ['address','profile','price','arv','arvLow','arvHigh','sqft','beds','baths','loan','rate','months','monthlyCarrying','buyPct','sellPct','target','targetMode','targetPct'];
  const TEXT_KEYS = ['address','profile','targetMode'];
  function stateToCSV(s) {
    const head = [...CSV_KEYS, ...RENO_ITEMS.map(i => 'reno_' + i.id)];
    const row = [...CSV_KEYS.map(k => TEXT_KEYS.includes(k) ? `"${String(s[k] ?? '').replace(/"/g, '""')}"` : (s[k] ?? 0)),
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
    CSV_KEYS.forEach(k => { if (o[k] !== undefined && o[k] !== '') s[k] = TEXT_KEYS.includes(k) ? o[k] : +o[k]; });
    if (!PROFILES[s.profile]) s.profile = 'mid';
    RENO_ITEMS.forEach(it => { const val = o['reno_' + it.id]; if (val !== undefined && val !== '') s.reno[it.id] = +val; });
    if (o.reno && typeof o.reno === 'object') Object.assign(s.reno, o.reno);
    state = s; buildProfileOptions(); applyState();
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function reportText() {
    const r = compute(state);
    const P = r.profile;
    return `# ${t('reportHead')} — ${state.address}\n${t('generated')}: ${new Date().toLocaleString()}\n` +
      `${t('profile')}: ${lang === 'zh' ? P.zh : P.en}\n\n` +
      `${t('verdict' + r.verdict[0].toUpperCase() + r.verdict.slice(1))}\n` +
      `${t('rMaxTarget')}: ${fmt(r.maxBidTarget)}\n${t('rMaxBE')}: ${fmt(r.maxBidBE)}\n` +
      `${t('rProfit')}: ${fmt(r.profit)}\n${t('renoTotal')}: ${fmt(r.renoTotal)}\n${t('rHolding')}: ${fmt(r.holding)}\n` +
      r.scenarios.map(s => `- scenario ${s.id}: ARV ${fmt(s.arv)} → ${fmt(s.profit)}`).join('\n') + '\n' +
      r.stresses.map(s => `- stress ${s.id}: ${fmt(s.profit)}`).join('\n') + `\n\n${t('disclaimer')}\n`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildRenoRows(); buildProfileOptions();
    document.querySelectorAll('input,select').forEach(el => el.addEventListener('input', render));
    $('f_profile').addEventListener('change', applyProfile);
    $('langBtn').addEventListener('click', () => {
      lang = lang === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem('fliplight-lang', lang); } catch (e) {}
      $('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
      buildProfileOptions(); render();
    });
    $('langBtn').textContent = lang === 'zh' ? 'EN' : '中文';
    $('btnCase').addEventListener('click', () => { state = JSON.parse(JSON.stringify(LILY)); buildProfileOptions(); applyState(); });
    $('btnClear').addEventListener('click', () => {
      state = { address: '', profile: $('f_profile').value || 'mid', price: 0, arv: 0, arvLow: 0, arvHigh: 0, sqft: 0, beds: 3, baths: 2,
        loan: 0, rate: 10, months: 6, monthlyCarrying: 1000, buyPct: 1, sellPct: 4, target: 100000,
        targetMode: 'usd', targetPct: 9, reno: {} };
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
