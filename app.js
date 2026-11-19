// Конструктор скиллов: наши персонажи сверху, герои Доты снизу; иконку тянем в ячейку (или клик по иконке, потом по
// ячейке). Всё хранится в браузере (localStorage), «Скачать JSON» — выгрузка для Клода. На игру не влияет.
'use strict';
const { C, D, ATTR } = window.DATA;
const KEY = 'skillbuilder_v1';
const SLOTS = { hero: 4, boss: 4, mini: 2, regular: 1 };
const ROLE = { regular: 'Обычный злодей — 1', mini: 'Мини-босс — 2', boss: 'Босс — 4', hero: 'Герой — 4' };
const GROUPS = ['Герои', 'Боссы', 'Мини-боссы и элита', 'Злодеи'];
const AB = {};                                   // ключ способности → данные + герой Доты
for (const h of D) for (const a of h.ab) AB[a.k] = Object.assign({ h: h.n }, a);
const $ = s => document.querySelector(s);
const el = (t, cls, html) => { const e = document.createElement(t); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function defaults() { const s = {}; for (const c of C) s[c.id] = { r: c.r, k: c.pick.slice() }; return s; }
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') { for (const c of C) if (!s[c.id]) s[c.id] = { r: c.r, k: c.pick.slice() }; return s; } } catch (e) {}
  return defaults();
}
let S = load();
let pick = null;                                 // выбранная кликом иконка палитры
const save = () => { localStorage.setItem(KEY, JSON.stringify(S)); stat(); markUsed(); };
function fit(id) { const st = S[id], n = SLOTS[st.r] || 1; st.k = st.k.slice(0, n); while (st.k.length < n) st.k.push(null); }
function toast(t) { const e = $('#toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', 1600); }

// ---------- наши персонажи ----------
function renderChars() {
  const m = $('#chars'); m.innerHTML = '';
  for (const g of GROUPS) {
    const list = C.filter(c => c.g === g);
    if (!list.length) continue;
    const sec = el('div', 'grp');
    sec.appendChild(el('h2', null, esc(g) + `<span>${list.length}</span>`));
    const cards = el('div', 'cards');
    for (const c of list) cards.appendChild(card(c));
    sec.appendChild(cards); m.appendChild(sec);
  }
  stat();
}
function card(c) {
  fit(c.id);
  const st = S[c.id], d = el('div', 'card'); d.dataset.c = c.id;
  d.appendChild(el('div', 'ph', `<img src="${c.p}" alt="">`));
  const inf = el('div', 'info');
  inf.appendChild(el('div', 'nm', esc(c.n)));
  inf.appendChild(el('div', 'sb', esc(c.s)));
  inf.appendChild(el('div', 'now', 'Сейчас в игре: ' + esc(c.now)));
  const sel = el('select');
  for (const r of ['regular', 'mini', 'boss', 'hero']) { const o = el('option', null, ROLE[r]); o.value = r; if (st.r === r) o.selected = true; sel.appendChild(o); }
  sel.onchange = () => { st.r = sel.value; fit(c.id); save(); d.replaceWith(card(c)); };
  inf.appendChild(sel);
  const sl = el('div', 'slots');
  st.k.forEach((k, i) => sl.appendChild(slot(c.id, i, k)));
  inf.appendChild(sl);
  d.appendChild(inf);
  return d;
}
function slot(cid, i, k) {
  const w = el('div', 'slot'), b = el('div', 'box' + (k ? ' full' : ''));
  if (k && AB[k]) {
    b.innerHTML = `<img src="${AB[k].i}" alt="" draggable="false"><div class="x" title="Убрать">×</div>`;
    b.dataset.k = k; b.draggable = true;
    b.ondragstart = e => { e.dataTransfer.setData('text/plain', `s:${cid}:${i}`); $('#pal').classList.add('dropdel'); hideTip(); };
    b.ondragend = () => $('#pal').classList.remove('dropdel');
    b.querySelector('.x').onclick = e => { e.stopPropagation(); setSlot(cid, i, null); };
  } else b.textContent = '+';
  b.ondragover = e => { e.preventDefault(); b.classList.add('over'); };
  b.ondragleave = () => b.classList.remove('over');
  b.ondrop = e => { e.preventDefault(); b.classList.remove('over'); dropOn(cid, i, e.dataTransfer.getData('text/plain')); };
  b.onclick = () => { if (pick) { setSlot(cid, i, pick); clearPick(); hideTip(); } else if (TOUCH && k) { const r = b.getBoundingClientRect(); setTimeout(() => showTip(k, 8, r.bottom + 6), 0); } };
  w.appendChild(b);
  w.appendChild(el('div', 'lb', k && AB[k] ? esc(AB[k].n) : ''));
  return w;
}
function setSlot(cid, i, k) { S[cid].k[i] = k; save(); redraw(cid); }
function redraw(cid) { const old = document.querySelector(`.card[data-c="${cid}"]`); if (old) old.replaceWith(card(C.find(c => c.id === cid))); }
function dropOn(cid, i, data) {
  if (!data) return;
  if (data.startsWith('a:')) return setSlot(cid, i, data.slice(2));
  if (data.startsWith('s:')) {                   // из другой ячейки — меняем местами
    const [, sc, si] = data.split(':'); const j = +si;
    if (sc === cid && j === i) return;
    const a = S[sc].k[j], b = S[cid].k[i];
    S[cid].k[i] = a; S[sc].k[j] = b; save(); redraw(cid); if (sc !== cid) redraw(sc);
  }
}
function stat() {
  let all = 0, full = 0;
  for (const c of C) { fit(c.id); for (const k of S[c.id].k) { all++; if (k) full++; } }
  $('#stat').textContent = `Заполнено ${full} из ${all} ячеек`;
}

// ---------- палитра Доты ----------
let attr = 'all-any';
function renderAttrs() {
  const box = $('#attrs'); box.innerHTML = '';
  for (const [k, t] of [['all-any', 'Все'], ...Object.entries(ATTR)]) {
    const c = el('span', 'chip' + (attr === k ? ' on' : ''), t);
    c.onclick = () => { attr = k; renderAttrs(); renderHeroes(); };
    box.appendChild(c);
  }
}
function renderHeroes() {
  const q = $('#q').value.trim().toLowerCase(), box = $('#heroes'); box.innerHTML = '';
  for (const h of D) {
    if (attr !== 'all-any' && h.a !== attr) continue;
    const heroHit = !q || h.n.toLowerCase().includes(q);
    const abs = h.ab.filter(a => heroHit || a.n.toLowerCase().includes(q) || a.d.toLowerCase().includes(q) ||
      (a.r || '').toLowerCase().includes(q));
    if (!abs.length) continue;
    const r = el('div', 'hero');
    r.appendChild(el('div', 'hp', `<img src="${h.i}" alt="" loading="lazy"><div>${esc(h.n)}</div>`));
    const ab = el('div', 'ab');
    for (const a of abs) {
      const im = el('img', 'ico'); im.src = a.i; im.loading = 'lazy'; im.dataset.k = a.k; im.draggable = true;
      im.ondragstart = e => { e.dataTransfer.setData('text/plain', 'a:' + a.k); hideTip(); };
      im.onclick = () => {
        if (pick === a.k) { hideTip(); return clearPick(); }
        clearPick(); pick = a.k; im.classList.add('picked'); document.body.classList.add('picking');
        if (TOUCH) { const r = im.getBoundingClientRect(); showTip(a.k, 8, Math.max(8, r.top - 12)); }
        else toast('Теперь кликните ячейку наверху');
      };
      ab.appendChild(im);
    }
    r.appendChild(ab); box.appendChild(r);
  }
  markUsed();
}
function markUsed() {
  const used = new Set(); for (const c of C) for (const k of (S[c.id].k || [])) if (k) used.add(k);
  for (const im of document.querySelectorAll('#heroes .ico')) im.classList.toggle('used', used.has(im.dataset.k));
}
function clearPick() { pick = null; for (const e of document.querySelectorAll('.ico.picked')) e.classList.remove('picked'); document.body.classList.remove('picking'); }
// ячейку бросили на палитру — удалить
const pal = $('#pal');
pal.ondragover = e => { e.preventDefault(); };
pal.ondrop = e => { e.preventDefault(); pal.classList.remove('dropdel'); const d = e.dataTransfer.getData('text/plain'); if (d.startsWith('s:')) { const [, sc, si] = d.split(':'); setSlot(sc, +si, null); toast('Скилл убран'); } };

// ---------- подсказка ----------
const tip = $('#tip');
const TOUCH = matchMedia('(hover: none)').matches;   // телефон: описание по нажатию, а не по наведению
function showTip(k, x, y) {
  const a = AB[k]; if (!a) return;
  // описание по-русски — из PDF Создателя (ChatGPT, «Dota 2 — все герои и способности»); нет — английское из dotaconstants
  const cm = a.cm || [a.cd ? 'Перезарядка: ' + a.cd : '', a.mc ? 'Мана: ' + a.mc : ''].filter(Boolean).join(' | ');
  tip.innerHTML = `<b>${esc(a.n)}</b><div class="meta">${esc(a.h)}${a.t ? ' · ' + esc(a.t) : ''}${cm ? '<br>' + esc(cm) : ''}</div>` +
    esc(a.r || a.d) +
    (a.sh ? `<div class="agh"><span>Aghanim’s Shard:</span> ${esc(a.sh)}</div>` : '') +
    (a.sc ? `<div class="agh"><span>Aghanim’s Scepter:</span> ${esc(a.sc)}</div>` : '');
  tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(x + 16, innerWidth - w - 8) + 'px';
  tip.style.top = (y + 16 + h > innerHeight ? y - h - 12 : y + 16) + 'px';
}
function hideTip() { tip.style.display = 'none'; }
if (TOUCH) document.addEventListener('click', e => { if (!e.target.closest('.ico')) hideTip(); }, true);
document.addEventListener('mousemove', e => { const t = e.target.closest('[data-k]'); if (t) showTip(t.dataset.k, e.clientX, e.clientY); else hideTip(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') clearPick(); });

// ---------- кнопки ----------
function exportObj() {
  const out = { what: 'Duel Arena — скиллы персонажей (конструктор)', saved: new Date().toISOString(), characters: {} };
  for (const c of C) out.characters[c.id] = { name: c.n, role: S[c.id].r, skills: S[c.id].k.filter(Boolean).map(k => ({ key: k, name: AB[k] ? AB[k].n : k, dota_hero: AB[k] ? AB[k].h : '' })) };
  return out;
}
$('#bExport').onclick = () => {
  const b = new Blob([JSON.stringify(exportObj(), null, 1)], { type: 'application/json' });
  const a = el('a'); a.href = URL.createObjectURL(b); a.download = 'skills_duel_arena.json'; a.click();
};
$('#bCopy').onclick = () => navigator.clipboard.writeText(JSON.stringify(exportObj(), null, 1)).then(() => toast('Скопировано'));
$('#fImport').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    const j = JSON.parse(t), ch = j.characters || {};
    for (const c of C) if (ch[c.id]) S[c.id] = { r: ch[c.id].role || S[c.id].r, k: (ch[c.id].skills || []).map(s => s.key || s) };
    save(); renderChars(); toast('Загружено');
  }).catch(() => toast('Не тот файл'));
};
$('#bReset').onclick = () => { if (confirm('Вернуть вариант Клауди? Ваши изменения пропадут.')) { S = defaults(); save(); renderChars(); } };
$('#q').oninput = () => renderHeroes();

// ---------- высота панели Доты ----------
(() => {
  const r = $('#resizer'); let y0, h0;
  r.onmousedown = e => { y0 = e.clientY; h0 = pal.offsetHeight; document.onmousemove = m => { pal.style.height = Math.max(120, Math.min(innerHeight - 160, h0 + y0 - m.clientY)) + 'px'; }; document.onmouseup = () => { document.onmousemove = document.onmouseup = null; }; };
})();

renderChars(); renderAttrs(); renderHeroes();
