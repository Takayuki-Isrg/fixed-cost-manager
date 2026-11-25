{
const KEY = 'subs-manager-v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen = (n) => '¥' + Math.round(Number(n) || 0).toLocaleString('ja-JP');

let subs = [];
let editingId = null;
let docRef = null;      // db document for this person
let writing = false, dirty = false;

function clean(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
    .map((s) => ({ id: s.id, name: s.name.slice(0, 60), fee: Math.max(0, Math.round(Number(s.fee) || 0)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(s.date) ? s.date : '' }));
}
function readLocal() { try { return clean(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { return []; } }
function writeLocal() { try { localStorage.setItem(KEY, JSON.stringify(subs)); } catch (e) {} }

async function flush() {
  if (!docRef) return;
  if (writing) { dirty = true; return; }
  writing = true;
  do {
    dirty = false;
    try { await docRef.set({ items: subs, updatedAt: new Date().toISOString() }); setStore('cloud'); }
    catch (e) { setStore('error', e && e.code); break; }
  } while (dirty);
  writing = false;
}
function persist() { writeLocal(); flush(); }

function setStore(mode, code) {
  const t = {
    cloud: 'データは Claude アカウントに保存されています（あなただけが閲覧できます）。',
    local: 'データはこの端末のブラウザ内にのみ保存されています。',
    error: 'クラウドへの保存に失敗しました。この端末には保存されています。' + (code ? '（' + code + '）' : '')
  };
  $('store').textContent = t[mode] || '';
}

function render() {
  const sorted = subs.slice().sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const monthly = subs.reduce((t, s) => t + s.fee, 0);
  $('count').textContent = subs.length;
  $('monthly').textContent = yen(monthly);
  $('yearly').textContent = yen(monthly * 12);
  $('empty').hidden = subs.length > 0;
  $('has').hidden = subs.length === 0;
  $('rows').innerHTML = sorted.map((s) => `<tr class="${s.id === editingId ? 'sel' : ''}">
    <td class="nm">${esc(s.name)}</td><td class="r">${yen(s.fee)}</td>
    <td class="r" style="text-align:left">${esc((s.date || '').replace(/-/g, '/'))}</td>
    <td class="ops"><button type="button" data-edit="${esc(s.id)}" aria-label="${esc(s.name)}を編集">編集</button><button type="button" class="del" data-del="${esc(s.id)}" aria-label="${esc(s.name)}を削除">削除</button></td></tr>`).join('');
  const byFee = subs.slice().sort((a, b) => b.fee - a.fee);
  const max = byFee.length ? byFee[0].fee : 0;
  $('bars').innerHTML = byFee.map((s) => {
    const w = max > 0 ? Math.max(2, s.fee / max * 100) : 0;
    const pct = monthly > 0 ? Math.round(s.fee / monthly * 100) : 0;
    return `<div class="bar" aria-hidden="true"><span>${esc(s.name)}</span><div class="track"><div class="fill" style="width:${w}%"></div></div><span class="r">${yen(s.fee)}（${pct}%）</span></div>`;
  }).join('');
  $('bars').setAttribute('aria-label', '契約別の月額費用：' + byFee.map((s) => s.name + ' ' + yen(s.fee)).join('、'));
  $('formTitle').textContent = editingId ? '契約を編集' : '契約を追加';
  $('submit').textContent = editingId ? '更新する' : '追加する';
  $('cancel').hidden = !editingId;
}

function showErr(msg) { $('err').textContent = msg; $('err').hidden = !msg; }
function resetForm() { editingId = null; $('form').reset(); showErr(''); render(); }

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('f-name').value.trim(), feeRaw = $('f-fee').value, date = $('f-date').value, fee = Number(feeRaw);
  if (!name) return showErr('契約名を入力してください。');
  if (feeRaw === '' || !isFinite(fee) || fee < 0) return showErr('月額料金を0以上の数値で入力してください。');
  if (!date) return showErr('次回更新日を選択してください。');
  const item = { name: name.slice(0, 60), fee: Math.round(fee), date };
  if (editingId) subs = subs.map((s) => s.id === editingId ? { id: s.id, ...item } : s);
  else subs = subs.concat([{ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...item }]);
  persist(); resetForm();
});
$('cancel').addEventListener('click', resetForm);
['f-name', 'f-fee', 'f-date'].forEach((id) => $(id).addEventListener('input', () => showErr('')));
$('rows').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.edit) {
    const s = subs.find((x) => x.id === b.dataset.edit); if (!s) return;
    editingId = s.id; $('f-name').value = s.name; $('f-fee').value = s.fee; $('f-date').value = s.date;
    showErr(''); render(); $('f-name').focus();
  } else if (b.dataset.del) {
    subs = subs.filter((x) => x.id !== b.dataset.del);
    if (editingId === b.dataset.del) resetForm(); else render();
    persist();
  }
});

function drawIcon() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1d4ed8'; g.beginPath(); g.roundRect(16, 16, 224, 224, 52); g.fill();
  g.fillStyle = '#ffffff';
  [[64, 150, 28, 46], [114, 118, 28, 78], [164, 86, 28, 110]].forEach(([x, y, w, h]) => { g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill(); });
  g.fillRect(56, 204, 144, 8);
  return c.toDataURL('image/png');
}

// 初期表示：まず端末内のデータで描画し、使えればアカウント保存へ切り替える
subs = readLocal(); render(); setStore('local');

(async () => {
  try {
    const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
    const uid = user ? await user.id() : null;
    if (db && uid) {
      docRef = db.doc('data/users/' + uid + '/subscriptions');
      const snap = await docRef.get();
      if (snap.exists) { subs = clean(snap.data().items); writeLocal(); render(); setStore('cloud'); }
      else if (subs.length) { await flush(); }
      else setStore('cloud');
    }
  } catch (e) { docRef = null; setStore('local'); }
})();

(async () => {
  try {
    const desktop = await claude.use('desktop');
    if (!desktop) return;
    if (desktop.app) { desktop.app.dock.setIcon(drawIcon()).catch(() => {}); return; }
    if ((await desktop.install.state()) === 'available') {
      const b = $('install'); b.hidden = false;
      b.onclick = () => desktop.install.request().then((r) => { if (r === 'installed') b.hidden = true; }).catch(() => {});
    }
  } catch (e) {}
})();
}
