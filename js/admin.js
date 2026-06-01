const SUPABASE_URL = 'https://djozmuyolvuzkcykoqhb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M5f5QO7e_PiAUGKLz5hUeQ_BrYyo1wl';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth ──
const SESSION_KEY = 'uf_admin';

function isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === '1'; }

function showDashboard() {
  document.body.classList.remove('login-view');
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('dashboard').hidden   = false;
  loadAll();
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  location.reload();
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('passwordInput').value;
  const errEl = document.getElementById('loginError');
  const btn   = e.target.querySelector('button');

  btn.textContent = '...';
  btn.disabled    = true;
  errEl.hidden    = true;

  const { data } = await sb
    .from('admin_config')
    .select('value')
    .eq('key', 'password')
    .single();

  if (data?.value === input) {
    sessionStorage.setItem(SESSION_KEY, '1');
    showDashboard();
  } else {
    errEl.hidden    = false;
    btn.textContent = 'Enter';
    btn.disabled    = false;
    document.getElementById('passwordInput').value = '';
    document.getElementById('passwordInput').focus();
  }
});

document.getElementById('logoutBtn').addEventListener('click', logout);

// ── Tabs ──
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
    tab.classList.add('active');
    document.getElementById('tab' + cap(tab.dataset.tab)).hidden = false;
  });
});

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Load all data ──
async function loadAll() {
  const [commRes, msgRes, signRes, viewRes, likeRes] = await Promise.all([
    sb.from('commissions').select('*').order('created_at', { ascending: false }),
    sb.from('messages').select('*').order('created_at', { ascending: false }),
    sb.from('signups').select('*').order('created_at', { ascending: false }),
    sb.from('views').select('painting, count').order('count', { ascending: false }),
    sb.from('likes').select('painting, count'),
  ]);

  const commissions = commRes.data || [];
  const messages    = msgRes.data  || [];
  const signups     = signRes.data || [];
  const views       = viewRes.data || [];
  const likes       = likeRes.data || [];

  // Stats
  const totalViews = views.reduce((s, r) => s + (r.count || 0), 0);
  const unseenComm = commissions.filter(r => !r.seen).length;
  const unseenMsg  = messages.filter(r => !r.seen).length;

  document.getElementById('statCommissions').textContent = commissions.length;
  document.getElementById('statMessages').textContent    = messages.length;
  document.getElementById('statSignups').textContent     = signups.length;
  document.getElementById('statViews').textContent       = totalViews.toLocaleString();

  // Badges
  setBadge('badgeCommissions', unseenComm);
  setBadge('badgeMessages',    unseenMsg);

  // Tables
  renderCommissions(commissions);
  renderMessages(messages);
  renderSignups(signups);
  renderPaintings(views, likes);
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (count > 0) { el.textContent = count; el.hidden = false; }
  else { el.hidden = true; }
}

// ── Commissions ──
function renderCommissions(rows) {
  const tbody = document.getElementById('commissionsBody');
  const empty = document.getElementById('emptyCommissions');

  if (!rows.length) { empty.hidden = false; return; }

  tbody.innerHTML = rows.map(r => `
    <tr class="${r.seen ? '' : 'unseen'}" data-id="${r.id}" data-type="commission">
      <td>${r.seen ? '' : '<span class="new-dot"></span>'}</td>
      <td>${esc(r.name)}</td>
      <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
      <td><span class="type-tag">${r.type === 'pet' ? 'Pet Portrait' : 'Custom'}</span></td>
      <td><span class="truncate">${esc(r.description || '')}</span></td>
      <td>${esc(r.budget || '—')}</td>
      <td class="date-cell">${fmtDate(r.created_at)}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach((tr, i) => {
    tr.addEventListener('click', () => openDetail('commission', rows[i]));
  });
}

// ── Messages ──
function renderMessages(rows) {
  const tbody = document.getElementById('messagesBody');
  const empty = document.getElementById('emptyMessages');

  if (!rows.length) { empty.hidden = false; return; }

  tbody.innerHTML = rows.map(r => `
    <tr class="${r.seen ? '' : 'unseen'}" data-id="${r.id}">
      <td>${r.seen ? '' : '<span class="new-dot"></span>'}</td>
      <td>${esc(r.name)}</td>
      <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
      <td><span class="truncate">${esc(r.message)}</span></td>
      <td class="date-cell">${fmtDate(r.created_at)}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach((tr, i) => {
    tr.addEventListener('click', () => openDetail('message', rows[i]));
  });
}

// ── Signups ──
function renderSignups(rows) {
  const tbody = document.getElementById('signupsBody');
  const empty = document.getElementById('emptySignups');

  if (!rows.length) { empty.hidden = false; return; }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
      <td class="date-cell">${fmtDate(r.created_at)}</td>
    </tr>
  `).join('');
}

// ── Paintings ──
function renderPaintings(views, likes) {
  const tbody   = document.getElementById('paintingsBody');
  const maxViews = Math.max(...views.map(r => r.count), 1);
  const likeMap  = Object.fromEntries(likes.map(r => [r.painting, r.count]));

  tbody.innerHTML = views.map(r => {
    const barW = Math.round((r.count / maxViews) * 120);
    const name  = r.painting.replace(/_/g, ' ');
    return `
      <tr>
        <td>${esc(name)}</td>
        <td>
          <div class="bar-wrap">
            <div class="bar" style="width:${barW}px"></div>
            <span>${r.count}</span>
          </div>
        </td>
        <td>${likeMap[r.painting] || 0} ♥</td>
      </tr>
    `;
  }).join('');
}

// ── Detail modal ──
function openDetail(type, row) {
  const content = document.getElementById('detailContent');

  if (type === 'commission') {
    content.innerHTML = `
      <div class="detail-row"><label>Name</label><p>${esc(row.name)}</p></div>
      <div class="detail-row"><label>Email</label><p><a href="mailto:${esc(row.email)}">${esc(row.email)}</a></p></div>
      <div class="detail-row"><label>Type</label><p>${row.type === 'pet' ? 'Pet Portrait' : 'Custom Acrylic'}</p></div>
      <div class="detail-row"><label>Description</label><p>${esc(row.description || '—')}</p></div>
      <div class="detail-row"><label>Budget</label><p>${esc(row.budget || '—')}</p></div>
      <div class="detail-row"><label>Date</label><p>${fmtDate(row.created_at)}</p></div>
    `;
  } else {
    content.innerHTML = `
      <div class="detail-row"><label>Name</label><p>${esc(row.name)}</p></div>
      <div class="detail-row"><label>Email</label><p><a href="mailto:${esc(row.email)}">${esc(row.email)}</a></p></div>
      <div class="detail-row"><label>Message</label><p>${esc(row.message)}</p></div>
      <div class="detail-row"><label>Date</label><p>${fmtDate(row.created_at)}</p></div>
    `;
  }

  document.getElementById('detailModal').hidden = false;

  // Mark as seen
  if (!row.seen) {
    const table = type === 'commission' ? 'commissions' : 'messages';
    sb.from(table).update({ seen: true }).eq('id', row.id);
    row.seen = true;
    const tr = document.querySelector(`tr[data-id="${row.id}"]`);
    if (tr) {
      tr.classList.remove('unseen');
      const dot = tr.querySelector('.new-dot');
      if (dot) dot.remove();
    }
  }
}

document.querySelector('.detail-close').addEventListener('click', () => {
  document.getElementById('detailModal').hidden = true;
});

document.getElementById('detailModal').addEventListener('click', e => {
  if (e.target === document.getElementById('detailModal'))
    document.getElementById('detailModal').hidden = true;
});

// ── Escape HTML ──
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──
if (isLoggedIn()) showDashboard();
