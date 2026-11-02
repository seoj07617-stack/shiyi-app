/* 拾壹工作台
   静态页，没有后端。真实数据替换这些 JSON，页面只读它们：
   learning.json         教学助理 08:00 / 20:30。只展示，不排课。
   news.json             生态简报 A/B/C，体育 D 默认折叠。market 只给纪律备忘。
   github_trending.json  scripts/update_trending.py 每天覆盖，字段不要改。
   feishu.json           飞书摘要。链接换成真实云盘 / 会话 / aily。
   health.json           素问周 PDF、Hevy 当日、晨重蛋白睡眠补剂自报。
   workout.json          体态备注只读，不在这里改处方。
   todos.json            拍板与待办。cat=投资 不进主清单。
   bots.json             三个机器人的心跳。
   progress.json         地图底部的共事记录。
   ai-insights.json      纪律备忘里的规则摘要。
   stock-data.json       纪律备忘只读价格和规则，不展示份额细账。
   勾选、蛋白加量和晨重修正记在 localStorage（shiyi-command-v1），不写回 JSON。
*/
(function () {
  const STATE_KEY = 'shiyi-command-v1';
  const FILES = {
    news: 'news.json',
    trending: 'github_trending.json',
    insights: 'ai-insights.json',
    workout: 'workout.json',
    todos: 'todos.json',
    progress: 'progress.json',
    learning: 'learning.json',
    health: 'health.json',
    feishu: 'feishu.json',
    bots: 'bots.json',
    stocks: 'stock-data.json'
  };
  const NAV = [
    ['today', '今日', 'sun'],
    ['learn', '学习', 'book'],
    ['news', '新闻', 'spark'],
    ['oss', '开源', 'git'],
    ['feishu', '飞书', 'send'],
    ['health', '健康', 'heart'],
    ['decide', '拍板', 'check'],
    ['bots', '地图', 'nodes']
  ];
  const TITLES = {
    today: '今日', learn: '学习', news: '新闻', oss: '开源',
    feishu: '飞书', health: '健康', decide: '拍板', bots: '地图', memo: '纪律备忘'
  };
  const WHO = { teacher: '教学助理', shiyi: '拾壹', suwen: '素问' };
  const ICON = {
    sun: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.6v2M12 18.4v2M3.6 12h2M18.4 12h2M6.1 6.1l1.4 1.4M16.5 16.5l1.4 1.4M17.9 6.1l-1.4 1.4M7.5 16.5l-1.4 1.4"/>',
    book: '<path d="M5 5.2A2 2 0 0 1 7 3.2h11.2V18.2H7a2 2 0 0 0-2 2z"/><path d="M5 18.6A2 2 0 0 1 7 16.6h11.2"/><path d="M8.2 7.6h6.2"/>',
    spark: '<path d="M12 3.2l1.5 4.8L18.2 9.5l-4.7 1.5L12 15.8l-1.5-4.8L5.8 9.5l4.7-1.5z"/><path d="M17.6 14.2l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z"/>',
    git: '<circle cx="6.2" cy="6.4" r="2.1"/><circle cx="6.2" cy="17.6" r="2.1"/><circle cx="17.4" cy="12" r="2.1"/><path d="M6.2 8.5v6.9M8.2 7.3l7 3.3M8.2 16.7l7-3.3"/>',
    send: '<path d="M4 11.8L20 4.8l-6.2 14.2-2.2-6.2z"/><path d="M11.6 12.8L20 4.8"/>',
    heart: '<path d="M12 19.2s-6.6-4-6.6-8a3.4 3.4 0 0 1 6.6-1 3.4 3.4 0 0 1 6.6 1c0 4-6.6 8-6.6 8z"/>',
    check: '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="4"/><path d="M8 12.2l2.5 2.5L16.2 9.2"/>',
    nodes: '<circle cx="6" cy="12" r="2.2"/><circle cx="17.2" cy="6.4" r="2.2"/><circle cx="17.2" cy="17.6" r="2.2"/><path d="M8.1 11.2l6.8-3.6M8.1 12.8l6.8 3.6"/>'
  };

  const shell = document.body.dataset.shell === 'desktop' ? 'desktop' : 'mobile';
  let data = {};
  let state = null;
  let tab = 'today';
  let built = false;
  let sportsOpen = false;
  let ossCat = '全部';
  let deferredPrompt = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
  }
  function safeUrl(url) {
    return /^https:\/\//i.test(String(url || '')) ? esc(url) : '#';
  }
  function linkBtn(url, label, cls) {
    return '<a class="' + cls + '" href="' + safeUrl(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  }
  function signed(n, digits) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    const body = Math.abs(v).toFixed(digits);
    if (v > 0) return '+' + body;
    if (v < 0) return '−' + body;
    return Number(0).toFixed(digits);
  }
  function deltaClass(n) {
    if (n < -0.001) return 'down';
    if (n > 0.001) return 'up';
    return 'flat';
  }
  function shanghaiParts(date) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    });
    const bag = {};
    fmt.formatToParts(date).forEach(function (part) { bag[part.type] = part.value; });
    return {
      year: Number(bag.year), month: Number(bag.month), day: Number(bag.day),
      hour: Number(bag.hour), minute: Number(bag.minute), second: Number(bag.second)
    };
  }
  function isoOf(p) {
    return p.year + '-' + String(p.month).padStart(2, '0') + '-' + String(p.day).padStart(2, '0');
  }
  function dateLabel(p, compact) {
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    const idx = new Date(Date.UTC(p.year, p.month - 1, p.day, 4, 0, 0)).getUTCDay();
    const week = '周' + names[idx];
    if (compact) return p.month + '月' + p.day + '日 ' + week;
    return p.year + '年' + p.month + '月' + p.day + '日 ' + week;
  }
  function clockLabel(p) {
    return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0');
  }
  function greet(hour) {
    if (hour < 5) return '夜深了';
    if (hour < 11) return '早上好';
    if (hour < 14) return '中午好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }
  function fmtDur(total) {
    const s = Math.max(0, total | 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const z = function (n) { return String(n).padStart(2, '0'); };
    return z(h) + ':' + z(m) + ':' + z(sec);
  }
  function bedtime(p) {
    const secs = p.hour * 3600 + p.minute * 60 + p.second;
    if (p.hour < 5) {
      return { tone: 'late', label: '已过零点', clock: fmtDur(secs), copy: '已经过了今天的入睡线。屏幕先放下，早报 08:00 再看。' };
    }
    const soon = p.hour >= 22;
    return {
      tone: soon ? 'soon' : 'calm',
      label: '距零点',
      clock: fmtDur(24 * 3600 - secs),
      copy: soon ? '快到零点了，今晚在 00:00 前入睡。' : '今晚在 00:00 前入睡。'
    };
  }
  function whenLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const p = shanghaiParts(d);
    const now = shanghaiParts(new Date());
    const hm = clockLabel(p);
    if (isoOf(p) === isoOf(now)) return '今天 ' + hm;
    return p.month + '月' + p.day + '日 ' + hm;
  }
  function dueLabel(due) {
    if (!due) return '';
    if (due === isoOf(shanghaiParts(new Date()))) return '今天';
    return due.slice(5);
  }
  function toneClass(status) {
    if (status === '已完成' || status === 'ok') return 'ok';
    if (status === '已退回' || status === '需留意') return 'bad';
    if (status === '进行中' || status === '待拍板') return 'wait';
    return 'dim';
  }
  function dotClass(stateName) {
    if (stateName === 'attention' || stateName === 'wait') return 'wait';
    if (stateName === 'off') return 'off';
    return '';
  }

  function loadState() {
    const base = {
      todoDone: {}, decision: {}, learnDone: null, sessionDone: null,
      discomfort: null, proteinAdd: 0, weight: null, supplements: {}
    };
    try {
      const raw = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return {
        todoDone: Object.assign({}, raw.todoDone || {}),
        decision: Object.assign({}, raw.decision || {}),
        learnDone: raw.learnDone == null ? null : !!raw.learnDone,
        sessionDone: raw.sessionDone == null ? null : !!raw.sessionDone,
        discomfort: raw.discomfort || null,
        proteinAdd: Number(raw.proteinAdd) || 0,
        weight: raw.weight == null ? null : Number(raw.weight),
        supplements: Object.assign({}, raw.supplements || {})
      };
    } catch (e) {
      return base;
    }
  }
  function save() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* 私密模式可能拒绝写入 */ }
  }
  function allTodos() { return arr(data.todos && data.todos.items); }
  function isTodoDone(t) {
    if (state.todoDone[t.id] != null) return !!state.todoDone[t.id];
    return !!t.done;
  }
  function decisionRes(t) { return state.decision[t.id] || null; }
  function isDecisionClosed(t) {
    const res = decisionRes(t);
    if (res === 'yes' || res === 'no') return true;
    if (res === 'later') return false;
    return isTodoDone(t);
  }
  function openDecisions() {
    return allTodos().filter(function (t) {
      return t.kind === 'decision' && t.cat !== '投资' && !isDecisionClosed(t) && decisionRes(t) !== 'later';
    });
  }
  function laterDecisions() {
    return allTodos().filter(function (t) { return t.kind === 'decision' && decisionRes(t) === 'later'; });
  }
  function openTodos() {
    return allTodos().filter(function (t) { return t.kind !== 'decision' && t.cat !== '投资' && !isTodoDone(t); });
  }
  function closedItems() {
    return allTodos().filter(function (t) {
      if (t.cat === '投资') return false;
      return t.kind === 'decision' ? isDecisionClosed(t) : isTodoDone(t);
    });
  }
  function investTodos() {
    return allTodos().filter(function (t) { return t.cat === '投资'; });
  }
  function isLearnDone() {
    if (state.learnDone == null) return !!(data.learning && data.learning.today && data.learning.today.done);
    return !!state.learnDone;
  }
  function isSessionDone() {
    if (state.sessionDone == null) return !!(data.health && data.health.today && data.health.today.done);
    return !!state.sessionDone;
  }
  function weekDoneCount() {
    const base = Number(data.learning && data.learning.progress && data.learning.progress.done) || 0;
    const jsonDone = !!(data.learning && data.learning.today && data.learning.today.done);
    const now = isLearnDone();
    if (now && !jsonDone) return base + 1;
    if (!now && jsonDone) return Math.max(0, base - 1);
    return base;
  }
  function proteinGrams() {
    const base = Number(data.health && data.health.protein && data.health.protein.grams) || 0;
    return base + (Number(state.proteinAdd) || 0);
  }
  function weightPoints() {
    const pts = arr(data.health && data.health.weight && data.health.weight.points).map(function (p) {
      return { date: p.date, kg: Number(p.kg) };
    });
    if (state.weight != null && pts.length) pts[pts.length - 1].kg = Number(state.weight);
    return pts;
  }
  function weightStats() {
    const pts = weightPoints();
    if (pts.length < 2) return null;
    const last = pts[pts.length - 1].kg;
    const prev = pts[pts.length - 2].kg;
    const first = pts[0].kg;
    return { pts: pts, last: last, day: last - prev, week: last - first, goal: data.health.weight.goal };
  }
  function suppOn(item) {
    if (state.supplements[item.id] != null) return !!state.supplements[item.id];
    return !!item.done;
  }
  function discomfort() {
    return state.discomfort || (data.health && data.health.today && data.health.today.discomfort) || '无';
  }
  function botLive(bot) {
    if (bot.id === 'shiyi') {
      const n = openDecisions().length;
      return { status: n ? n + ' 件待拍板' : '今日已清空', state: n ? 'attention' : 'online' };
    }
    return { status: bot.status, state: bot.state || 'online' };
  }
  function top3() {
    const items = [];
    const today = data.learning && data.learning.today;
    if (today) {
      items.push({ tab: 'learn', kicker: '学习', title: today.learn, meta: (today.minutes || 0) + ' 分钟', done: isLearnDone() });
    }
    const session = data.health && data.health.today;
    if (session && session.hasTraining) {
      items.push({
        tab: 'health',
        kicker: '训练',
        title: session.title,
        meta: arr(session.parts).join(' · ') + (session.footballEvening ? ' · 足球晚训' : ''),
        done: isSessionDone()
      });
    }
    const dec = openDecisions()[0];
    if (dec) items.push({ tab: 'decide', kicker: '拍板', title: dec.text, meta: dec.ask || '', done: false });
    openTodos().forEach(function (t) {
      items.push({ tab: 'decide', kicker: '待办', title: t.text, meta: dueLabel(t.due) || t.cat, done: false });
    });
    return items.filter(function (i) { return !i.done; }).concat(items.filter(function (i) { return i.done; })).slice(0, 3);
  }

  function head(eye, title, lede) {
    return '<header class="page-head"><p class="eyebrow">' + esc(eye) + '</p><h1>' + esc(title) + '</h1>' +
      (lede ? '<p class="lede">' + esc(lede) + '</p>' : '') + '</header>';
  }
  function empty(title, copy) {
    return '<section class="glass empty"><h2>' + esc(title) + '</h2><p class="card-copy">' + esc(copy) + '</p></section>';
  }

  function renderToday() {
    const p = shanghaiParts(new Date());
    const bed = bedtime(p);
    const items = top3();
    const focus = items.length ? items.map(function (item, i) {
      return '<button type="button" class="focus' + (item.done ? ' done' : '') + '" data-go="' + item.tab + '">' +
        '<span class="idx">' + (i + 1) + '</span><span class="grow"><small>' + esc(item.kicker) + '</small>' +
        '<strong>' + esc(item.title) + '</strong><em>' + esc(item.meta) + '</em></span>' +
        (item.done ? '<span class="tick">完成</span>' : '') + '</button>';
    }).join('') : '<p class="card-copy">今天还没有排进三件事。</p>';
    const allDone = items.length > 0 && items.every(function (i) { return i.done; });
    const bots = arr(data.bots && data.bots.bots);
    const chips = bots.length ? bots.map(function (bot) {
      const live = botLive(bot);
      return '<button type="button" class="chip-bot" data-go="bots"><i class="dot ' + dotClass(live.state) + '"></i><strong>' +
        esc(bot.name) + '</strong><span>' + esc(live.status) + '</span></button>';
    }).join('') : '<p class="card-copy">机器人状态还没到。</p>';
    const grams = proteinGrams();
    const protein = data.health && data.health.protein;
    const w = weightStats();
    const latest = arr(data.feishu && data.feishu.deliveries)[0];
    const glances = [
      ['learn', '学习', (data.learning && data.learning.today && data.learning.today.learn) || '今日任务未到',
        data.learning ? ((isLearnDone() ? '已完成 · ' : '') + (data.learning.today.minutes || 0) + ' 分钟') : '等待早报'],
      ['health', '健康', (data.health && data.health.today && data.health.today.title) || '今日训练未到',
        protein ? ('蛋白 ' + grams + ' / ' + protein.low + '–' + protein.high + (w ? ' · 晨重 ' + signed(w.day, 1) : '')) : '等待素问'],
      ['feishu', '飞书', latest ? latest.title : '还没有新交付', latest ? whenLabel(latest.time) : '打开飞书看正文'],
      ['decide', '拍板', openDecisions().length ? openDecisions().length + ' 件等你点头' : '没有待拍板',
        openDecisions()[0] ? openDecisions()[0].ask : '主清单是空的']
    ].map(function (g) {
      return '<button type="button" class="glance glass" data-go="' + g[0] + '"><small>' + esc(g[1]) + '</small><strong>' +
        esc(g[2]) + '</strong><span>' + esc(g[3]) + '</span></button>';
    }).join('');
    return head('今日', greet(p.hour) + '，君', '零点前入睡。下面三件事，和三个机器人的状态。') +
      '<div class="today">' +
      '<section class="hero glass" id="bedHero" data-tone="' + bed.tone + '">' +
      '<div class="hero-main"><p class="eyebrow">入睡提醒</p><div class="hero-target">00:00</div>' +
      '<p class="hero-copy" id="bedCopy">' + esc(bed.copy) + '</p></div>' +
      '<div class="hero-side"><div class="hero-count" id="bedClock">' + esc(bed.clock) + '</div>' +
      '<div class="hero-label" id="bedLabel">' + esc(bed.label) + '</div></div></section>' +
      '<section class="glass"><p class="card-kicker">今天的三件事</p><div class="focus-list">' + focus + '</div>' +
      (allDone ? '<p class="footnote">这三件都有着落。</p>' : '') + '</section>' +
      '<section class="glass"><p class="card-kicker">机器人</p><div class="bot-row">' + chips + '</div></section>' +
      '<div class="glances">' + glances + '</div></div>';
  }

  function renderLearn() {
    const L = data.learning;
    if (!L) return head('学习', '学习', '') + empty('早报还没到', '教学助理会把本周方向和今天的任务写进来。');
    const bits = String(L.week && L.week.criteria || '').split(/[；;]/).map(function (s) { return s.trim().replace(/。$/, ''); }).filter(Boolean);
    const done = isLearnDone();
    const target = Number(L.progress && L.progress.target) || 0;
    return head('学习', (L.week && L.week.title) || '本周方向', L.line || '') +
      '<div class="learn">' +
      '<section class="glass wide"><p class="card-kicker">本周大方向</p><h2 class="card-title">' + esc(L.week && L.week.title) + '</h2>' +
      '<p class="subhead">检查标准</p><ul class="crit">' + bits.map(function (b) {
        return '<li class="inset">' + esc(b) + '</li>';
      }).join('') + '</ul></section>' +
      '<section class="glass"><p class="card-kicker">今日任务 · ' + esc(L.today && L.today.minutes) + ' 分钟</p>' +
      '<h2 class="card-title">' + esc(L.today && L.today.learn) + '</h2>' +
      '<p class="subhead">怎么做</p><p class="card-copy">' + esc(L.today && L.today.how) + '</p>' +
      '<button type="button" class="btn btn-block ' + (done ? '' : 'btn-primary') + '" data-act="learn-done">' +
      (done ? '今天已完成，撤回' : '标记今天完成') + '</button></section>' +
      '<section class="glass"><p class="card-kicker">今晚学习块</p><h2 class="card-title">' + esc(L.tonight && L.tonight.theme) + '</h2>' +
      '<div class="inset" style="padding:12px"><p class="card-kicker">小产物</p><p class="card-copy">' + esc(L.tonight && L.tonight.artifact) + '</p></div>' +
      '<p class="footnote">晚间 ' + esc(L.source && L.source.evening) + ' 由' + esc(L.source && L.source.name) + '带到。</p></section>' +
      '<section class="glass wide"><p class="card-kicker">进度</p><div class="metric"><b>' + weekDoneCount() + '</b>' +
      '<span> / ' + esc(target) + ' 次 · 本周完成</span></div>' +
      '<p class="subhead">最近一次验收</p><p class="card-copy">' + esc(L.progress && L.progress.note) + '</p></section>' +
      '</div><p class="footnote">来源 · ' + esc(L.source && L.source.name) + '早报 ' + esc(L.source && L.source.morning) +
      '、晚间 ' + esc(L.source && L.source.evening) + '。这里只展示，不排课。更新于 ' + esc(whenLabel(L.updated)) + '。</p>';
  }

  function newsItem(it) {
    const inner = '<span class="pill dim">' + esc(it.tag || '') + '</span><h3>' + esc(it.title) + '</h3><p>' + esc(it.line) + '</p>';
    if (it.url) return '<a class="news-item" href="' + safeUrl(it.url) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
    return '<article class="news-item">' + inner + '</article>';
  }
  function renderNews() {
    const groups = data.news && data.news.groups;
    if (!groups) return head('新闻', '工具与用法', '') + empty('生态简报还没到', '工具产品、用法和可跟的开源会排在这里。');
    const cols = [
      ['tools', 'A · 工具产品'],
      ['tips', 'B · 用法提示'],
      ['oss', 'C · 开源可跟']
    ].map(function (col) {
      const items = arr(groups[col[0]]);
      return '<section class="glass"><p class="card-kicker">' + col[1] + '</p>' +
        (items.length ? items.map(newsItem).join('') : '<p class="card-copy">这一栏还空着。</p>') + '</section>';
    }).join('');
    const sports = arr(groups.sports);
    return head('新闻', '工具与用法', '产品、提示、值得跟的开源。体育相关收在最下面。') +
      '<div class="news-grid">' + cols + '</div>' +
      '<section class="glass" style="margin-top:14px"><p class="card-kicker">D · 体育 AI</p>' +
      '<button type="button" class="btn" data-act="sports" aria-expanded="' + (sportsOpen ? 'true' : 'false') + '">' +
      (sportsOpen ? '收起体育 AI' : '体育 AI · 次要，默认收起') + '</button>' +
      (sportsOpen ? '<div style="margin-top:8px">' + sports.map(newsItem).join('') + '</div>' : '<p class="footnote">不进本周主线，也不当教案。</p>') +
      '</section><p class="footnote">更新于 ' + esc(whenLabel(data.news.updated)) + '。长文不在这里展开。</p>';
  }

  function renderOss() {
    const pack = data.trending;
    const items = arr(pack && pack.items);
    if (!items.length) return head('开源', 'GitHub 今日', '') + empty('热榜还没到', '每日脚本会写回 github_trending.json。');
    const cats = ['全部', 'AI', '工具', '好玩'];
    const chips = cats.map(function (cat) {
      const n = cat === '全部' ? items.length : items.filter(function (it) { return it.cat === cat; }).length;
      return '<button type="button" class="chip' + (ossCat === cat ? ' active' : '') + '" data-act="oss" data-cat="' + esc(cat) + '">' +
        esc(cat) + ' ' + n + '</button>';
    }).join('');
    const shown = ossCat === '全部' ? items : items.filter(function (it) { return it.cat === ossCat; });
    const cards = shown.map(function (it) {
      const blurb = (it.desc_cn || it.desc || '').trim();
      return '<a class="repo glass" href="' + safeUrl(it.url) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="repo-top"><span class="pill">' + esc(it.cat) + '</span><span class="pill dim">' + esc(it.tag) + '</span>' +
        '<span class="stars">' + esc(it.today) + '</span></div><h3>' + esc(it.name) + '</h3><p>' + esc(blurb) + '</p>' +
        '<footer><span>' + esc(it.lang || it.repo) + '</span><span>' + esc(it.stars) + ' 星</span></footer></a>';
    }).join('');
    const mode = pack.mode === 'degraded' ? '中文点评暂时降级，先看仓库本身。' : '中文点评已附上。';
    return head('开源', 'GitHub 今日', mode) +
      '<div class="chips" role="tablist">' + chips + '</div>' +
      '<div class="repo-grid" style="margin-top:14px">' + (cards || '<p class="card-copy">这个分类今天没有。</p>') + '</div>' +
      '<p class="footnote">更新于 ' + esc(whenLabel(pack.updated)) + '。点进仓库再看细节。</p>';
  }

  function renderFeishu() {
    const F = data.feishu;
    if (!F) return head('飞书', '交付', '') + empty('飞书摘要还没到', '会话、云盘和任务入口会列在这里。正文仍去飞书看。');
    const agents = arr(F.agents).map(function (a) {
      return '<article class="glass agent"><div class="agent-top"><i class="dot ' + (a.tone === 'wait' ? 'wait' : a.tone === 'off' ? 'off' : '') + '"></i>' +
        '<span class="pill dim">' + esc(a.role) + '</span></div><h3>' + esc(a.name) + '</h3><p>' + esc(a.status) + '</p>' +
        '<div class="actions">' + linkBtn(a.chat, '打开会话', 'btn btn-primary') + '</div></article>';
    }).join('');
    const deliveries = arr(F.deliveries).map(function (d) {
      return '<article class="delivery"><div class="grow"><span class="pill dim">' + esc(d.type) + '</span><strong>' + esc(d.title) +
        '</strong><span>' + esc(whenLabel(d.time)) + '</span></div>' + linkBtn(d.url, '打开文件', 'btn btn-primary') + '</article>';
    }).join('');
    const wall = arr(F.teaching).map(function (it) {
      return '<article class="wall-item"><div class="grow"><span class="pill ' + toneClass(it.status) + '">' + esc(it.status) +
        '</span><strong>' + esc(it.name) + '</strong></div>' +
        linkBtn(it.task, '任务', 'btn') + linkBtn(it.file, '文件', 'btn') + '</article>';
    }).join('');
    const health = F.healthFile || {};
    const follows = arr(F.followups).map(function (it) {
      return '<article class="wall-item" style="align-items:flex-start"><div class="grow"><strong>' + esc(it.topic) +
        '</strong><span>' + esc(it.summary) + '</span></div>' +
        linkBtn(it.chat, '会话', 'btn') + linkBtn(it.export, '导出', 'btn') + '</article>';
    }).join('');
    const reminders = arr(F.reminders).map(function (it) {
      return '<article class="remind"><div class="grow"><strong>' + esc(it.title) + '</strong><span>' +
        esc(dueLabel(it.due) || it.due) + ' · ' + esc(it.agent) + '</span></div>' +
        linkBtn(it.chat, '回到会话', 'btn') + '</article>';
    }).join('');
    const tasks = F.tasks || {};
    return head('飞书', '交付', '摘要和状态留在这里。要看正文，打开飞书。') +
      '<div class="feishu"><div class="agents">' + agents + '</div>' +
      '<div class="split"><section class="glass"><p class="card-kicker">最近交付</p><div class="stack">' +
      (deliveries || '<p class="card-copy">云盘里还没有新文件。</p>') + '</div></section>' +
      '<section class="glass"><p class="card-kicker">教学产出</p><div class="stack">' +
      (wall || '<p class="card-copy">产出墙是空的。</p>') + '</div></section></div>' +
      '<div class="split"><section class="glass"><p class="card-kicker">健康交付 · 只读</p><h2 class="card-title">' + esc(health.title || '周训练 PDF') + '</h2>' +
      '<p class="card-copy">' + esc(health.note || '只给文件，不展示处方。') + '</p><div class="actions">' +
      linkBtn(health.url, '打开 PDF', 'btn btn-primary') + '</div></section>' +
      '<section class="glass"><p class="card-kicker">决策与杂活</p><div class="stack">' +
      (follows || '<p class="card-copy">没有要跟的话题。</p>') + '</div></section></div>' +
      '<div class="split"><section class="glass"><p class="card-kicker">飞书任务</p><p class="card-copy">' + esc(tasks.note || '') + '</p>' +
      '<div class="actions">' + linkBtn(tasks.url, tasks.label || '打开飞书任务', 'btn btn-primary') + '</div></section>' +
      '<section class="glass"><p class="card-kicker">提醒</p><div class="stack">' +
      (reminders || '<p class="card-copy">没有临近的提醒。</p>') + '</div></section></div></div>' +
      '<p class="footnote">更新于 ' + esc(whenLabel(F.updated)) + '。正文、任务和文件都在飞书里打开。</p>';
  }

  function sparkSvg(points) {
    const vals = points.map(function (p) { return p.kg; });
    const min = Math.min.apply(null, vals) - 0.2;
    const max = Math.max.apply(null, vals) + 0.2;
    const w = 320, h = 78, pad = 6;
    const xy = vals.map(function (v, i) {
      const x = pad + (i * (w - pad * 2)) / (vals.length - 1);
      const y = pad + (1 - (v - min) / (max - min || 1)) * (h - pad * 2);
      return [x, y];
    });
    const line = xy.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    const area = line + ' L' + xy[xy.length - 1][0].toFixed(1) + ' ' + h + ' L' + xy[0][0].toFixed(1) + ' ' + h + ' Z';
    const last = xy[xy.length - 1];
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="近七日晨重"><defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#a78bfa" stop-opacity="0.45"/><stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#sparkFill)"/><path d="' + line + '" fill="none" stroke="#c4b5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.5" fill="#f7f3ff"/></svg>';
  }
  function postureHtml() {
    const w = data.workout;
    if (!w) return empty('体态备注还没到', '每日维持会从训练计划里读一行，不在这里改动作。');
    const p = shanghaiParts(new Date());
    const idx = new Date(Date.UTC(p.year, p.month - 1, p.day, 4, 0, 0)).getUTCDay();
    const dayNum = idx === 0 ? 7 : idx;
    const day = arr(w.schedule).filter(function (d) { return d.day === dayNum; })[0];
    const must = arr(w.dailyMust)[0] || '';
    const rule = arr(w.correctionRules)[0] || '';
    return '<section class="glass wide"><p class="card-kicker">体态备注 · ' + esc(w.plan || '矫正') + '</p>' +
      '<h2 class="card-title">' + esc(day ? day.name : '今日维持') + '</h2>' +
      '<p class="card-copy">' + esc(must) + '</p>' +
      (rule ? '<p class="footnote">' + esc(rule) + '</p>' : '') +
      '<p class="footnote">只留备注。组数和重量以今天的签到为准，不在这里改处方。</p></section>';
  }
  function renderHealth() {
    const H = data.health;
    if (!H) return head('健康', '这周的身体', '') + empty('健康数据还没到', '周计划、今日签到、晨重和蛋白会排在这里。');
    const week = H.week || {};
    const todayIso = isoOf(shanghaiParts(new Date()));
    const days = arr(week.days).map(function (d) {
      const cls = (d.date === todayIso ? ' is-today' : '') + (d.train ? '' : ' is-off');
      return '<div class="day' + cls + '"><span>' + esc(d.label) + '</span><strong>' + esc(d.name) + '</strong><i>' +
        (d.football ? '足球' : '') + '</i></div>';
    }).join('');
    const session = H.today || {};
    const sessionDone = isSessionDone();
    const sets = arr(session.exercises).map(function (ex) {
      return '<div class="set inset"><strong>' + esc(ex.name) + '</strong><span class="nums">' + esc(ex.sets) + ' 组 · ' +
        esc(ex.reps) + ' 次 · ' + esc(ex.weight) + ' kg · RIR ' + esc(ex.rir) + '</span></div>';
    }).join('');
    const feel = discomfort();
    const seg = ['无', '轻微', '需留意'].map(function (v) {
      return '<button type="button" class="' + (feel === v ? 'active' : '') + '" data-act="discomfort" data-value="' + esc(v) + '">' + esc(v) + '</button>';
    }).join('');
    const feelNote = feel === '需留意' ? '已记下。具体哪里不舒服交给素问，这里不判断原因。' :
      (feel === '轻微' ? '轻微不适已记下。组数仍按今天的记录，不在这里改。' : '今天没有不适。');
    const badges = (session.hasTraining ? '<span class="pill ok">今日有练</span>' : '<span class="pill dim">今日休息</span>') +
      (session.footballEvening ? '<span class="pill wait">足球晚训</span>' : '');
    const w = weightStats();
    const weightBlock = w ? '<section class="glass"><p class="card-kicker">晨重 · 七日</p><div class="metric"><b>' + w.last.toFixed(1) +
      '</b><span>kg · 目标 ' + esc(w.goal) + '</span></div><p class="card-copy">较昨日 <span class="delta ' + deltaClass(w.day) + '">' +
      signed(w.day, 1) + '</span> · 这七日 <span class="delta ' + deltaClass(w.week) + '">' + signed(w.week, 1) + '</span></p>' +
      sparkSvg(w.pts) + '<div class="head-row"><span class="meta">' + esc(String(w.pts[0].date).slice(5)) + '</span><span class="meta">' +
      esc(String(w.pts[w.pts.length - 1].date).slice(5)) + '</span></div>' +
      '<form class="weight-form" data-weight><input inputmode="decimal" autocomplete="off" aria-label="记下晨重" placeholder="记下晨重"><button class="btn" type="submit">保存</button></form></section>' :
      empty('晨重还没到', '七天的晨重会画成一条线。');
    const protein = H.protein || { grams: 0, low: 113, high: 156 };
    const grams = proteinGrams();
    const max = Math.max(180, grams, protein.high);
    const bandL = (protein.low / max) * 100;
    const bandW = ((protein.high - protein.low) / max) * 100;
    const fill = Math.min(100, (Math.max(grams, 0) / max) * 100);
    const zone = grams < protein.low ? 'low' : grams > protein.high ? 'high' : '';
    const zoneText = grams < protein.low ? '还差 ' + (protein.low - grams) + ' 克到下沿' :
      grams > protein.high ? '高出上沿 ' + (grams - protein.high) + ' 克' : '落在区间里';
    const adds = [{ n: 12, l: '鸡蛋 +12' }, { n: 25, l: '蛋白粉 +25' }, { n: 35, l: '正餐 +35' }].map(function (a) {
      return '<button type="button" class="btn" data-act="protein" data-add="' + a.n + '">' + a.l + '</button>';
    }).join('');
    const sleep = H.sleep || {};
    const late = String(sleep.asleep || '').split(':').map(Number)[0] < 5;
    const supps = arr(H.supplements).map(function (s) {
      const on = suppOn(s);
      return '<button type="button" class="supp" data-act="supp" data-key="' + esc(s.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><span>' +
        esc(s.name) + '</span><span class="switch' + (on ? ' on' : '') + '" aria-hidden="true"><i></i></span></button>';
    }).join('');
    return head('健康', '这周的身体', '计划、今天这场、晨重和蛋白。处方不在这里改。') +
      '<div class="health">' +
      '<section class="glass"><div class="head-row"><p class="card-kicker">本周训练</p></div><h2 class="card-title">' + esc(week.title) + '</h2>' +
      '<p class="card-copy">' + esc(String(week.start || '').slice(5)) + ' – ' + esc(String(week.end || '').slice(5)) + '</p>' +
      '<div class="pills">' + badges + '</div><div class="days">' + days + '</div><div class="actions">' +
      linkBtn(week.pdf, week.pdfLabel || '打开周训练 PDF', 'btn btn-primary') + '</div></section>' +
      '<section class="glass"><p class="card-kicker">今日签到 · ' + esc(String(session.date || '').slice(5)) + '</p>' +
      '<h2 class="card-title">' + esc(session.title || '今天没有安排') + '</h2>' +
      '<div class="pills">' + arr(session.parts).map(function (part) { return '<span class="pill dim">' + esc(part) + '</span>'; }).join('') + '</div>' +
      '<div class="sets">' + (sets || '<p class="card-copy">没有组数记录。</p>') + '</div>' +
      '<p class="subhead">不适</p><div class="seg" role="group" aria-label="不适">' + seg + '</div>' +
      '<p class="footnote">' + esc(feelNote) + ' RIR 是这组还能再做几次，只展示。</p>' +
      '<button type="button" class="btn btn-block ' + (sessionDone ? '' : 'btn-primary') + '" data-act="session-done">' +
      (sessionDone ? '这场已完成，撤回' : '标记这场完成') + '</button></section>' +
      weightBlock +
      '<section class="glass"><p class="card-kicker">蛋白</p><div class="metric"><b>' + grams + '</b><span>克 · 区间 ' +
      esc(protein.low) + '–' + esc(protein.high) + '</span></div>' +
      '<div class="track ' + zone + '" aria-hidden="true"><i class="band" style="left:' + bandL.toFixed(1) + '%;width:' + bandW.toFixed(1) +
      '%"></i><i class="fill" style="width:' + fill.toFixed(1) + '%"></i></div><p class="card-copy">' + esc(zoneText) + '</p>' +
      '<div class="actions">' + adds + (state.proteinAdd ? '<button type="button" class="btn" data-act="protein-reset">恢复记录</button>' : '') +
      '</div></section>' +
      '<section class="glass"><p class="card-kicker">睡眠</p><div class="metric"><b>' + esc(sleep.hours) + '</b><span>小时 · ' +
      esc(sleep.quality || '') + '</span></div><div class="pills"><span class="pill ' + (late ? 'wait' : 'ok') + '">' +
      (late ? '晚于零点' : '早于零点') + '</span><span class="pill dim">入睡 ' + esc(sleep.asleep) + '</span></div>' +
      '<p class="card-copy">入睡线仍是 ' + esc(sleep.target || '00:00') + '。这里只看昨晚，不排今晚的课。</p></section>' +
      '<section class="glass"><p class="card-kicker">补剂</p><div class="supps">' + supps + '</div></section>' +
      '<section class="glass wide quote"><p class="card-kicker">本周复盘</p><p class="card-copy">' + esc(H.review || '') + '</p></section>' +
      postureHtml() +
      '</div><p class="footnote">数据来自素问周 PDF、Hevy 当日记录，以及晨重、蛋白、睡眠和补剂自报。更新于 ' + esc(whenLabel(H.updated)) + '。</p>';
  }

  function decisionCard(t) {
    return '<article class="inset" style="padding:14px"><div class="pills"><span class="pill wait">待拍板</span>' +
      (t.priority === 'high' ? '<span class="pill bad">要紧</span>' : '') +
      '<span class="pill dim">' + esc(dueLabel(t.due) || WHO[t.source] || t.source || '') + '</span></div>' +
      '<h2 class="card-title" style="font-size:17px">' + esc(t.text) + '</h2><p class="card-copy">' + esc(t.ask || '') + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-act="decision" data-id="' + esc(t.id) + '" data-res="yes">就这样</button>' +
      '<button type="button" class="btn" data-act="decision" data-id="' + esc(t.id) + '" data-res="later">以后再说</button>' +
      '<button type="button" class="btn" data-act="decision" data-id="' + esc(t.id) + '" data-res="no">这次不做</button></div></article>';
  }
  function renderDecide() {
    const open = openDecisions();
    const later = laterDecisions();
    const todos = openTodos();
    const done = closedItems();
    const laterHtml = later.length ? '<p class="subhead">以后再说</p>' + later.map(function (t) {
      return '<article class="inset" style="padding:12px"><strong>' + esc(t.text) + '</strong><div class="actions">' +
        '<button type="button" class="btn" data-act="undo" data-id="' + esc(t.id) + '">重新拿出来</button></div></article>';
    }).join('') : '';
    const todoHtml = todos.length ? todos.map(function (t) {
      return '<button type="button" class="check" data-act="todo" data-id="' + esc(t.id) + '" aria-pressed="false"><span class="box"></span><span><strong>' +
        esc(t.text) + '</strong><small>' + esc(t.cat) + ' · ' + esc(WHO[t.source] || t.source || '') +
        (t.due ? ' · ' + esc(dueLabel(t.due)) : '') + '</small></span></button>';
    }).join('') : '<p class="card-copy">待办是空的。</p>';
    const doneHtml = done.length ? '<section class="glass" style="margin-top:14px"><p class="card-kicker">已经处理</p><div class="stack">' +
      done.map(function (t) {
        const res = decisionRes(t);
        const label = res === 'no' ? '这次不做' : res === 'yes' ? '已拍板' : '已完成';
        return '<article class="check" style="cursor:default"><span class="box" style="background:#7c3aed;border-color:transparent"></span><span class="grow"><strong>' +
          esc(t.text) + '</strong><small>' + label + '</small></span><button type="button" class="btn" data-act="undo" data-id="' + esc(t.id) + '">撤回</button></article>';
      }).join('') + '</div></section>' : '';
    return head('拍板', '要你点头的事', '先拍板，再勾掉今天的待办。投资条目不在这张主清单里。') +
      '<div class="decide"><section class="glass"><p class="card-kicker">待拍板</p><div class="stack">' +
      (open.length ? open.map(decisionCard).join('') : '<p class="card-copy">没有等你点头的事。</p>') + laterHtml +
      '</div></section><section class="glass"><p class="card-kicker">待办</p><div class="stack">' + todoHtml + '</div></section></div>' + doneHtml;
  }

  function renderBots() {
    const bots = arr(data.bots && data.bots.bots);
    if (!bots.length) return head('地图', '三个机器人', '') + empty('地图还是空的', '教学助理、拾壹、素问的状态会排在这里。');
    const cards = bots.map(function (bot) {
      const live = botLive(bot);
      return '<article class="glass"><div class="agent-top"><i class="dot ' + dotClass(live.state) + '"></i><span class="pill dim">' +
        esc(bot.cadence) + '</span></div><h2 class="card-title">' + esc(bot.name) + '</h2><p class="card-copy">' + esc(bot.duty) + '</p>' +
        '<div class="pills" style="margin-top:10px">' + arr(bot.outputs).map(function (o) { return '<span class="pill">' + esc(o) + '</span>'; }).join('') +
        '</div><p class="footnote">此刻 · ' + esc(live.status) + '</p><div class="actions">' +
        linkBtn(bot.feishu, '打开会话', 'btn btn-primary') + '</div></article>';
    }).join('');
    const miles = arr(data.progress && data.progress.milestones).slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
    return head('地图', '三个机器人', '谁在什么时候交什么。工作台不替他们排新的课。') +
      '<div class="bots"><div class="flow inset wide"><b>教学助理</b><span>早报与晚间</span><span>→</span><b>拾壹</b><span>收口拍板</span><span>→</span><b>素问</b><span>训练与恢复</span></div>' +
      '<div class="bot-grid">' + cards + '</div>' +
      '<section class="glass wide"><p class="card-kicker">共事记录</p><ol class="miles">' + miles.map(function (m) {
        return '<li><time>' + esc(String(m.date).slice(5)) + '</time><div><span class="pill dim">' + esc(m.cat) + '</span><strong> ' +
          esc(m.title) + '</strong><p>' + esc(m.desc) + '</p></div></li>';
      }).join('') + '</ol></section></div>';
  }

  function renderMemo() {
    const insight = data.insights || {};
    const holds = arr(data.stocks && data.stocks.holdings);
    const market = data.news && data.news.market;
    const cards = holds.map(function (h) {
      const price = Number(h.price);
      const shown = price < 10 ? price.toFixed(3) : price.toFixed(2);
      return '<article class="hold inset"><div class="grow"><strong>' + esc(h.name) + '</strong><span>' + esc(h.code) +
        (h.notes ? ' · ' + esc(h.notes) : '') + '</span></div><div class="hold-px"><b>' + esc(shown) + '</b><span class="delta ' +
        deltaClass(Number(h.change)) + '">' + signed(h.change, 2) + '%</span></div></article>';
    }).join('');
    const tips = arr(insight.tips).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    const lines = arr(market && market.items).map(function (it) {
      return '<article class="news-item"><span class="pill dim">' + esc(it.impact || '') + '</span><h3>' + esc(it.headline) + '</h3></article>';
    }).join('');
    const invests = investTodos().map(function (t) {
      return '<article class="inset" style="padding:12px"><strong>' + esc(t.text) + '</strong><p class="footnote">来自待办，类别是投资，所以不进拍板主清单。</p></article>';
    }).join('');
    return head('已降权', '纪律备忘', '规则还在，只是不再占主导航。这里不做交易。') +
      '<div class="memo"><section class="glass wide"><p class="card-kicker">规则摘要 · ' + esc(whenLabel(insight.updated)) + '</p>' +
      '<p class="card-copy">' + esc(insight.daily_summary || '还没有摘要。') + '</p>' +
      (tips ? '<ul class="tips">' + tips + '</ul>' : '') + '</section>' + cards +
      '<section class="glass"><p class="card-kicker">行情摘记 · ' + esc(market && market.date) + '</p>' +
      (lines || '<p class="card-copy">没有摘记。</p>') + '</section>' +
      '<section class="glass"><p class="card-kicker">仍在执行的投资待办</p><div class="stack">' +
      (invests || '<p class="card-copy">没有单独的投资待办。</p>') + '</div></section></div>';
  }

  function renderTab() {
    if (tab === 'learn') return renderLearn();
    if (tab === 'news') return renderNews();
    if (tab === 'oss') return renderOss();
    if (tab === 'feishu') return renderFeishu();
    if (tab === 'health') return renderHealth();
    if (tab === 'decide') return renderDecide();
    if (tab === 'bots') return renderBots();
    if (tab === 'memo') return renderMemo();
    return renderToday();
  }

  function navButton(kind, id, label, ic) {
    const badge = id === 'decide' ? '<em class="badge js-decide-badge" hidden>0</em>' : '';
    return '<button type="button" class="' + kind + '-item" data-go="' + id + '">' + icon(ic) + '<span>' + label + '</span>' + badge + '</button>';
  }
  function renderShell() {
    const rail = NAV.map(function (n) { return navButton('rail', n[0], n[1], n[2]); }).join('');
    const dock = NAV.map(function (n) { return navButton('dock', n[0], n[1], n[2]); }).join('');
    const left = shell === 'mobile'
      ? '<div class="brand"><span class="mark" aria-hidden="true">拾</span><span class="brand-text"><strong>拾壹</strong><small class="js-date" data-compact="1"></small></span></div>'
      : '<div class="top-date js-date"></div>';
    const shellLink = shell === 'desktop'
      ? '<a class="quiet-link" id="shellLink" href="index.html">手机版</a>'
      : '<a class="quiet-link" id="shellLink" href="desktop.html">宽屏</a>';
    const memoTop = shell === 'mobile'
      ? '<button type="button" data-memo><span class="js-memo-label" data-short="纪律">纪律</span></button>'
      : '';
    document.getElementById('app').innerHTML =
      '<div class="ambient" aria-hidden="true"><i class="orb a"></i><i class="orb b"></i><i class="orb c"></i></div>' +
      '<div class="shell"><aside class="rail"><div class="brand"><span class="mark" aria-hidden="true">拾</span><span class="brand-text"><strong>拾壹</strong><small>指挥台</small></span></div>' +
      '<div class="rail-label">模块</div>' + rail +
      '<div class="rail-foot"><button type="button" data-memo><span class="js-memo-label">纪律备忘</span><small>投资已降权</small></button></div></aside>' +
      '<main class="stage" id="stage"><header class="topbar">' + left +
      '<div class="top-meta"><time id="topClock"></time>' + shellLink + memoTop +
      '<button type="button" class="quiet-link" id="installBtn" data-act="install" hidden>安装</button></div></header>' +
      '<div id="view"></div></main></div>' +
      '<nav class="dock" aria-label="模块">' + dock + '</nav>';
  }
  function syncChrome() {
    document.querySelectorAll('.rail-item, .dock-item').forEach(function (btn) {
      const on = btn.dataset.go === tab;
      btn.classList.toggle('active', on);
      if (on) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    const n = openDecisions().length;
    document.querySelectorAll('.js-decide-badge').forEach(function (el) {
      el.hidden = n === 0;
      el.textContent = String(n);
    });
    document.querySelectorAll('[data-memo]').forEach(function (btn) {
      btn.classList.toggle('active', tab === 'memo');
    });
    document.querySelectorAll('.js-memo-label').forEach(function (el) {
      el.textContent = tab === 'memo' ? (el.dataset.short ? '返回' : '返回今日') : (el.dataset.short || '纪律备忘');
    });
    const link = document.getElementById('shellLink');
    if (link) link.href = (shell === 'desktop' ? 'index.html' : 'desktop.html') + '#' + tab;
    const install = document.getElementById('installBtn');
    if (install) install.hidden = !deferredPrompt;
  }
  function paint(reset) {
    try {
      if (!built) { renderShell(); built = true; }
      syncChrome();
      const view = document.getElementById('view');
      view.innerHTML = renderTab();
      document.title = (TITLES[tab] || '拾壹') + ' · 拾壹工作台';
      if (reset) {
        const stage = document.getElementById('stage');
        if (shell === 'desktop' && stage) stage.scrollTop = 0;
        else window.scrollTo(0, 0);
        view.classList.remove('rise');
        void view.offsetWidth;
        view.classList.add('rise');
      }
      tick();
    } catch (err) {
      const view = document.getElementById('view');
      if (view) view.innerHTML = empty('这一页没有画出来', err && err.message ? err.message : '未知错误');
    }
  }
  function tick() {
    const p = shanghaiParts(new Date());
    const clock = document.getElementById('topClock');
    if (clock) clock.textContent = clockLabel(p);
    document.querySelectorAll('.js-date').forEach(function (el) { el.textContent = dateLabel(p, el.dataset.compact === '1'); });
    const hero = document.getElementById('bedHero');
    if (!hero) return;
    const bed = bedtime(p);
    hero.dataset.tone = bed.tone;
    const c = document.getElementById('bedClock');
    const l = document.getElementById('bedLabel');
    const copy = document.getElementById('bedCopy');
    if (c) c.textContent = bed.clock;
    if (l) l.textContent = bed.label;
    if (copy) copy.textContent = bed.copy;
  }
  function readTab() {
    const id = (location.hash || '').replace('#', '');
    if (NAV.some(function (n) { return n[0] === id; }) || id === 'memo') return id;
    return 'today';
  }
  function setTab(id) {
    if (id === tab) return;
    tab = id;
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    paint(true);
  }
  function onClick(e) {
    const act = e.target.closest('[data-act]');
    if (act) {
      const id = act.dataset.id;
      const name = act.dataset.act;
      if (name === 'learn-done') state.learnDone = !isLearnDone();
      else if (name === 'session-done') state.sessionDone = !isSessionDone();
      else if (name === 'discomfort') state.discomfort = act.dataset.value;
      else if (name === 'protein') state.proteinAdd = (Number(state.proteinAdd) || 0) + Number(act.dataset.add || 0);
      else if (name === 'protein-reset') state.proteinAdd = 0;
      else if (name === 'supp') {
        const key = act.dataset.key;
        const item = arr(data.health && data.health.supplements).filter(function (s) { return s.id === key; })[0] || { id: key, done: false };
        state.supplements[key] = !suppOn(item);
      } else if (name === 'todo') {
        const t = allTodos().filter(function (x) { return String(x.id) === String(id); })[0];
        if (t) state.todoDone[id] = !isTodoDone(t);
      } else if (name === 'decision') {
        state.decision[id] = act.dataset.res;
        state.todoDone[id] = act.dataset.res !== 'later';
      } else if (name === 'undo') {
        delete state.decision[id];
        state.todoDone[id] = false;
      } else if (name === 'sports') {
        sportsOpen = !sportsOpen;
        paint(false);
        return;
      } else if (name === 'oss') {
        ossCat = act.dataset.cat || '全部';
        paint(false);
        return;
      } else if (name === 'install') {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function () {
            deferredPrompt = null;
            const b = document.getElementById('installBtn');
            if (b) b.hidden = true;
          });
        }
        return;
      } else return;
      save();
      paint(false);
      return;
    }
    if (e.target.closest('[data-memo]')) {
      setTab(tab === 'memo' ? 'today' : 'memo');
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go && go.dataset.go) setTab(go.dataset.go);
  }
  function onSubmit(e) {
    const form = e.target.closest('[data-weight]');
    if (!form) return;
    e.preventDefault();
    const raw = form.querySelector('input').value.trim();
    if (!raw) state.weight = null;
    else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 40 || n > 150) return;
      state.weight = Math.round(n * 10) / 10;
    }
    save();
    paint(false);
  }

  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  window.addEventListener('hashchange', function () {
    const next = readTab();
    if (next !== tab) { tab = next; paint(true); }
  });
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    const b = document.getElementById('installBtn');
    if (b) b.hidden = false;
  });

  function boot() {
    const keys = Object.keys(FILES);
    Promise.all(keys.map(function (key) {
      return fetch(FILES[key], { cache: 'no-cache' }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        return res.json();
      }).then(function (json) { return [key, json]; }, function () { return [key, null]; });
    })).then(function (pairs) {
      pairs.forEach(function (pair) { data[pair[0]] = pair[1]; });
      state = loadState();
      tab = readTab();
      if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
      paint(true);
      setInterval(tick, 1000);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
  boot();
})();
