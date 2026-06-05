const SUPABASE_URL = 'https://djozmuyolvuzkcykoqhb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M5f5QO7e_PiAUGKLz5hUeQ_BrYyo1wl';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Auth ──
function showDashboard() {
  document.body.classList.remove('login-view');
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('dashboard').hidden   = false;
  loadAll();
}

// Build login fields dynamically so browser can't autofill
(function buildLoginFields() {
  const wrap = document.getElementById('loginFields');

  const emailEl = document.createElement('input');
  emailEl.setAttribute('type', 'text');
  emailEl.setAttribute('placeholder', 'Email');
  emailEl.setAttribute('autocomplete', 'off');
  emailEl.id = 'emailInput';

  const passEl = document.createElement('input');
  passEl.setAttribute('type', 'text');
  passEl.setAttribute('placeholder', 'Password');
  passEl.setAttribute('autocomplete', 'off');
  passEl.id = 'passwordInput';
  passEl.style.webkitTextSecurity = 'disc';

  const btn = document.createElement('button');
  btn.id          = 'loginBtn';
  btn.textContent = 'Enter';

  wrap.appendChild(emailEl);
  wrap.appendChild(passEl);
  wrap.appendChild(btn);

  async function attemptLogin() {
    const email    = emailEl.value.trim();
    const password = passEl.value;
    const errEl    = document.getElementById('loginError');
    if (!email || !password) return;

    btn.textContent = '...';
    btn.disabled    = true;
    errEl.hidden    = true;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      errEl.hidden    = false;
      btn.textContent = 'Enter';
      btn.disabled    = false;
      passEl.value    = '';
      passEl.focus();
    } else {
      showDashboard();
    }
  }

  btn.addEventListener('click', attemptLogin);
  passEl.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });
  emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl.focus(); });
})();

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

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
  const [commRes, msgRes, signRes, viewRes, likeRes, paintRes] = await Promise.all([
    sb.from('commissions').select('*').order('created_at', { ascending: false }),
    sb.from('messages').select('*').order('created_at', { ascending: false }),
    sb.from('signups').select('*').order('created_at', { ascending: false }),
    sb.from('views').select('painting, count').order('count', { ascending: false }),
    sb.from('likes').select('painting, count'),
    sb.from('paintings').select('*').order('sort_order', { ascending: true }),
  ]);

  const commissions = commRes.data || [];
  const messages    = msgRes.data  || [];
  const signups     = signRes.data || [];
  const views       = viewRes.data   || [];
  const likes       = likeRes.data   || [];
  const paintings   = paintRes.data  || [];

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
  renderPaintingsAdmin(paintings, views, likes);
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

// ── Paintings admin ──
let allPaintings = [];

function renderPaintingsAdmin(paintings, views, likes) {
  allPaintings = paintings;
  const grid    = document.getElementById('paintingsGrid');
  const viewMap = Object.fromEntries(views.map(r => [r.painting, r.count]));
  // Separate plain likes from reaction keys (reactions have a colon)
  const likeMap     = Object.fromEntries(likes.filter(r => !r.painting.includes(':')).map(r => [r.painting, r.count]));
  const reactionMap = Object.fromEntries(likes.filter(r =>  r.painting.includes(':')).map(r => [r.painting, r.count]));

  function pid(p) { return (p.filename || '').replace(/\.[^.]+$/, ''); }

  grid.innerHTML = paintings.map((p, i) => {
    const id    = pid(p);
    const views = viewMap[id]  || 0;
    const love  = reactionMap[`${id}:love`] || 0;
    const wow   = reactionMap[`${id}:wow`]  || 0;
    const want  = reactionMap[`${id}:want`] || 0;
    return `
    <div class="pa-card" data-index="${i}">
      <img src="${p.image_url || 'images/' + p.filename}" alt="${esc(p.title)}" />
      <div class="pa-card-info">
        <div class="pa-card-title">${esc(p.title)}</div>
        <div class="pa-card-status ${p.status}">${p.status === 'sold' ? 'Sold' : 'Available'}</div>
        <div class="pa-card-stats">
          <span title="Views">👁 ${views}</span>
          <span title="Love it">♡ ${love}</span>
          <span title="Stunning">✦ ${wow}</span>
          <span title="Want it">◎ ${want}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.pa-card').forEach((card, i) => {
    card.addEventListener('click', () => openPaintingModal(paintings[i]));
  });
}

// ── Painting modal ──
let currentPainting = null;

function openPaintingModal(painting) {
  currentPainting = painting;
  const modal = document.getElementById('paintingModal');

  document.getElementById('paintingModalTitle').textContent = painting ? 'Edit Painting' : 'Add Painting';
  document.getElementById('pmPreviewImg').src   = painting ? (painting.image_url || 'images/' + painting.filename) : '';
  document.getElementById('pmTitle').value       = painting?.title       || '';
  document.getElementById('pmMedium').value      = painting?.medium      || 'Acrylic on canvas';
  document.getElementById('pmYear').value        = painting?.year        || 2025;
  document.getElementById('pmStatus').value      = painting?.status      || 'available';
  document.getElementById('pmDescription').value = painting?.description || '';
  document.getElementById('pmSaveStatus').hidden = true;
  document.getElementById('pmUploadStatus').hidden = true;
  document.getElementById('pmImageFile').value   = '';
  document.getElementById('pmDeleteBtn').hidden  = !painting;

  modal.hidden = false;
}

function closePaintingModal() {
  document.getElementById('paintingModal').hidden = true;
  currentPainting = null;
}

document.getElementById('paintingModalClose').addEventListener('click', closePaintingModal);
document.getElementById('paintingModal').addEventListener('click', e => {
  if (e.target === document.getElementById('paintingModal')) closePaintingModal();
});

// Compute SHA-256 hash of file content for duplicate detection
async function computeFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// Image preview on file select + duplicate check
document.getElementById('pmImageFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('pmPreviewImg').src = URL.createObjectURL(file);

  const dupWarn = document.getElementById('pmDupWarning');
  dupWarn.hidden = true;
  e.target.dataset.hash = '';

  const hash = await computeFileHash(file);
  e.target.dataset.hash = hash;

  const ext = file.name.split('.').pop().toLowerCase();
  const { data: files } = await sb.storage.from('paintings').list('', { search: hash });
  if (files?.some(f => f.name === `${hash}.${ext}`)) {
    dupWarn.hidden = false;
  }
});

// Save painting
document.getElementById('pmSaveBtn').addEventListener('click', async () => {
  const btn      = document.getElementById('pmSaveBtn');
  const statusEl = document.getElementById('pmSaveStatus');
  const file     = document.getElementById('pmImageFile').files[0];

  btn.disabled    = true;
  btn.textContent = 'Saving...';
  statusEl.hidden = true;

  let imageUrl = currentPainting?.image_url || null;

  // Upload new image if selected
  if (file) {
    const ext      = file.name.split('.').pop().toLowerCase();
    const hash     = document.getElementById('pmImageFile').dataset.hash || Date.now().toString(16);
    const filename = `${hash}.${ext}`;
    const uploadStatus = document.getElementById('pmUploadStatus');

    uploadStatus.textContent = 'Uploading image...';
    uploadStatus.hidden = false;

    const { error: upErr } = await sb.storage.from('paintings').upload(filename, file, { upsert: true });

    if (upErr) {
      uploadStatus.textContent = 'Image upload failed.';
      btn.disabled    = false;
      btn.textContent = 'Save Changes';
      return;
    }

    const { data: { publicUrl } } = sb.storage.from('paintings').getPublicUrl(filename);
    imageUrl = publicUrl;
    uploadStatus.textContent = 'Image uploaded.';
  }

  const payload = {
    title:       document.getElementById('pmTitle').value.trim(),
    medium:      document.getElementById('pmMedium').value.trim(),
    year:        parseInt(document.getElementById('pmYear').value),
    status:      document.getElementById('pmStatus').value,
    description: document.getElementById('pmDescription').value.trim(),
    image_url:   imageUrl,
  };

  let err;
  if (currentPainting) {
    ({ error: err } = await sb.from('paintings').update(payload).eq('id', currentPainting.id));
  } else {
    const filename = `new-${Date.now()}`;
    ({ error: err } = await sb.from('paintings').insert({ ...payload, filename, sort_order: allPaintings.length + 1 }));
  }

  if (err) {
    statusEl.textContent = 'Error saving. Try again.';
    statusEl.style.color = '#b71c1c';
  } else {
    statusEl.textContent = 'Saved!';
    statusEl.style.color = '#2e7d32';
    setTimeout(closePaintingModal, 800);
    loadAll();
  }

  statusEl.hidden = false;
  btn.disabled    = false;
  btn.textContent = 'Save Changes';
});

// Delete painting
document.getElementById('pmDeleteBtn').addEventListener('click', async () => {
  if (!currentPainting) return;
  if (!confirm(`Delete "${currentPainting.title}"? This cannot be undone.`)) return;

  await sb.from('paintings').delete().eq('id', currentPainting.id);
  closePaintingModal();
  loadAll();
});

// Add new painting
document.getElementById('addPaintingBtn').addEventListener('click', () => openPaintingModal(null));

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
sb.auth.getSession().then(({ data }) => {
  if (data.session) showDashboard();
});
