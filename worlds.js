// Вкладка «Миры»: состав игры по мирам, как он есть сейчас (worlds_data.js собирает worlds_build.py из самой игры).
// Создатель может переставлять персонажей (мышью или «взять ✥ → нажать место»), править числа, добавлять и убирать умения.
// Всё хранится в браузере (localStorage); «Скачать JSON» — список изменений и полное состояние для Клода. На игру не влияет.
'use strict';
const KEY = 'da_worlds_v1';
const $ = (s, r) => (r || document).querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => n == null || n === '' ? '—' : String(Math.round(n * 100) / 100).replace('.', ',');
const SLOTS = [['mel', 'Ближний бой'], ['rng', 'Стрелки'], ['elite', 'Элита'], ['mini', 'Мини-боссы'], ['boss', 'Босс']];
const SLOT_RU = { mel: 'ближний бой', rng: 'стрелки', elite: 'элита', mini: 'мини-боссы', boss: 'босс', pool: 'запас' };
const SLOT_HINT = { mel: 'выходят в каждой волне, их больше всех', rng: 'четверть волны (в мире 1 — 15 %)', elite: 'с волны 4 — один, с волны 7 — два, ближе к концу волны',
  mini: 'по порядку: в конце волны 3, 6 и 9', boss: 'волна 10' };
const CLS_RU = { rank: 'рядовой', elite: 'элита', mini: 'мини-босс', boss: 'босс', summon: 'призванный' };
const PASSIVE = 1e8;
const FIELDS = [['hp', 'Здоровье'], ['d0', 'Урон от'], ['d1', 'Урон до'], ['atk', 'Удар раз в, с'], ['speed', 'Скорость бега'], ['reach', 'Дальность удара'],
  ['want', 'Держит дистанцию'], ['shot', 'Дальность выстрела'], ['xp', 'Опыт за него'], ['gold', 'Золото за него'], ['w', 'Доля в волне']];
const FIELD_RU = { hp: 'здоровье', d0: 'урон от', d1: 'урон до', atk: 'удар раз в', speed: 'скорость', reach: 'дальность удара', want: 'дистанция', shot: 'дальность выстрела',
  xp: 'опыт', gold: 'золото', w: 'доля в волне', range: 'дальность', cd: 'перезарядка', first: 'первый раз через', mana: 'мана' };

// ---------- состояние ----------
function defaults() {
  const S = { ver: 1, gameVer: WD.ver, slots: {}, pool: WD.pool.slice(), chars: {}, heroes: {} };
  for (const w of WD.worlds) { S.slots[w.n] = {}; for (const [k] of SLOTS) S.slots[w.n][k] = w.slots[k].slice(); }
  for (const id in WD.chars) {
    const c = WD.chars[id], wt = (WD.worlds.find(w => w.n === c.world) || {}).weight || {};
    S.chars[id] = { hp: c.hp, d0: c.dmg ? c.dmg[0] : null, d1: c.dmg ? c.dmg[1] : null, atk: c.atk, speed: c.speed, reach: c.reach, want: c.want, shot: c.shot, xp: c.xp, gold: c.gold,
      w: c.cls === 'rank' ? (wt[id] || 1) : null, skills: c.skills.map(sid => ({ sid, cd: WD.skills[sid].cd, first: WD.skills[sid].first })) };
  }
  for (const h of WD.heroes) S.heroes[h.id] = { hp: h.hp, range: h.range, atk: h.atk, skills: h.skills.map(s => ({ cd: s.cd, mana: s.mana })) };
  return S;
}
const D0 = defaults();
let S = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.ver === 1 && s.slots && s.chars) return fit(s);
  } catch (e) {}
  return defaults();
}
// подгонка сохранённого под текущие данные игры: новые персонажи — на свои места, исчезнувшие — убрать
function fit(s) {
  const seen = new Set();
  const keep = a => (a || []).filter(id => WD.chars[id] && !seen.has(id) && seen.add(id));
  for (const w of WD.worlds) { s.slots[w.n] = s.slots[w.n] || {}; for (const [k] of SLOTS) s.slots[w.n][k] = keep(s.slots[w.n][k]); }
  s.pool = keep(s.pool);
  for (const id in WD.chars) {
    if (!s.chars[id]) s.chars[id] = JSON.parse(JSON.stringify(D0.chars[id]));
    s.chars[id].skills = (s.chars[id].skills || []).filter(k => WD.skills[k.sid]);
    if (!seen.has(id)) { const p = place(D0, id); (p.w === 'pool' ? s.pool : s.slots[p.w][p.k]).push(id); }
  }
  for (const id in s.chars) if (!WD.chars[id]) delete s.chars[id];
  s.heroes = s.heroes || {};
  for (const h of WD.heroes) if (!s.heroes[h.id] || s.heroes[h.id].skills.length !== h.skills.length) s.heroes[h.id] = JSON.parse(JSON.stringify(D0.heroes[h.id]));
  s.gameVer = WD.ver;
  return s;
}
function place(st, id) {
  for (const n in st.slots) for (const k in st.slots[n]) { const i = st.slots[n][k].indexOf(id); if (i >= 0) return { w: +n, k, i }; }
  return { w: 'pool', k: 'pool', i: st.pool.indexOf(id) };
}
const rowOf = (w, k) => w === 'pool' ? S.pool : S.slots[w][k];
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} head(); }
const where = p => p.w === 'pool' ? 'запас' : 'мир ' + p.w + ', ' + SLOT_RU[p.k];

// ---------- список изменений ----------
function changes() {
  const out = [];
  for (const id in WD.chars) {
    const c = WD.chars[id], a = place(D0, id), b = place(S, id);
    if (a.w !== b.w || a.k !== b.k) out.push({ t: 'move', id, text: '«' + c.name + '»: ' + where(a) + ' → ' + where(b) });
    const x = D0.chars[id], y = S.chars[id];
    for (const [f] of FIELDS) if ((x[f] == null ? null : +x[f]) !== (y[f] == null || y[f] === '' ? null : +y[f])) out.push({ t: 'stat', id, f, from: x[f], to: y[f], text: '«' + c.name + '»: ' + FIELD_RU[f] + ' ' + fmt(x[f]) + ' → ' + fmt(y[f]) });
    const xs = x.skills.map(k => k.sid), ys = y.skills.map(k => k.sid);
    for (const k of y.skills) {
      const sk = WD.skills[k.sid];
      if (!xs.includes(k.sid)) { out.push({ t: 'skill+', id, sid: k.sid, cd: k.cd, first: k.first, text: '«' + c.name + '»: добавлено умение «' + sk.name + '» (от «' + sk.ownerName + '»)' + (k.cd && k.cd < PASSIVE ? ', раз в ' + fmt(k.cd) + ' с' : '') }); continue; }
      const o = x.skills[xs.indexOf(k.sid)];
      for (const f of ['cd', 'first']) if ((o[f] == null ? null : +o[f]) !== (k[f] == null || k[f] === '' ? null : +k[f])) out.push({ t: 'skillparam', id, sid: k.sid, f, from: o[f], to: k[f], text: '«' + c.name + '» · «' + sk.name + '»: ' + FIELD_RU[f] + ' ' + fmt(o[f]) + ' → ' + fmt(k[f]) + ' с' });
    }
    for (const sid of xs) if (!ys.includes(sid)) out.push({ t: 'skill-', id, sid, text: '«' + c.name + '»: убрано умение «' + WD.skills[sid].name + '»' });
  }
  for (const w of WD.worlds) for (const [k] of SLOTS) {
    const a = D0.slots[w.n][k], b = S.slots[w.n][k];
    if (a.length === b.length && a.every(x => b.includes(x)) && a.join() !== b.join()) out.push({ t: 'order', w: w.n, k, to: b.slice(), text: 'Мир ' + w.n + ', ' + SLOT_RU[k] + ': новый порядок — ' + b.map(x => WD.chars[x].name).join(', ') });
  }
  for (const h of WD.heroes) {
    const x = D0.heroes[h.id], y = S.heroes[h.id];
    for (const f of ['hp', 'range', 'atk']) if (+x[f] !== +y[f]) out.push({ t: 'hero', id: h.id, f, from: x[f], to: y[f], text: h.name + ': ' + ({ hp: 'здоровье', range: 'дальность', atk: 'выстрел раз в' }[f]) + ' ' + fmt(x[f]) + ' → ' + fmt(y[f]) });
    h.skills.forEach((s, i) => { for (const f of ['cd', 'mana']) if (+x.skills[i][f] !== +y.skills[i][f]) out.push({ t: 'heroskill', id: h.id, skill: s.name, f, from: x.skills[i][f], to: y.skills[i][f], text: h.name + ' · «' + s.name + '»: ' + FIELD_RU[f] + ' ' + fmt(x.skills[i][f]) + ' → ' + fmt(y.skills[i][f]) }); });
  }
  return out;
}
const changedIds = () => new Set(changes().map(c => c.id).filter(Boolean));
function head() {
  const n = changes().length;
  $('#bChanges').textContent = 'Изменений: ' + n;
  $('#bChanges').className = n ? 'warn' : 'ghost';
}
const exportObj = () => ({ site: 'skill-constructor / Миры', gameVer: WD.ver, made: new Date().toISOString(), changes: changes(), state: S });

// ---------- «взять и поставить» и перетаскивание ----------
let PICK = null, DRAG = null;
function pick(p) {
  PICK = p; document.body.classList.toggle('picking', !!p && p.t === 'c');
  const bar = $('#pick');
  bar.hidden = !p;
  if (p) $('#pickTxt').textContent = p.t === 'c' ? 'Взят «' + WD.chars[p.id].name + '» — нажмите место («＋ сюда») или карточку, перед которой поставить' : 'Взято умение «' + WD.skills[p.sid].name + '» — нажмите персонажа, которому его дать';
  document.querySelectorAll('.picked').forEach(e => e.classList.remove('picked'));
  if (p) document.querySelectorAll(p.t === 'c' ? '.c[data-id="' + CSS.escape(p.id) + '"]' : '.ps[data-sid="' + CSS.escape(p.sid) + '"]').forEach(e => e.classList.add('picked'));
}
function moveChar(id, w, k, before) {
  const a = place(S, id), from = rowOf(a.w, a.k);
  from.splice(a.i, 1);
  const to = rowOf(w, k);
  let i = before ? to.indexOf(before) : -1;
  if (i < 0) i = to.length;
  to.splice(i, 0, id);
  OPEN.add(w === 'pool' ? 'pool' : 'w' + w);
  save(); render(); toast('«' + WD.chars[id].name + '» → ' + where({ w, k }));
}
function autoSlot(id) { const c = WD.chars[id]; return c.cls === 'boss' ? 'boss' : c.cls === 'mini' ? 'mini' : c.cls === 'elite' ? 'elite' : c.kind === 'rng' ? 'rng' : 'mel'; }
function addSkill(id, sid) {
  const y = S.chars[id];
  if (y.skills.some(k => k.sid === sid)) { toast('Это умение у него уже есть'); return; }
  const sk = WD.skills[sid];
  y.skills.push({ sid, cd: sk.cd, first: sk.first });
  OPENC.add(id); save(); render(); toast('«' + sk.name + '» → «' + WD.chars[id].name + '»');
}
function dropOn(p, target) {   // target: { id } — карточка, { w, k } — строка
  if (!p) return;
  if (p.t === 's') { if (target.id) addSkill(target.id, p.sid); return; }
  if (target.id) { if (target.id === p.id) return; const b = place(S, target.id); moveChar(p.id, b.w, b.k, target.id); } else moveChar(p.id, target.w, target.k);
}

// ---------- рисование ----------
const OPEN = new Set(), OPENC = new Set();
let AUD = null;
function play(src, btn) {
  if (AUD) { AUD.pause(); if (AUD._b) AUD._b.textContent = '▶ звук'; if (AUD._s === src && !AUD.ended) { AUD = null; return; } }
  AUD = new Audio(src); AUD._s = src; AUD._b = btn; btn.textContent = '■ стоп';
  AUD.onended = () => { btn.textContent = '▶ звук'; };
  AUD.play().catch(() => { btn.textContent = '▶ звук'; });
}
function numField(label, val, on, o) {
  const f = el('div', 'f');
  f.innerHTML = '<label>' + esc(label) + '</label>';
  const i = el('input'); i.type = 'number'; i.step = 'any'; i.inputMode = 'decimal';
  i.value = val == null ? '' : val; if (o && o.ph) i.placeholder = o.ph;
  if (o && o.ed) i.classList.add('ed');
  i.addEventListener('change', () => { const v = i.value === '' ? null : +i.value; on(v); save(); i.classList.toggle('ed', o && o.base !== undefined ? (o.base == null ? null : +o.base) !== v : false); });
  i.addEventListener('click', e => e.stopPropagation());
  f.appendChild(i);
  return f;
}
function inWorld(id, p) {
  if (p.w === 'pool') return '';
  const c = WD.chars[id], y = S.chars[id], wv = WD.worlds[p.w - 1].waves;
  let a = wv[0], b = wv[8], lab = 'волны 1–9';
  if (p.k === 'boss') { a = b = wv[9]; lab = 'волна 10'; } else if (p.k === 'mini') { const W = [3, 6, 9][Math.min(2, p.i)]; a = b = wv[W - 1]; lab = 'волна ' + W; } else if (p.k === 'elite') { a = wv[3]; lab = 'волны 4–9'; }
  const r = (v, m) => Math.round(v * m), span = (x, y2) => x === y2 ? x : x + '–' + y2;
  if (y.hp == null) return '';
  return 'В мире ' + p.w + ' (' + lab + '): здоровье ' + span(r(y.hp, a.hp), r(y.hp, b.hp)) + ', урон за удар ' + (a === b ? r(y.d0, a.dmg) + '–' + r(y.d1, a.dmg) : 'от ' + r(y.d0, a.dmg) + '–' + r(y.d1, a.dmg) + ' в начале до ' + r(y.d0, b.dmg) + '–' + r(y.d1, b.dmg) + ' в конце') + ', бег ×' + fmt(b.speed);
}
function skillCard(id, k, idx) {
  const sk = WD.skills[k.sid], base = D0.chars[id].skills.find(o => o.sid === k.sid);
  const d = el('div', 'sk' + (base ? '' : ' added'));
  const passive = sk.cd >= PASSIVE;
  d.innerHTML = '<div class="top">' + (sk.img ? '<img loading="lazy" src="' + sk.img + '" alt="">' : '<div class="noimg">✦</div>') + '<div><b>' + esc(sk.name) + '</b>' +
    (sk.analog ? '<div class="an">Дота: ' + esc(sk.analog) + '</div>' : '') + (base ? '' : '<div class="an">добавлено · от «' + esc(sk.ownerName) + '»</div>') +
    (sk.off1 ? '<div class="an">на первом круге выключено</div>' : sk.cd1 ? '<div class="an">на первом круге — раз в ' + fmt(sk.cd1) + ' с</div>' : '') + '</div></div><div class="tx">' + esc(sk.text) + '</div>';
  const pr = el('div', 'pr');
  if (passive) pr.appendChild(el('div', 'f', '<label>Перезарядка</label><b>пассивное</b>'));
  else {
    pr.appendChild(numField('Перезарядка, с', k.cd, v => { k.cd = v; }, { base: base ? base.cd : sk.cd, ed: base ? +base.cd !== +k.cd : false }));
    pr.appendChild(numField('Первый раз через, с', k.first, v => { k.first = v; }, { base: base ? base.first : sk.first, ph: 'сразу, как сможет', ed: base ? (base.first == null ? null : +base.first) !== (k.first == null ? null : +k.first) : false }));
  }
  d.appendChild(pr);
  if (sk.snd) { const b = el('button', 'play', '▶ звук'); b.onclick = () => play(sk.snd, b); d.appendChild(b); }
  const x = el('button', 'x', '×'); x.title = 'Убрать умение';
  x.onclick = () => { S.chars[id].skills.splice(idx, 1); save(); render(); };
  d.appendChild(x);
  return d;
}
function card(id, p) {
  const c = WD.chars[id], y = S.chars[id], open = OPENC.has(id);
  const d = el('div', 'c' + (open ? ' open' : '') + (CH.has(id) ? ' chg' : ''));
  d.dataset.id = id; d.draggable = !open;
  const dmg = y.d0 == null ? '' : ' · ⚔ ' + fmt(y.d0) + '–' + fmt(y.d1) + ' раз в ' + fmt(y.atk) + ' с';
  const h = el('div', 'ch');
  h.innerHTML = (c.img ? '<img class="pt" loading="lazy" src="' + c.img + '" alt=""' + (c.tint ? ' style="filter:' + esc(c.tint) + '"' : '') + '>' : '<div class="pt"></div>') +
    '<div class="t"><div class="nm">' + esc(c.name) + '</div><div class="st"><span class="bd ' + c.cls + '">' + CLS_RU[c.cls] + '</span>' + (c.kind === 'rng' ? '<span class="bd rng">стрелок</span>' : '') +
    '❤ ' + fmt(y.hp) + dmg + '</div><div class="st">умений: ' + y.skills.length + (y.skills.length ? ' — ' + esc(y.skills.map(k => WD.skills[k.sid].name).join(', ')) : '') + '</div></div>';
  const g = el('button', 'ib', '✥'); g.title = 'Взять, чтобы переставить';
  g.onclick = e => { e.stopPropagation(); pick(PICK && PICK.id === id ? null : { t: 'c', id }); };
  const o = el('button', 'ib', open ? '▴' : '▾'); o.title = 'Развернуть';
  h.appendChild(g); h.appendChild(o);
  const tog = () => { if (PICK) { dropOn(PICK, { id }); pick(null); return; } open ? OPENC.delete(id) : OPENC.add(id); render(); };
  $('.t', h).onclick = tog; o.onclick = e => { e.stopPropagation(); open ? OPENC.delete(id) : OPENC.add(id); render(); };
  if (c.img) $('.pt', h).onclick = tog;
  d.appendChild(h);
  d.addEventListener('dragstart', e => { DRAG = { t: 'c', id }; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); });
  d.addEventListener('dragend', () => { DRAG = null; document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
  d.addEventListener('dragover', e => { if (DRAG) { e.preventDefault(); e.stopPropagation(); d.classList.add('over'); } });
  d.addEventListener('dragleave', () => d.classList.remove('over'));
  d.addEventListener('drop', e => { if (!DRAG) return; e.preventDefault(); e.stopPropagation(); const p2 = DRAG; DRAG = null; dropOn(p2, { id }); });
  if (open) {
    const b = el('div', 'cb');
    const sub = [c.sub, c.note, c.attack ? 'Атака: ' + c.attack : '', c.base ? 'Усиленный вариант: «' + (WD.chars[c.base] || {}).name + '»' : ''].filter(Boolean).join(' · ');
    if (sub) b.appendChild(el('div', 'note', esc(sub)));
    const t1 = c.tune1 || {}, tn = [t1.dm ? 'урон ×' + fmt(t1.dm) : '', t1.cdk ? 'старые приёмы чаще (перезарядка ×' + fmt(t1.cdk) + ')' : '', t1.swap ? '«Обмен отражений» не больше ' + Math.round(t1.swap * 100) + ' % здоровья' : ''].filter(Boolean).join(', ');
    if (tn) b.appendChild(el('div', 'note', 'На первом круге: ' + esc(tn)));
    b.appendChild(el('h3', '', 'Характеристики <small>базовые, до роста по волнам</small>'));
    const st = el('div', 'stats'), x = D0.chars[id];
    for (const [f, lab] of FIELDS) {
      if (x[f] == null && y[f] == null) continue;
      st.appendChild(numField(f === 'atk' && c.kind === 'rng' ? 'Выстрел раз в, с' : lab, y[f], v => { y[f] = v; }, { base: x[f], ed: (x[f] == null ? null : +x[f]) !== (y[f] == null ? null : +y[f]) }));
    }
    b.appendChild(st);
    const iw = inWorld(id, p); if (iw) b.appendChild(el('div', 'inw', esc(iw)));
    b.appendChild(el('h3', '', 'Умения <small>' + y.skills.length + '</small>'));
    const ss = el('div', 'sks');
    y.skills.forEach((k, i) => ss.appendChild(skillCard(id, k, i)));
    if (!y.skills.length) ss.appendChild(el('div', 'note', 'Умений нет — только обычная атака.'));
    b.appendChild(ss);
    const a = el('button', 'add', '＋ добавить умение'); a.onclick = () => skillPicker(id); b.appendChild(a);
    d.appendChild(b);
  }
  return d;
}
function row(w, k) {
  const r = el('div', 'row'), ids = rowOf(w, k);
  ids.forEach((id, i) => r.appendChild(card(id, { w, k, i })));
  if (!ids.length) r.appendChild(el('span', 'empty', 'пусто'));
  const dz = el('div', 'drop', '＋ сюда'); dz.onclick = () => { if (PICK && PICK.t === 'c') { dropOn(PICK, { w, k }); pick(null); } };
  r.appendChild(dz);
  r.addEventListener('dragover', e => { if (DRAG && DRAG.t === 'c') { e.preventDefault(); r.classList.add('over'); } });
  r.addEventListener('dragleave', () => r.classList.remove('over'));
  r.addEventListener('drop', e => { if (!DRAG || DRAG.t !== 'c') return; e.preventDefault(); const p = DRAG; DRAG = null; dropOn(p, { w, k }); });
  return r;
}
function group(key, title, small, fill) {
  const d = el('details', 'grp'); d.open = OPEN.has(key);
  const s = el('summary', '', esc(title) + (small ? ' <small>' + esc(small) + '</small>' : ''));
  d.appendChild(s);
  const body = el('div', 'in'); d.appendChild(body);
  let done = false;
  const go = () => { if (!done) { done = true; fill(body); } };
  if (d.open) go();
  d.addEventListener('toggle', () => { d.open ? (OPEN.add(key), go()) : OPEN.delete(key); });
  return { d, s };
}
function worldBlock(w) {
  const sl = S.slots[w.n], n = SLOTS.reduce((a, [k]) => a + sl[k].length, 0), boss = sl.boss.map(id => WD.chars[id].name).join(', ');
  const g = group('w' + w.n, 'Мир ' + w.n + ' · ' + w.name, n + ' персонажей' + (boss ? ' · босс: ' + boss : ''), body => {
    body.appendChild(el('h3', '', 'Карты <small>по порядку, нажмите — откроется крупно</small>'));
    const ms = el('div', 'maps');
    w.maps.forEach((m, i) => { const a = el('div', 'map', '<img loading="lazy" src="' + m.img + '" alt=""><div><b>' + (i + 1) + '.</b> ' + esc(m.label) + '</div>'); a.onclick = () => { $('#zoom img').src = m.img; $('#zoom').hidden = false; }; ms.appendChild(a); });
    body.appendChild(ms);
    body.appendChild(el('h3', '', 'Волны <small>сколько и кто выходит; «×» — во сколько раз растут здоровье и урон злодеев</small>'));
    let t = '<table class="waves"><tr><th>Волна</th><th>Карта</th><th>Ближних</th><th>Стрелков</th><th>Элиты</th><th>В конце волны</th><th>здоровье ×</th><th>урон ×</th><th>скорость ×</th><th>золото за волну</th></tr>';
    for (const v of w.waves) {
      const mini = v.W % 3 === 0 && v.W < 10 ? sl.mini[v.W / 3 - 1] : null;
      const end = v.W === 10 ? 'БОСС: ' + (sl.boss.map(id => WD.chars[id].name).join(', ') || '—') : mini ? 'мини-босс: ' + WD.chars[mini].name : '';
      t += '<tr class="' + (v.W === 10 ? 'bossw' : mini ? 'miniw' : '') + '"><td>' + v.W + '</td><td>' + (v.arena + 1) + '</td><td>' + (v.mel == null ? '—' : v.mel) + '</td><td>' + (v.rng == null ? '—' : v.rng) + '</td><td>' + (v.elite || (v.W === 10 ? '—' : 0)) +
        '</td><td class="end">' + esc(end) + '</td><td>' + fmt(v.hp) + '</td><td>' + fmt(v.dmg) + '</td><td>' + fmt(v.speed) + '</td><td>' + v.gold + '</td></tr>';
    }
    const tw = el('div', 'tw', t + '</table>'); body.appendChild(tw);
    for (const [k, title] of SLOTS) { body.appendChild(el('h3', '', title + ' <small>' + SLOT_HINT[k] + '</small>')); body.appendChild(row(w.n, k)); }
  });
  g.s.addEventListener('dragover', e => { if (DRAG && DRAG.t === 'c') { e.preventDefault(); g.s.classList.add('over'); } });
  g.s.addEventListener('dragleave', () => g.s.classList.remove('over'));
  g.s.addEventListener('drop', e => { if (!DRAG || DRAG.t !== 'c') return; e.preventDefault(); const p = DRAG; DRAG = null; moveChar(p.id, w.n, autoSlot(p.id)); });
  return g.d;
}
function heroBlock() {
  return group('heroes', 'Герои', WD.heroes.map(h => h.name).join(' и '), body => {
    for (const h of WD.heroes) {
      const y = S.heroes[h.id], x = D0.heroes[h.id], d = el('div', 'c open');
      d.innerHTML = '<div class="ch"><img class="pt" src="' + h.img + '" alt=""><div class="t"><div class="nm">' + esc(h.name) + '</div><div class="st">' + esc(h.role) + ' · мана восстанавливается ' + fmt(h.mpRegen) + ' в секунду</div></div></div>';
      const b = el('div', 'cb');
      b.appendChild(el('h3', '', 'Характеристики <small>на 1 уровне, без предметов</small>'));
      const st = el('div', 'stats');
      st.appendChild(numField('Здоровье', y.hp, v => { y.hp = v; }, { base: x.hp, ed: +x.hp !== +y.hp }));
      st.appendChild(numField('Дальность выстрела', y.range, v => { y.range = v; }, { base: x.range, ed: +x.range !== +y.range }));
      st.appendChild(numField('Выстрел раз в, с', y.atk, v => { y.atk = v; }, { base: x.atk, ed: +x.atk !== +y.atk }));
      b.appendChild(st);
      b.appendChild(el('h3', '', 'Умения'));
      const ss = el('div', 'sks');
      h.skills.forEach((s, i) => {
        const k = el('div', 'sk');
        k.innerHTML = '<div class="top">' + (s.img ? '<img loading="lazy" src="' + s.img + '" alt="">' : '<div class="noimg">✦</div>') + '<div><b>' + esc(s.name) + '</b><div class="an">' + esc(s.tag) + (s.analog ? ' · Дота: ' + esc(s.analog) : '') + '</div></div></div><div class="tx">' + esc(s.text) + '</div>';
        const pr = el('div', 'pr');
        if (i > 0 || true) pr.appendChild(numField(i === 0 ? 'Раз в, с' : 'Перезарядка, с', y.skills[i].cd, v => { y.skills[i].cd = v; }, { base: x.skills[i].cd, ed: +x.skills[i].cd !== +y.skills[i].cd }));
        if (i > 0) pr.appendChild(numField('Мана', y.skills[i].mana, v => { y.skills[i].mana = v; }, { base: x.skills[i].mana, ed: +x.skills[i].mana !== +y.skills[i].mana }));
        k.appendChild(pr);
        if (s.snd) { const pb = el('button', 'play', '▶ звук'); pb.onclick = () => play(s.snd, pb); k.appendChild(pb); }
        ss.appendChild(k);
      });
      b.appendChild(ss); d.appendChild(b); body.appendChild(d);
      body.appendChild(el('div', 'note', ''));
    }
  }).d;
}
// список всех умений игры: и отдельный раздел, и окно «добавить умение»
const SK_ALL = Object.values(WD.skills).filter(s => !s.owner.startsWith('tb_')).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
function skillList(box, q, onPick, drag) {
  box.innerHTML = '';
  q = (q || '').trim().toLowerCase();
  let n = 0;
  for (const s of SK_ALL) {
    if (q && !(s.name + ' ' + s.ownerName + ' ' + s.text + ' ' + s.analog).toLowerCase().includes(q)) continue;
    n++;
    const d = el('div', 'ps' + (PICK && PICK.sid === s.id ? ' picked' : ''));
    d.dataset.sid = s.id; d.title = s.text;
    d.innerHTML = (s.img ? '<img loading="lazy" src="' + s.img + '" alt="">' : '<div class="noimg">✦</div>') + '<div><b>' + esc(s.name) + '</b><small>' + esc(s.ownerName) + ' · ' + (s.cd >= PASSIVE ? 'пассивное' : 'раз в ' + fmt(s.cd) + ' с') + '</small></div>';
    d.onclick = () => onPick(s.id);
    if (drag) {
      d.draggable = true;
      d.addEventListener('dragstart', e => { DRAG = { t: 's', sid: s.id }; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', s.id); });
      d.addEventListener('dragend', () => { DRAG = null; document.querySelectorAll('.over').forEach(x => x.classList.remove('over')); });
    }
    box.appendChild(d);
  }
  if (!n) box.appendChild(el('div', 'note', 'Ничего не найдено.'));
}
function skillsBlock() {
  return group('skills', 'Все умения', SK_ALL.length + ' · тяните на персонажа или нажмите умение, потом персонажа', body => {
    const tl = el('div', 'tools'), q = el('input'); q.type = 'search'; q.placeholder = 'Поиск: название, чьё, слово из описания (оглушение, яд, рывок)';
    tl.appendChild(q); body.appendChild(tl);
    const box = el('div', 'pal'); body.appendChild(box);
    const draw = () => skillList(box, q.value, sid => pick(PICK && PICK.sid === sid ? null : { t: 's', sid }), true);
    q.oninput = draw; draw();
  }).d;
}
function skillPicker(id) {
  $('#mTitle').textContent = 'Какое умение дать: ' + WD.chars[id].name;
  const body = $('#mBody'); body.innerHTML = '';
  const tl = el('div', 'tools'), q = el('input'); q.type = 'search'; q.placeholder = 'Поиск умения';
  tl.appendChild(q); body.appendChild(tl);
  const box = el('div', 'pal'); body.appendChild(box);
  const draw = () => skillList(box, q.value, sid => { $('#modal').hidden = true; addSkill(id, sid); }, false);
  q.oninput = draw; draw();
  $('#modal').hidden = false;
}
let CH = new Set();
function render() {
  CH = changedIds();
  const y = scrollY, root = $('#root');
  root.innerHTML = '';
  root.appendChild(heroBlock());
  for (const w of WD.worlds) root.appendChild(worldBlock(w));
  root.appendChild(group('pool', 'Запас — не в составе миров', S.pool.length + ' · сюда можно убрать лишних и брать отсюда', body => {
    body.appendChild(el('div', 'note', 'Все листы злодеев, которые передавала Клауди, уже стоят в мирах. Здесь — временные боссы-перекраски (их заменили настоящие), существа, которых призывают умения, и всё, что Вы уберёте из миров.'));
    body.appendChild(row('pool', 'pool'));
  }).d);
  root.appendChild(skillsBlock());
  head();
  if (PICK) pick(PICK);
  scrollTo(0, y);
}
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('on'), 1800); }

// ---------- кнопки ----------
$('#sub').textContent = 'как в игре v' + WD.ver + ' · ' + Object.keys(WD.chars).length + ' персонажей · ' + SK_ALL.length + ' умений';
$('#pickX').onclick = () => pick(null);
$('#mX').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
$('#zoom').onclick = () => { $('#zoom').hidden = true; };
$('#bChanges').onclick = () => {
  const c = changes();
  $('#mTitle').textContent = 'Что изменено: ' + c.length;
  $('#mBody').innerHTML = c.length ? '<ol class="chl">' + c.map(x => '<li>' + esc(x.text) + '</li>').join('') + '</ol>' : '<div class="note">Пока всё как в игре.</div>';
  $('#modal').hidden = false;
};
$('#bExport').onclick = () => {
  const a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(exportObj(), null, 1)], { type: 'application/json' }));
  a.download = 'miry_' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.json'; document.body.appendChild(a); a.click(); a.remove();
  toast('Файл скачан — пришлите его Клоду');
};
$('#bCopy').onclick = async () => {
  const c = changes(), t = 'Миры, правки Создателя (игра v' + WD.ver + '):\n' + (c.length ? c.map((x, i) => (i + 1) + '. ' + x.text).join('\n') : 'изменений нет') + '\n\n' + JSON.stringify({ gameVer: WD.ver, changes: c });
  try { await navigator.clipboard.writeText(t); toast('Скопировано — вставьте в сообщение'); } catch (e) { $('#mTitle').textContent = 'Скопируйте вручную'; $('#mBody').innerHTML = '<pre>' + esc(t) + '</pre>'; $('#modal').hidden = false; }
};
$('#fImport').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { const o = JSON.parse(r.result), s = o.state || o; if (!s.slots || !s.chars) throw 0; S = fit(s); save(); render(); toast('Загружено'); } catch (x) { toast('Это не файл вкладки «Миры»'); } e.target.value = ''; };
  r.readAsText(f);
};
$('#bReset').onclick = () => { if (confirm('Вернуть всё как в игре? Ваши правки на этой вкладке пропадут.')) { S = defaults(); save(); render(); toast('Сброшено'); } };
OPEN.add('w1');
render();
