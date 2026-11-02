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
    ['health', '健康', 'heart'],
    ['learn', '学习', 'book'],
    ['news', '新闻', 'spark'],
    ['oss', '开源', 'git'],
    ['feishu', '飞书', 'send'],
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
  let setsOpen = false;
  let cloudMore = false;
  let noteOpen = false;
  let foldFollow = false;
  let foldTasks = false;
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
      todoDone: {}, decision: {}, top3Done: {}, learnDone: null, sessionDone: null,
      discomfort: null, proteinAdd: 0, weight: null, supplements: {}
    };
    try {
      const raw = JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
      return {
        todoDone: Object.assign({}, raw.todoDone || {}),
        decision: Object.assign({}, raw.decision || {}),
        top3Done: Object.assign({}, raw.top3Done || {}),
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
    if (state.learnDone != null) return !!state.learnDone;
    const L = data.learning || {};
    if (L.today_done != null) return !!L.today_done;
    return !!(L.today && L.today.done);
  }
  function isTop3Done(t) {
    if (state.top3Done && state.top3Done[t.id] != null) return !!state.top3Done[t.id];
    return !!t.done;
  }
  function short12(s) {
    const t = String(s || '').replace(/\s+/g, '');
    return t.length > 12 ? t.slice(0, 12) : t;
  }
  function asleepLate(hhmm) {
    const h = Number(String(hhmm || '12:00').split(':')[0]);
    return h < 5;
  }
  function leverLabel(p, sleep) {
    if (p.hour >= 5 && p.hour < 12 && sleep && sleep.asleep && !asleepLate(sleep.asleep)) return '已达成';
    if (p.hour * 60 + p.minute < 22 * 60 + 30) return '未到点';
    return '已踩线';
  }
  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const p = shanghaiParts(d);
    const now = shanghaiParts(new Date());
    const hm = clockLabel(p);
    if (isoOf(p) === isoOf(now)) return '今天 ' + hm;
    const y = new Date(Date.now() - 86400000);
    if (isoOf(p) === isoOf(shanghaiParts(y))) return '昨天 ' + hm;
    const days = Math.round((Date.now() - d.getTime()) / 86400000);
    if (days > 1 && days < 21) return days + ' 天前';
    return p.month + '月' + p.day + '日';
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
    return '<section class="glass empty"><p class="card-kicker">这一栏还空</p><h2>' + esc(title) + '</h2><p class="card-copy">' + esc(copy) + '</p><p class="footnote">数据写进对应的 JSON 后，这里会自己补上，不用刷新成另一套页面。</p></section>';
  }
  function emptyInline(title, copy) {
    return '<div class="empty-inline"><p class="card-kicker">' + esc(title) + '</p><p class="card-copy">' + esc(copy) + '</p></div>';
  }

  function renderToday() {
    const p = shanghaiParts(new Date());
    const sleep = data.health && data.health.sleep;
    const label = leverLabel(p, sleep);
    const dot = label === '已达成' ? 'done' : label === '已踩线' ? 'line' : 'wait';
    const night = sleep && sleep.asleep ? '<p class="lever-half">昨夜 ' + esc(sleep.asleep) + ' 入睡 · ' + esc(sleep.hours) + ' 小时' +
      (sleep.quality ? ' · ' + esc(sleep.quality) : '') + '</p>' : '';
    const items = arr(data.todos && data.todos.top3).slice(0, 3);
    const doneN = items.filter(isTop3Done).length;
    const lines = items.length ? items.map(function (item, i) {
      const on = isTop3Done(item);
      return '<button type="button" class="top3-line' + (on ? ' done' : '') + '" data-act="top3" data-id="' + esc(item.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="ord">' + (i + 1) + '</span><span class="box"></span><strong>' + esc(short12(item.text)) + '</strong></button>';
    }).join('') : emptyInline('还没定', '今天的三件事还空着。定好以后，每条不超过十二个字，勾完就沉下去。');
    const L = data.learning || {};
    const what = L.today_what || (L.today && L.today.learn) || '';
    const minutes = L.today_minutes != null ? L.today_minutes : (L.today && L.today.minutes);
    const learnOn = !!(what || minutes);
    const session = data.health && data.health.today;
    const w = weightStats();
    const prot = data.health && data.health.protein;
    const grams = data.health ? proteinGrams() : null;
    const nDec = openDecisions().length;
    const nTodo = openTodos().length;
    const openLeft = items.filter(function (item) { return !isTop3Done(item); }).length;
    const stats = [
      {
        go: 'learn',
        k: '学习',
        v: !learnOn ? '早报未到' : (isLearnDone() ? '今日已完成' : (minutes ? minutes + ' 分钟' : '进行中')),
        s: what || '教学助理会把今天要做的一件事写在这里。'
      },
      {
        go: 'health',
        k: '训练',
        v: session && session.hasTraining ? (session.title || '训练日') : '今天休',
        s: session && session.hasTraining
          ? arr(session.parts).join(' · ') + (session.footballEvening ? ' · 足球晚' : '') + (arr(session.exercises).length ? ' · ' + arr(session.exercises).length + ' 个动作' : '')
          : '没有优先动作，维持体态备注就够。'
      },
      {
        go: 'health',
        k: '晨重',
        v: w ? w.last.toFixed(1) + ' kg' : '—',
        s: w ? ('较昨 ' + signed(w.day, 1) + (prot ? ' · 蛋白 ' + grams + ' / ' + prot.low + ' g' : '')) : '晨间自报写进来之后，这里才有数。'
      },
      {
        go: 'decide',
        k: '拍板',
        v: nDec ? nDec + ' 件待点头' : '已清空',
        s: nTodo ? nTodo + ' 件待办还开着' : '待办也空了。投资条目不在这张清单。'
      }
    ];
    function heroFigure(v) {
      const s = String(v == null ? '' : v);
      const m = s.match(/^(\d+(?:\.\d+)?)\s+(\S.*)$/);
      if (!m) return '<span class="v is-phrase">' + esc(s) + '</span>';
      return '<span class="v"><b>' + esc(m[1]) + '</b><span class="unit">' + esc(m[2]) + '</span></span>';
    }
    const statHtml = '<div class="stat-row">' + stats.map(function (st) {
      return '<button type="button" class="stat" data-go="' + st.go + '"><span class="k">' + esc(st.k) + '</span>' + heroFigure(st.v) + '<span class="s">' + esc(st.s) + '</span></button>';
    }).join('') + '</div>';
    const decs = openDecisions().slice(0, 2);
    const decide = '<section class="glass"><p class="card-kicker">待拍板</p><div class="stack">' + (decs.length ? decs.map(function (t) {
      const opts = arr(t.options).slice(0, 2);
      const buttons = (opts.length ? opts : ['就这样', '以后再说']).map(function (opt, i) {
        return '<button type="button" class="btn' + (i === 0 ? ' btn-primary' : '') + '" data-act="decision" data-id="' + esc(t.id) + '" data-res="' + esc(opt) + '">' + esc(opt) + '</button>';
      }).join('');
      const due = dueLabel(t.due);
      return '<div class="inset decide-mini"><p class="micro">' + esc((WHO[t.source] || t.source || '待定') + (due ? ' · ' + due : '')) + '</p><p class="card-copy">' + esc(t.ask || t.text) + '</p><div class="actions">' + buttons + '</div></div>';
    }).join('') : emptyInline('没有等你点头的事', '拍板清空之后，这一格就保持安静。投资类不进这里。')) + '</div></section>';
    const bots = arr(data.bots && data.bots.bots);
    const botRow = bots.length ? '<section class="glass wide"><p class="card-kicker">三个机器人</p><div class="mini-bots">' + bots.map(function (bot) {
      const live = botLive(bot);
      return '<button type="button" class="mini-bot" data-go="bots"><i class="dot ' + dotClass(live.state) + '"></i><span class="mini-copy"><strong>' +
        esc(bot.name) + '</strong><em>' + esc(bot.cadence) + '</em></span><span class="mini-status">' + esc(live.status) + '</span></button>';
    }).join('') + '</div></section>' : '';
    const hello = '<section class="glass wide hero-card"><p class="card-kicker">今日</p><p class="today-line"><strong>' + esc(greet(p.hour)) + '</strong><span>' +
      (openLeft ? '还有 ' + openLeft + ' 件今日事项没勾。' : (items.length ? '今日三件已经勾完。' : '先看下面四格，再决定今天动哪一件。')) +
      '</span></p></section>';
    const topMeta = items.length ? '<span class="pill' + (doneN === items.length ? ' ok' : ' dim') + '">' + doneN + ' / ' + items.length + '</span>' : '';
    return '<div class="today">' + hello +
      '<section class="lever glass wide" id="leverBar"><i class="dot ' + dot + '" id="leverDot"></i><div><p class="lever-copy">今晚杠杆：00:00 前睡着 · 22:30 关屏</p>' +
      '<p class="lever-half" id="leverState">' + esc(label) + '</p>' + night + '</div></section>' +
      '<div class="wide">' + statHtml + '</div>' +
      '<section class="glass"><div class="bar"><p class="card-kicker">今日 Top3</p>' + topMeta + '</div>' + lines + '</section>' +
      decide + botRow + '</div>';
  }

  function renderLearn() {
    const L = data.learning;
    if (!L) return empty('早报还没到', '教学助理会把本周方向和今天的任务写进来。');
    const theme = L.week_theme || (L.week && L.week.title) || '';
    const check = L.week_check || (L.week && L.week.criteria) || '';
    const what = L.today_what || (L.today && L.today.learn) || '';
    const howRaw = L.today_how || (L.today && L.today.how) || [];
    const steps = (Array.isArray(howRaw) ? howRaw : String(howRaw).split(/[。；;]/)).map(function (s) { return String(s).trim(); }).filter(Boolean).slice(0, 3);
    const minutes = L.today_minutes != null ? L.today_minutes : (L.today && L.today.minutes);
    const themeNight = L.tonight_theme || (L.tonight && L.tonight.theme) || '';
    const artifact = L.tonight_artifact || (L.tonight && L.tonight.artifact) || '';
    const note = L.last_note || (L.progress && L.progress.note) || '';
    const morning = L.source_morning || (L.source && L.source.morning) || '08:00';
    const evening = L.source_evening || (L.source && L.source.evening) || '20:30';
    const done = isLearnDone();
    function hm(v) {
      const parts = String(v || '').split(':');
      return String(Number(parts[0] || 0)) + ':' + (parts[1] || '00');
    }
    const noteRow = note
      ? '<button type="button" class="note-line' + (noteOpen ? ' open' : '') + '" data-act="note" aria-expanded="' + (noteOpen ? 'true' : 'false') + '">' +
        '<span class="note-sum">' + esc(note) + '</span><i class="note-arrow" aria-hidden="true">' + (noteOpen ? '▾' : '›') + '</i></button>'
      : '';
    return '<section class="glass learn-card"><div class="bar"><strong>学习</strong><span class="pill ' + (done ? 'ok' : 'wait') + '">' +
      (done ? '今日已完成' : '今日未完成') + '</span></div>' +
      '<div class="pills"><span class="pill dim">预计 ' + esc(minutes) + ' 分钟</span><span class="pill dim">早报 ' + esc(hm(morning)) + '</span><span class="pill dim">晚间 ' + esc(hm(evening)) + '</span></div>' +
      '<p class="micro">本周方向</p><h2 class="week-theme">' + esc(theme) + '</h2>' +
      (check ? '<p class="check-gray">' + esc(check) + '</p>' : '') +
      '<p class="card-kicker">今日</p><p class="card-copy">' + esc(what) + '</p>' +
      (steps.length ? '<ol class="how">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '') +
      '<button type="button" class="done-row" data-act="learn-done" aria-pressed="' + (done ? 'true' : 'false') + '"><span class="box"></span><span>完成</span></button>' +
      '<p class="card-kicker" style="margin-top:16px">今晚</p><p class="card-copy">' + esc(themeNight) + '</p>' +
      '<p class="artifact"><span>要留下的小产物</span>' + esc(artifact) + '</p>' +
      noteRow +
      '<p class="footnote">只展示早报和晚间交来的字段，页面不另外排课。</p></section>';
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
        (items.length ? items.map(newsItem).join('') : emptyInline('这一栏还空着', '简报到了会按标签排进来。没有条目时不拿别的栏目来填。')) + '</section>';
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
      '<div class="repo-grid" style="margin-top:14px">' + (cards || emptyInline('这个分类今天没有', '热榜还在，只是这一类今天没有仓库。换到「全部」能看到当天完整的一页。')) + '</div>' +
      '<p class="footnote">更新于 ' + esc(whenLabel(pack.updated)) + '。点进仓库再看细节。</p>';
  }

  function renderFeishu() {
    const F = data.feishu;
    if (!F) return empty('飞书还没接上', '会话、云盘和教学产出会从 feishu.json 排进来。链接换成真实云盘之后才能点开。');
    const agents = arr(F.agents);
    const files = arr(F.deliveries);
    const teaching = arr(F.teaching);
    const entry = F.entry || (agents[0] && agents[0].chat) || '#';
    if (!files.length && !teaching.length) {
      return '<section class="glass empty"><p class="card-kicker">暂无交付</p><h2>云盘和教学产出都还空</h2><p class="card-copy">机器人交了文件之后，最近六条会出现在云盘，教学卡单独一列。现在只能先打开飞书会话。</p><div class="actions">' + linkBtn(entry, '打开飞书', 'btn btn-primary') + '</div></section>';
    }
    const route = '<div class="route-bar glass">' + agents.map(function (a) {
      const tone = a.tone === 'wait' ? 'wait' : a.tone === 'off' ? 'off' : 'ok';
      return '<a class="route-chip" href="' + safeUrl(a.chat) + '" target="_blank" rel="noopener noreferrer"><i class="dot ' + tone + '"></i><strong>' +
        esc(a.name) + '</strong><span>' + esc(a.duty || a.role || '') + '</span><em>进入</em></a>';
    }).join('') + '</div>';
    const shown = cloudMore ? files : files.slice(0, 6);
    const rows = shown.map(function (d) {
      return '<a class="cloud-row" href="' + safeUrl(d.url) + '" target="_blank" rel="noopener noreferrer"><strong>' + esc(d.title) +
        '</strong><span class="pill dim">' + esc(d.type) + '</span><span class="who">' + esc(d.agent || '') + '</span><time>' +
        esc(relTime(d.time)) + '</time><span class="open">打开</span></a>';
    }).join('');
    const more = files.length > 6 ? '<button type="button" class="btn fold-btn" data-act="cloud">' + (cloudMore ? '收起' : '更多') + '</button>' : '';
    const wall = teaching.map(function (it) {
      const tags = arr(it.tags);
      return '<a class="teach-card glass" href="' + safeUrl(it.file || it.url) + '" target="_blank" rel="noopener noreferrer"><span class="type-bar">' +
        esc(it.type || '文件') + '</span><h3>' + esc(it.name) + '</h3><div class="pills">' +
        tags.map(function (tag) { return '<span class="pill ' + toneClass(tag) + '">' + esc(tag) + '</span>'; }).join('') +
        '</div><footer>' + esc(it.status || '') + ' · ' + esc(it.source || '') + ' · ' + esc(relTime(it.time)) + '</footer></a>';
    }).join('');
    const health = F.healthFile || {};
    const pdf = health.url ? '<a class="pdf-strip" href="' + safeUrl(health.url) + '" target="_blank" rel="noopener noreferrer"><span class="pill">只读·健康</span><span>' +
      esc(health.title || '周训练 PDF') + '</span><span class="open">打开 PDF</span></a>' : '';
    const follows = arr(F.followups);
    const followBlock = follows.length ? '<section class="glass"><button type="button" class="btn fold-btn" data-act="fold" data-key="follow">' +
      (foldFollow ? '收起拾壹跟进' : '拾壹跟进') + '</button>' + (foldFollow ? '<div class="stack" style="margin-top:8px">' + follows.map(function (it) {
        return '<a class="cloud-row" href="' + safeUrl(it.url || it.chat) + '" target="_blank" rel="noopener noreferrer"><i class="dot ' +
          (it.tone === 'wait' ? 'wait' : 'ok') + '"></i><strong>' + esc(it.name || it.topic) + '</strong><span class="open">打开</span></a>';
      }).join('') + '</div>' : '') + '</section>' : '';
    const taskList = arr(F.tasks);
    const taskBlock = taskList.length ? '<section class="glass"><button type="button" class="btn fold-btn" data-act="fold" data-key="tasks">' +
      (foldTasks ? '收起任务' : '任务') + '</button>' + (foldTasks ? '<div class="stack" style="margin-top:8px">' + taskList.map(function (it) {
        return '<a class="cloud-row" href="' + safeUrl(it.url) + '" target="_blank" rel="noopener noreferrer"><i class="dot ' +
          (it.tone === 'wait' ? 'wait' : 'ok') + '"></i><strong>' + esc(it.name) + '</strong><span class="open">打开</span></a>';
      }).join('') + '</div>' : '') + '</section>' : '';
    return '<div class="feishu">' + route +
      '<div class="split"><section class="glass"><p class="card-kicker">最近云盘</p>' + (rows || emptyInline('云盘是空的', '最近交付会按时间和机器人排成行。')) + more + '</section>' +
      '<section class="glass"><p class="card-kicker">教学产出</p><div class="teach-grid">' + (wall || emptyInline('还没有教学产出', '说明卡、教案和验收会以卡片出现在这里。')) + '</div></section></div>' +
      pdf + followBlock + taskBlock + '</div>';
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
      '<stop offset="0%" stop-color="#1C1C1E" stop-opacity="0.35"/><stop offset="100%" stop-color="#1C1C1E" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#sparkFill)"/><path d="' + line + '" fill="none" stroke="#1C1C1E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.5" fill="#1c1c1e"/></svg>';
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
    if (!H) return empty('健康数据还没到', '周计划、今日训练、晨重、蛋白和睡眠会排在这里。');
    const week = H.week || {};
    const session = H.today || {};
    const p = shanghaiParts(new Date());
    const done = isSessionDone();
    const badges = [];
    if (done) badges.push('<span class="pill ok">完成</span>');
    else if (session.hasTraining && p.hour >= 21) badges.push('<span class="pill bad">漏练</span>');
    if (session.footballEvening) badges.push('<span class="pill wait">足球晚</span>');
    const allSets = arr(session.exercises);
    const visible = setsOpen ? allSets : allSets.slice(0, 3);
    const setHtml = visible.map(function (ex) {
      const load = ex.weight != null && ex.weight !== '' ? ' · ' + esc(ex.weight) + 'kg' : '';
      return '<div class="set-line"><strong>' + esc(ex.name) + '</strong><span>' + esc(ex.sets) + '×' + esc(ex.reps) + load + ' · RIR ' + esc(ex.rir) + '</span></div>';
    }).join('');
    const moreSets = allSets.length > 3 ? '<button type="button" class="btn fold-btn" data-act="sets">' + (setsOpen ? '收起' : '展开其余') + '</button>' : '';
    const w = weightStats();
    const protein = H.protein || { grams: 0, low: 113, high: 156 };
    const grams = proteinGrams();
    const max = Math.max(180, grams, protein.high);
    const bandL = (protein.low / max) * 100;
    const bandW = ((protein.high - protein.low) / max) * 100;
    const fill = Math.min(100, (Math.max(grams, 0) / max) * 100);
    const sleep = H.sleep || {};
    const late = asleepLate(sleep.asleep);
    const shortName = { d3: 'D3', creatine: '肌酸', protein: '蛋白粉', magnesium: '镁' };
    const supps = arr(H.supplements).map(function (s) {
      const on = suppOn(s);
      return '<button type="button" class="supp" data-act="supp" data-key="' + esc(s.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '"><span>' +
        esc(shortName[s.id] || s.name) + '</span><span class="switch' + (on ? ' on' : '') + '" aria-hidden="true"><i></i></span></button>';
    }).join('');
    const todayIso = isoOf(p);
    const dayStrip = arr(week.days).map(function (d) {
      const on = d.date === todayIso;
      return '<div class="day' + (on ? ' is-today' : '') + (d.train ? '' : ' is-off') + '"><span>周' + esc(d.label) + '</span><strong>' +
        esc(d.name) + '</strong><i>' + (d.football ? '球' : '') + '</i></div>';
    }).join('');
    const protNote = grams < protein.low ? '距下沿 ' + (protein.low - grams) + ' g' : (grams > protein.high ? '高出区间' : '落在区间里');
    const spark = w ? '<section class="glass"><div class="bar"><p class="card-kicker">近七日晨重</p><span class="pill dim">目标 ' + esc(w.goal) + ' kg</span></div>' +
      sparkSvg(w.pts) + '<p class="footnote">较七日首日 ' + signed(w.week, 1) + ' kg · 昨日 ' + esc(w.pts[w.pts.length - 2].date.slice(5)) + ' ' + w.pts[w.pts.length - 2].kg.toFixed(1) + '</p></section>' : '';
    return '<div class="health">' +
      '<section class="glass"><div class="plan-bar"><h2>' + esc(week.title || '本周计划') + '</h2>' +
      linkBtn(week.pdf, '打开 PDF', 'btn btn-primary') + '</div>' +
      (dayStrip ? '<div class="days">' + dayStrip + '</div>' : '') +
      (H.review ? '<p class="footnote">' + esc(H.review) + '</p>' : '') + '</section>' +
      '<section class="glass"><div class="bar"><div><p class="card-kicker">今日训练</p><h2 class="card-title">' + esc(session.title || (session.hasTraining ? '训练日' : '休息')) + '</h2></div><div class="pills">' + badges.join('') + '</div></div>' +
      (arr(session.parts).length ? '<p class="check-gray">' + esc(arr(session.parts).join(' · ')) + (session.footballEvening ? ' · 足球晚训' : '') + '</p>' : '') +
      (setHtml || emptyInline('今天没有优先动作', '休息日不排组数。体态维持仍以每日备注为准，不在这里改处方。')) + moreSets + '</section>' +
      '<div class="metric-row">' +
      '<section class="glass metric-cell"><p class="metric-figure"><b class="num">' + (w ? w.last.toFixed(1) : '—') + '</b><span class="unit">kg</span></p><p class="card-kicker">晨重</p>' +
      '<span class="delta ' + (w ? deltaClass(w.day) : 'flat') + '">较昨 ' + (w ? signed(w.day, 1) : '—') + '</span>' +
      (w ? '<span class="fine">七日 ' + signed(w.week, 1) + '</span>' : '') + '</section>' +
      '<section class="glass metric-cell"><p class="metric-figure"><b class="num">' + grams + '</b><span class="unit">g</span></p><p class="card-kicker">蛋白</p>' +
      '<div class="track" aria-hidden="true"><i class="band" style="left:' + bandL.toFixed(1) + '%;width:' + bandW.toFixed(1) + '%"></i><i class="fill" style="width:' + fill.toFixed(1) + '%"></i></div>' +
      '<span class="fine">' + esc(protein.low) + '–' + esc(protein.high) + ' · ' + protNote + '</span></section>' +
      '<section class="glass metric-cell"><p class="metric-figure"><b class="num">' + esc(sleep.hours) + '</b><span class="unit">小时</span></p><p class="card-kicker">睡眠</p>' +
      '<span class="fine">' + (sleep.asleep ? esc(sleep.asleep) + ' · ' : '') + (late ? '偏晚' : (sleep.quality ? esc(sleep.quality) : '在零点前')) + '</span></section></div>' + spark +
      '<section class="glass"><p class="card-kicker">补剂</p><div class="supp-bar">' + supps + '</div></section>' + postureHtml() + '</div>';
  }

  function decisionCard(t) {
    return '<article class="inset" style="padding:14px"><div class="pills"><span class="pill wait">待拍板</span>' +
      (t.priority === 'high' ? '<span class="pill bad">要紧</span>' : '') +
      '<span class="pill dim">' + esc(dueLabel(t.due) || WHO[t.source] || t.source || '') + '</span></div>' +
      '<h2 class="card-title" style="font-size:17px">' + esc(t.text) + '</h2><p class="card-copy">' + esc(t.ask || '') + '</p>' +
      '<div class="actions">' + (arr(t.options).length ? arr(t.options).slice(0, 2) : ['就这样', '以后再说']).map(function (opt, i) {
        return '<button type="button" class="btn' + (i === 0 ? ' btn-primary' : '') + '" data-act="decision" data-id="' + esc(t.id) + '" data-res="' + esc(opt === '以后再说' ? 'later' : opt) + '">' + esc(opt) + '</button>';
      }).join('') + '</div></article>';
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
    }).join('') : emptyInline('待办是空的', '勾掉的会沉到下面「已经处理」。没有新的杂活时，这一列保持空白。');
    const doneHtml = done.length ? '<section class="glass" style="margin-top:14px"><p class="card-kicker">已经处理</p><div class="stack">' +
      done.map(function (t) {
        const res = decisionRes(t);
        const label = res === 'no' ? '这次不做' : res === 'yes' ? '已拍板' : res === 'later' ? '以后再说' : (res || '已完成');
        return '<article class="check" style="cursor:default"><span class="box" style="background:#8B75B8;border-color:transparent"></span><span class="grow"><strong>' +
          esc(t.text) + '</strong><small>' + label + '</small></span><button type="button" class="btn" data-act="undo" data-id="' + esc(t.id) + '">撤回</button></article>';
      }).join('') + '</div></section>' : '';
    return head('拍板', '要你点头的事', '先拍板，再勾掉今天的待办。投资条目不在这张主清单里。') +
      '<div class="decide"><section class="glass"><p class="card-kicker">待拍板</p><div class="stack">' +
      (open.length ? open.map(decisionCard).join('') : emptyInline('没有等你点头的事', '需要你选的条目会出现在这里，两个按钮就够。投资待办留在纪律备忘。')) + laterHtml +
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
    const mark = '<span class="mark" role="img" aria-label="拾壹"><span class="mark-glyph" aria-hidden="true">壹</span></span>';
    const dateBit = '<span class="top-date js-date"' + (shell === 'mobile' ? ' data-compact="1"' : '') + '></span>';
    const shellLink = shell === 'desktop'
      ? '<a class="quiet-link" id="shellLink" href="index.html">手机版</a>'
      : '<a class="quiet-link" id="shellLink" href="desktop.html">宽屏</a>';
    const memoTop = shell === 'mobile'
      ? '<button type="button" data-memo><span class="js-memo-label" data-short="纪律">纪律</span></button>'
      : '';
    document.getElementById('app').innerHTML =
      '<div class="ambient" aria-hidden="true"><i class="orb a"></i><i class="orb b"></i><i class="orb c"></i></div>' +
      '<div class="shell"><aside class="rail">' +
      '<div class="rail-label">模块</div>' + rail +
      '<div class="rail-foot"><button type="button" data-memo><span class="js-memo-label">纪律备忘</span><small>投资已降权</small></button></div></aside>' +
      '<main class="stage" id="stage"><header class="topbar">' + mark +
      '<div class="top-meta">' + dateBit + shellLink + memoTop +
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
    const dock = document.querySelector('.dock');
    const dockOn = dock && dock.querySelector('.dock-item.active');
    if (dock && dockOn && dock.scrollWidth > dock.clientWidth + 4) {
      dock.scrollLeft = Math.max(0, dockOn.offsetLeft - (dock.clientWidth - dockOn.offsetWidth) / 2);
    }
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
    document.querySelectorAll('.js-date').forEach(function (el) { el.textContent = dateLabel(p, el.dataset.compact === '1'); });
    const lever = document.getElementById('leverState');
    const dot = document.getElementById('leverDot');
    if (lever && data.health) {
      const label = leverLabel(p, data.health.sleep);
      lever.textContent = label;
      if (dot) dot.className = 'dot ' + (label === '已达成' ? 'done' : label === '已踩线' ? 'line' : 'wait');
    }
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
      else if (name === 'top3') {
        const item = arr(data.todos && data.todos.top3).filter(function (x) { return String(x.id) === String(id); })[0];
        if (item) state.top3Done[id] = !isTop3Done(item);
      }
      else if (name === 'note') { noteOpen = !noteOpen; paint(false); return; }
      else if (name === 'sets') { setsOpen = !setsOpen; paint(false); return; }
      else if (name === 'cloud') { cloudMore = !cloudMore; paint(false); return; }
      else if (name === 'fold') {
        if (act.dataset.key === 'follow') foldFollow = !foldFollow;
        if (act.dataset.key === 'tasks') foldTasks = !foldTasks;
        paint(false);
        return;
      }
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
      setInterval(tick, 60000);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
  boot();
})();
