import { finishedJoinFirst, firstRound, maxWait, nextGame, replacePlayer, shuffle, women } from './draw.js';
import * as store from './store.js';

const app = document.getElementById('app');

let session = store.loadSession();
let draft = store.loadDraft();
let roster = store.loadRoster();
let view = session ? 'live' : 'setup';
let pending = null;   // a drawn game that hasn't started: { court, players, teams, queue, finished, before, away }
let replacing = false;
let modal = null;     // 'menu' | 'late' | 'break' | 'end'
let sheet = null;     // past players picker: { sort, query, selected }
let notice = '';
let lateSex = 'F';
let focusAfter = null;

// ---------- Helpers ----------

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const player = id => session.players[id];
const ids = list => list.map(p => p.id);

function formatDate(iso, weekday = false) {
  if (!iso) return '';
  const opts = { day: 'numeric', month: 'short', ...(weekday && { weekday: 'short' }) };
  return new Date(`${iso}T00:00`).toLocaleDateString(undefined, opts);
}

function elapsed(since) {
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function parseSex(text) {
  const v = (text ?? '').trim().toLowerCase();
  if (['f', 'female', 'w', 'woman'].includes(v)) return 'F';
  if (['m', 'male', 'man'].includes(v)) return 'M';
  return null;
}

// One "name,sex" per line. A missing sex falls back to the saved player, then to `fallback`.
function parseList(text, fallback) {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const [name, sex] = line.split(/[,;\t]/);
    const clean = name.trim();
    return { name: clean, sex: parseSex(sex) ?? roster[store.rosterKey(clean)]?.sex ?? fallback };
  }).filter(p => p.name);
}

function addToDraft(entries) {
  const have = new Set(draft.players.map(p => store.rosterKey(p.name)));
  for (const e of entries) {
    const key = store.rosterKey(e.name);
    if (have.has(key)) continue;
    have.add(key);
    draft.players.push({ name: e.name, sex: e.sex });
  }
  store.saveDraft(draft);
}

const save = () => store.saveSession(session);

function waitText(waiting) {
  if (waiting <= 0) return 'waiting';
  return `waiting · max ${plural(maxWait(waiting), 'game')} out in a row`;
}

function balanceText(a, b) {
  const fa = women(a), fb = women(b);
  if (fa !== fb) return `As even as possible · ${fa} vs ${fb} women`;
  if (fa === 0) return 'Balanced · all men';
  if (fa === 2) return 'Balanced · all women';
  return 'Balanced · 1 woman on each side';
}

// ---------- Icons ----------

const svg = (body, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icon = {
  shuttle: svg('<circle cx="7" cy="17" r="3"/><path d="M9 15l9-9"/><path d="M14 4l6 6"/><path d="M16 5l-2 5 5-2"/>'),
  dice: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/>'),
  dots: svg('<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>', 22),
  close: svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 22),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 18),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18.5 14.5a6.5 6.5 0 0 1 3 5.5"/>', 18),
  chevron: svg('<path d="M9 6l6 6-6 6"/>', 16),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>', 18),
  check: svg('<path d="M5 12l5 5 9-10"/>', 14),
  scale: svg('<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0z"/><path d="M19 7l-3 7a3 3 0 0 0 6 0z"/>', 16)
};

const badge = sex => `<span class="sex ${sex === 'F' ? 'f' : 'm'}">${sex}</span>`;

function segButtons(current, action) {
  return ['F', 'M'].map(s => `<button type="button" data-action="${action}" data-sex="${s}" aria-pressed="${current === s}" aria-label="${s === 'F' ? 'Female' : 'Male'}">${s}</button>`).join('');
}

function teamsView(a, b) {
  return `<div class="teams">
    <div class="side">${a.map(p => `<span class="who">${badge(p.sex)}${esc(p.name)}</span>`).join('')}</div>
    <span class="vs">vs</span>
    <div class="side right">${b.map(p => `<span class="who">${esc(p.name)}${badge(p.sex)}</span>`).join('')}</div>
  </div>`;
}

// ---------- New session ----------

function setupView() {
  const n = draft.players.length;
  const f = women(draft.players);
  const courts = Math.min(draft.courts, Math.floor(n / 4));
  const waiting = n - courts * 4;
  const saved = Object.keys(roster).length;
  return `
<div class="screen">
  <header class="topbar">
    <div class="brand"><span class="logo">${icon.shuttle}</span><span class="h1">Randminton</span></div>
    <span class="muted">New session</span>
  </header>
  <main class="stack">
    <section class="card row">
      <div class="grow"><span class="label" id="courts-label">Courts</span><span class="hint">4 players per court</span></div>
      <div class="stepper" role="group" aria-labelledby="courts-label">
        <button class="square" data-action="courts" data-step="-1" aria-label="Remove a court" ${draft.courts <= 1 ? 'disabled' : ''}>−</button>
        <span class="big-num" aria-live="polite">${draft.courts}</span>
        <button class="square primary" data-action="courts" data-step="1" aria-label="Add a court" ${draft.courts >= 20 ? 'disabled' : ''}>+</button>
      </div>
    </section>

    <section class="card stack-sm">
      <div class="row baseline"><label class="label grow" for="add-name">Players</label><span class="hint">${n} added · ${f} F · ${n - f} M</span></div>
      <form class="add-row" data-form="add">
        <input class="field" id="add-name" name="name" placeholder="Name" autocomplete="off" enterkeyhint="done">
        <div class="seg" role="group" aria-label="Sex">${segButtons(draft.sex, 'sex')}</div>
        <button class="btn primary" type="submit">Add</button>
      </form>
      <p class="hint">Or paste a list, one per line as <strong>name,sex</strong>, e.g. Ana,F</p>
      ${n ? `<ul class="chips">${draft.players.map((p, i) => `
        <li class="chip"><button class="sex-btn" data-action="flip" data-index="${i}" aria-label="${esc(p.name)}: ${p.sex === 'F' ? 'female' : 'male'}. Change">${badge(p.sex)}</button>${esc(p.name)}<button class="chip-x" data-action="remove" data-index="${i}" aria-label="Remove ${esc(p.name)}">×</button></li>`).join('')}
      </ul>` : ''}
      ${saved ? `<button class="btn outline wide" data-action="open-sheet">${icon.users}<span class="grow left">Pick from past players</span><span class="muted">${saved} saved</span>${icon.chevron}</button>` : ''}
    </section>

    <section class="tiles">
      <div class="tile green"><span class="tile-num">${courts * 4}</span><span>on court first round</span></div>
      <div class="tile"><span class="tile-num">${Math.max(0, waiting)}</span><span class="muted">${waitText(waiting)}</span></div>
    </section>
    ${n >= 4 && courts < draft.courts ? `<p class="hint">Enough players for ${plural(courts, 'court')}. The other courts start empty.</p>` : ''}
  </main>
  <footer class="footer">
    <button class="btn lime big wide" data-action="start" ${n < 4 ? 'disabled' : ''}>${icon.dice}Randomise first games</button>
  </footer>
</div>
${sheet ? sheetView() : ''}`;
}

function rosterList() {
  return Object.entries(roster).map(([key, r]) => ({ key, ...r }));
}

function sheetView() {
  const all = rosterList();
  const last = all.reduce((m, r) => (r.last > m ? r.last : m), '');
  const lastCount = all.filter(r => r.last === last).length;
  const selected = [...sheet.selected].map(k => roster[k]);
  const f = women(selected);
  const sorts = [['recent', 'Recent first'], ['most', 'Most played'], ['az', 'A–Z']];
  return `
<div class="overlay" data-action="close-sheet" data-backdrop>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="handle"></div>
    <header class="row">
      <div class="grow"><h2 class="h1" id="sheet-title">Past players</h2><span class="hint">${all.length} saved · sex remembered</span></div>
      <button class="square ghost" data-action="close-sheet" aria-label="Close">${icon.close}</button>
    </header>
    <div class="search">${icon.search}<label class="sr" for="sheet-search">Search past players</label><input class="field" id="sheet-search" placeholder="Search names" value="${esc(sheet.query)}" autocomplete="off"></div>
    <div class="pills" role="group" aria-label="Sort">${sorts.map(([k, l]) => `<button class="pill" data-action="sort" data-sort="${k}" aria-pressed="${sheet.sort === k}">${l}</button>`).join('')}</div>
    <button class="btn soft wide" data-action="select-last">${icon.history}<span class="grow left">Select everyone from last session</span><span class="muted">${formatDate(last, true)} · ${lastCount}</span></button>
    <div class="row baseline"><h3 class="caps grow">Tap to add</h3><span class="hint" aria-live="polite">${selected.length} selected · ${f} F · ${selected.length - f} M</span></div>
    <ul class="pick-list" id="pick-list" data-keep-scroll>${pickRows()}</ul>
    <button class="btn green big wide" data-action="add-selected" ${selected.length ? '' : 'disabled'}>Add ${plural(selected.length, 'player')}</button>
  </div>
</div>`;
}

function pickRows() {
  const inDraft = new Set(draft.players.map(p => store.rosterKey(p.name)));
  const q = sheet.query.trim().toLowerCase();
  const order = {
    recent: (a, b) => b.last.localeCompare(a.last) || b.count - a.count || a.name.localeCompare(b.name),
    most: (a, b) => b.count - a.count || b.last.localeCompare(a.last),
    az: (a, b) => a.name.localeCompare(b.name)
  }[sheet.sort];
  const rows = rosterList().filter(r => r.name.toLowerCase().includes(q)).sort(order);
  if (!rows.length) return `<li class="empty-list">No saved player matches “${esc(sheet.query)}”.</li>`;
  return rows.map(r => {
    const added = inDraft.has(r.key);
    const on = added || sheet.selected.has(r.key);
    return `<li><button class="pick" data-action="pick" data-key="${esc(r.key)}" aria-pressed="${on}" ${added ? 'disabled' : ''}>
      <span class="check">${icon.check}</span>${badge(r.sex)}<span class="name">${esc(r.name)}</span>
      <span class="note">${added ? 'Added' : `${formatDate(r.last)} · ${r.count}×`}</span></button></li>`;
  }).join('');
}

function start() {
  const players = draft.players.map((p, i) => ({ id: `p${i}`, name: p.name, sex: p.sex }));
  const round = firstRound(players, draft.courts);
  const now = Date.now();
  session = {
    players: Object.fromEntries(players.map(p => [p.id, p])),
    nextId: players.length,
    courts: Array.from({ length: draft.courts }, (_, i) => round.courts[i]
      ? { teams: round.courts[i].teams.map(ids), startedAt: now }
      : { teams: null, startedAt: null }),
    queue: ids(round.queue),
    onBreak: [],
    games: round.courts.length
  };
  roster = store.remember(roster, players, today());
  store.saveRoster(roster);
  save();
  notice = '';
  view = 'live';
}

// ---------- Live session ----------

function liveView() {
  const everyone = Object.values(session.players);
  const f = women(everyone);
  const waiting = session.queue.map(player);
  const fw = women(waiting);
  return `
<div class="screen live">
  <header class="topbar">
    <div><h1 class="h1">Tonight’s session</h1><span class="hint">${plural(session.courts.length, 'court')} · ${everyone.length} players (${f} F) · game ${session.games}</span></div>
    <button class="square outline" data-action="modal" data-modal="menu" aria-label="Session menu">${icon.dots}</button>
  </header>
  ${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}
  <div class="live-grid">
    <section class="courts" aria-labelledby="on-court">
      <h2 class="caps" id="on-court">On court</h2>
      <div class="court-list">${session.courts.map(courtCard).join('')}</div>
    </section>
    <section class="waiting" aria-labelledby="waiting-title">
      <div class="row baseline"><h2 class="caps grow" id="waiting-title">Waiting · ${waiting.length}${fw ? ` · ${fw} F` : ''}</h2><span class="hint">#1 always plays next</span></div>
      ${waiting.length ? `<ol class="queue">${waiting.map((p, i) => `
        <li class="${i === 0 ? 'first' : ''}"><span class="pos">${i + 1}</span><span class="name">${badge(p.sex)}${esc(p.name)}</span>${i === 0 ? '<span class="tag">Next in</span>' : ''}</li>`).join('')}
      </ol>` : '<p class="hint">Nobody is waiting.</p>'}
      <div class="row">
        <button class="btn outline grow" data-action="modal" data-modal="late">Add late player</button>
        <button class="btn outline grow" data-action="modal" data-modal="break" ${waiting.length ? '' : 'disabled'}>Take a break</button>
      </div>
      ${session.onBreak.length ? `
        <h3 class="caps">On a break · ${session.onBreak.length}</h3>
        <ul class="chips">${session.onBreak.map(player).map(p => `<li class="chip">${badge(p.sex)}${esc(p.name)}<button class="chip-back" data-action="back" data-id="${p.id}">Back in</button></li>`).join('')}</ul>` : ''}
    </section>
  </div>
</div>
${modal ? modalView() : ''}`;
}

function courtCard(c, i) {
  if (!c.teams) {
    return `<article class="court empty">
      <div class="row"><span class="court-name grow">Court ${i + 1}</span><span class="timer">Empty</span></div>
      <button class="btn lime wide" data-action="free" data-court="${i}">Fill court</button>
    </article>`;
  }
  const [a, b] = c.teams.map(t => t.map(player));
  return `<article class="court">
    <div class="row"><span class="court-name grow">Court ${i + 1}</span><span class="timer" data-since="${c.startedAt}">${elapsed(c.startedAt)}</span></div>
    ${teamsView(a, b)}
    <button class="btn lime wide" data-action="free" data-court="${i}">Court free</button>
  </article>`;
}

function modalView() {
  const body = {
    menu: () => `
      <h2 class="h1" id="modal-title">Session</h2>
      <button class="btn outline wide" data-action="modal" data-modal="late">Add late player</button>
      <button class="btn danger wide" data-action="modal" data-modal="end">End session</button>
      <button class="btn wide" data-action="close-modal">Close</button>`,
    late: () => `
      <h2 class="h1" id="modal-title">Add late player</h2>
      <p class="hint">They join the end of the waiting list.</p>
      <form class="add-row" data-form="late">
        <label class="sr" for="late-name">Name</label>
        <input class="field" id="late-name" name="name" placeholder="Name" autocomplete="off" list="late-suggest">
        <div class="seg" role="group" aria-label="Sex">${segButtons(lateSex, 'late-sex')}</div>
        <button class="btn primary" type="submit">Add</button>
      </form>
      <datalist id="late-suggest">${rosterList().filter(r => !Object.values(session.players).some(p => store.rosterKey(p.name) === r.key)).map(r => `<option value="${esc(r.name)}"></option>`).join('')}</datalist>
      <button class="btn wide" data-action="close-modal">Cancel</button>`,
    break: () => `
      <h2 class="h1" id="modal-title">Who’s taking a break?</h2>
      <p class="hint">They leave the waiting list until you tap “Back in”.</p>
      <div class="choice-grid">${session.queue.map(player).map(p => `<button class="btn outline" data-action="break-player" data-id="${p.id}">${badge(p.sex)}${esc(p.name)}</button>`).join('')}</div>
      <button class="btn wide" data-action="close-modal">Cancel</button>`,
    end: () => `
      <h2 class="h1" id="modal-title">End this session?</h2>
      <p class="hint">Courts and the waiting list are cleared. Players stay saved in past players.</p>
      <button class="btn danger wide" data-action="confirm-end">End session</button>
      <button class="btn wide" data-action="close-modal">Keep playing</button>`
  }[modal];
  return `<div class="overlay" data-action="close-modal" data-backdrop><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">${body()}</div></div>`;
}

function addLate(entry) {
  if (!entry.name) return;
  const key = store.rosterKey(entry.name);
  if (Object.values(session.players).some(p => store.rosterKey(p.name) === key)) {
    notice = `${entry.name} is already in this session.`;
    modal = null;
    return;
  }
  const p = { id: `p${session.nextId++}`, name: entry.name, sex: entry.sex };
  session.players[p.id] = p;
  session.queue.push(p.id);
  roster = store.remember(roster, [p], today());
  store.saveRoster(roster);
  save();
  notice = `${p.name} joined the waiting list at #${session.queue.length}.`;
  modal = null;
}

// ---------- Draw ----------

function drawFor(i) {
  const court = session.courts[i];
  const finished = court.teams ? court.teams.flat().map(player) : [];
  const game = nextGame(session.queue.map(player), finished);
  if (!game) {
    session.courts[i] = { teams: null, startedAt: null };
    session.queue.push(...ids(shuffle(finished)));
    save();
    notice = `Not enough players to fill Court ${i + 1}. It stays empty for now.`;
    return;
  }
  pending = { court: i, ...game, finished, before: session.queue.slice(), away: [] };
  replacing = false;
  notice = '';
  view = 'draw';
}

function drawView() {
  const g = pending;
  const [a, b] = g.teams;
  const waiting = g.before.map(player);
  const joinFirst = finishedJoinFirst(waiting.length);
  const label = p => {
    const i = g.before.indexOf(p.id);
    if (i === 0) return 'Was #1 · guaranteed';
    return i > 0 ? `Drawn · was #${i + 1}` : 'Just played · drawn';
  };
  const slot = p => {
    const cls = `slot${g.before.indexOf(p.id) === 0 ? ' guaranteed' : ''}`;
    const inner = `<span class="slot-label">${label(p)}</span><span class="slot-name">${badge(p.sex)}${esc(p.name)}</span>`;
    return replacing
      ? `<button class="${cls}" data-action="replace" data-id="${p.id}" aria-label="Replace ${esc(p.name)}">${inner}</button>`
      : `<div class="${cls}">${inner}</div>`;
  };
  const resting = g.finished.filter(p => !g.players.includes(p));
  const queueNote = (p, i) => {
    const was = g.before.indexOf(p.id);
    const from = g.finished.includes(p) ? 'just played' : `was #${was + 1}`;
    return i === 0 ? `next in · ${from}` : from;
  };
  return `
<div class="screen">
  <header class="topbar start">
    <button class="square ghost" data-action="cancel-draw" aria-label="Back to session">${icon.back}</button>
    <h1 class="h1">Court ${g.court + 1} is free</h1>
  </header>
  <section class="draw-card dark" aria-labelledby="next-title">
    <div class="row baseline"><h2 class="caps lime-text grow" id="next-title">Next game</h2><span class="hint on-dark">drawn from ${waiting.length} waiting${joinFirst && g.finished.length ? ` + ${g.finished.length} just finished` : ` · ${women(waiting)} F`}</span></div>
    ${replacing ? '<p class="hint on-dark">Tap the player who isn’t here. They go on a break and someone else is drawn.</p>' : ''}
    ${notice ? `<p class="hint on-dark" role="status">${esc(notice)}</p>` : ''}
    <div class="drawn">${g.players.map(slot).join('')}</div>
    <div class="teams-box">${teamsView(a, b)}<div class="balance">${icon.scale}${balanceText(a, b)}</div></div>
    <button class="btn lime big wide" data-action="start-game">Start game on Court ${g.court + 1}</button>
    <button class="btn outline-dark wide" data-action="toggle-replace">${replacing ? 'Cancel' : 'Someone’s missing? Replace a player'}</button>
  </section>
  ${g.away.length ? `<section class="pad stack-sm"><h2 class="caps">Going on a break</h2><ul class="chips">${g.away.map(p => `<li class="chip">${badge(p.sex)}${esc(p.name)}</li>`).join('')}</ul></section>` : ''}
  ${resting.length && joinFirst ? `
  <section class="pad stack-sm">
    <h2 class="caps">Just finished · back in the list</h2>
    <ul class="chips">${resting.map(p => `<li class="chip">${badge(p.sex)}${esc(p.name)}</li>`).join('')}</ul>
    <p class="hint">With 4 or fewer waiting, the players who just finished join the end of the list before the draw, so the groups keep mixing.</p>
  </section>` : ''}
  ${resting.length && !joinFirst ? `
  <section class="pad stack-sm">
    <h2 class="caps">Just finished · resting</h2>
    <ul class="chips">${resting.map(p => `<li class="chip rested">${esc(p.name)}</li>`).join('')}</ul>
    <p class="hint">Not in this draw, because more than 4 people are waiting. They join the end of the queue.</p>
  </section>` : ''}
  <section class="pad stack-sm">
    <h2 class="caps">New queue</h2>
    ${g.queue.length ? `<ol class="queue compact">${g.queue.map((p, i) => `
      <li class="${i === 0 ? 'first' : ''}"><span class="pos">${i + 1}</span><span class="name">${badge(p.sex)}${esc(p.name)}</span><span class="note">${queueNote(p, i)}</span></li>`).join('')}
    </ol>` : '<p class="hint">Nobody left waiting.</p>'}
  </section>
</div>`;
}

// ---------- Rendering ----------

function render() {
  // Keep what the person was doing: typed text, focus and list scroll survive a redraw.
  const active = document.activeElement?.id;
  const values = {};
  app.querySelectorAll('input[id]').forEach(el => { values[el.id] = el.value; });
  const scroll = {};
  app.querySelectorAll('[data-keep-scroll]').forEach(el => { scroll[el.id] = el.scrollTop; });

  app.innerHTML = view === 'setup' ? setupView() : view === 'draw' ? drawView() : liveView();

  for (const [id, v] of Object.entries(values)) {
    const el = document.getElementById(id);
    if (el && el.id !== 'sheet-search') el.value = v;
  }
  for (const [id, top] of Object.entries(scroll)) {
    const el = document.getElementById(id);
    if (el) el.scrollTop = top;
  }
  const target = focusAfter ? app.querySelector(focusAfter) : active ? document.getElementById(active) : null;
  target?.focus();
  focusAfter = null;
  document.body.style.overflow = sheet || modal ? 'hidden' : '';
}

const actions = {
  courts: t => {
    draft.courts = Math.max(1, Math.min(20, draft.courts + Number(t.dataset.step)));
    store.saveDraft(draft);
  },
  sex: t => {
    draft.sex = t.dataset.sex;
    store.saveDraft(draft);
    focusAfter = '#add-name';
  },
  flip: t => {
    const p = draft.players[t.dataset.index];
    p.sex = p.sex === 'F' ? 'M' : 'F';
    store.saveDraft(draft);
  },
  remove: t => {
    draft.players.splice(Number(t.dataset.index), 1);
    store.saveDraft(draft);
  },
  'open-sheet': () => {
    sheet = { sort: 'recent', query: '', selected: new Set() };
    focusAfter = '#sheet-search';
  },
  'close-sheet': () => { sheet = null; },
  sort: t => { sheet.sort = t.dataset.sort; },
  pick: t => {
    const key = t.dataset.key;
    if (sheet.selected.has(key)) sheet.selected.delete(key);
    else sheet.selected.add(key);
  },
  'select-last': () => {
    const all = rosterList();
    const last = all.reduce((m, r) => (r.last > m ? r.last : m), '');
    const inDraft = new Set(draft.players.map(p => store.rosterKey(p.name)));
    for (const r of all) if (r.last === last && !inDraft.has(r.key)) sheet.selected.add(r.key);
  },
  'add-selected': () => {
    addToDraft([...sheet.selected].map(k => roster[k]));
    sheet = null;
  },
  start: () => {
    start();
    window.scrollTo(0, 0);
  },
  modal: t => {
    modal = t.dataset.modal;
    if (modal === 'late') focusAfter = '#late-name';
  },
  'close-modal': () => { modal = null; },
  'late-sex': t => {
    lateSex = t.dataset.sex;
    focusAfter = '#late-name';
  },
  'break-player': t => {
    session.queue = session.queue.filter(id => id !== t.dataset.id);
    session.onBreak.push(t.dataset.id);
    save();
    modal = null;
  },
  back: t => {
    session.onBreak = session.onBreak.filter(id => id !== t.dataset.id);
    session.queue.push(t.dataset.id);
    save();
    notice = `${player(t.dataset.id).name} is back, at #${session.queue.length}.`;
  },
  'confirm-end': () => {
    session = null;
    store.saveSession(null);
    draft.players = [];
    store.saveDraft(draft);
    modal = null;
    notice = '';
    view = 'setup';
  },
  free: t => {
    drawFor(Number(t.dataset.court));
    window.scrollTo(0, 0);
  },
  'cancel-draw': () => {
    pending = null;
    notice = '';
    view = 'live';
  },
  'toggle-replace': () => {
    replacing = !replacing;
    notice = '';
  },
  replace: t => {
    const missing = player(t.dataset.id);
    const next = replacePlayer(pending, missing);
    replacing = false;
    if (!next) {
      notice = 'Nobody is free to replace them.';
      return;
    }
    notice = '';
    pending = { ...pending, ...next, away: [...pending.away, missing] };
  },
  'start-game': () => {
    const g = pending;
    session.courts[g.court] = { teams: g.teams.map(ids), startedAt: Date.now() };
    session.queue = ids(g.queue);
    session.onBreak.push(...ids(g.away));
    session.games++;
    save();
    pending = null;
    view = 'live';
  }
};

app.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t || t.disabled) return;
  // A backdrop only closes when the click lands on the backdrop itself.
  if ('backdrop' in t.dataset && e.target !== t) return;
  notice = '';
  actions[t.dataset.action]?.(t);
  render();
});

app.addEventListener('submit', e => {
  e.preventDefault();
  const input = e.target.elements.name;
  const text = input.value.trim();
  const late = e.target.dataset.form === 'late';
  const sex = late ? lateSex : draft.sex;
  // A plain typed name uses the F/M toggle; "name,sex" text uses its own sex.
  const entries = !text ? [] : /[\n,;\t]/.test(text) ? parseList(text, sex) : [{ name: text, sex }];
  input.value = '';
  if (late) {
    if (entries[0]) addLate(entries[0]);
  } else {
    addToDraft(entries);
    focusAfter = '#add-name';
  }
  render();
});

// Pasting a list into the name box adds every line at once.
app.addEventListener('paste', e => {
  if (e.target.id !== 'add-name') return;
  const text = e.clipboardData.getData('text');
  if (!/[\n,;\t]/.test(text.trim())) return;
  e.preventDefault();
  addToDraft(parseList(text, draft.sex));
  focusAfter = '#add-name';
  render();
});

app.addEventListener('input', e => {
  if (e.target.id !== 'sheet-search') return;
  sheet.query = e.target.value;
  document.getElementById('pick-list').innerHTML = pickRows();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !(sheet || modal)) return;
  sheet = null;
  modal = null;
  render();
});

setInterval(() => {
  document.querySelectorAll('[data-since]').forEach(el => { el.textContent = elapsed(Number(el.dataset.since)); });
}, 1000);

render();
