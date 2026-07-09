firebase.initializeApp({
  apiKey:            'AIzaSyDoF0suDnQiOL4t_gMu4n8PSWrp4tesgQM',
  authDomain:        'unusualfeminine-7549a.firebaseapp.com',
  projectId:         'unusualfeminine-7549a',
  storageBucket:     'unusualfeminine-7549a.firebasestorage.app',
  messagingSenderId: '429844049501',
  appId:             '1:429844049501:web:8a45e0a0ed8af6d84167b4'
});
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();
const FV      = firebase.firestore.FieldValue;

// ── Auth ──
function showDashboard() {
  document.body.classList.remove('login-view');
  document.getElementById('loginScreen').hidden = true;
  document.getElementById('dashboard').hidden   = false;
  loadAll();

  // Fresh login has no stored timestamp yet — start the clock now.
  // A reload with a persisted session keeps whatever was already stored,
  // so scheduleInactivityCheck() below can tell if the real idle time
  // (even across a closed tab) already exceeds the limit.
  if (!localStorage.getItem(LAST_ACTIVE_KEY)) {
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  }
  scheduleInactivityCheck();

  if (sessionUnsub) sessionUnsub();
  sessionUnsub = db.collection('admin_session').doc(auth.currentUser.uid)
    .onSnapshot(snap => {
      const remote = snap.data()?.sessionId;
      if (remote && mySessionId && remote !== mySessionId) {
        logActivity('session_kicked', auth.currentUser.email, '');
        localStorage.setItem(SIGNOUT_REASON_KEY, 'elsewhere');
        doLogout();
      }
    }, err => {
      console.error('admin_session listener failed:', err);
    });
}

// ── Inactivity auto-logout ──
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVE_KEY       = 'uf_admin_last_active';
let inactivityTimer = null;

// ── Single active session ──
const SESSION_ID_KEY     = 'uf_admin_session_id';
const SIGNOUT_REASON_KEY = 'uf_admin_signout_reason';
let mySessionId = localStorage.getItem(SESSION_ID_KEY) || null; // captured once at load, not re-read per check
let sessionUnsub = null;

async function doLogout() {
  clearTimeout(inactivityTimer);
  if (sessionUnsub) { sessionUnsub(); sessionUnsub = null; }
  localStorage.removeItem(LAST_ACTIVE_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  mySessionId = null;
  await auth.signOut();
  location.reload();
}

function scheduleInactivityCheck() {
  clearTimeout(inactivityTimer);
  const last      = parseInt(localStorage.getItem(LAST_ACTIVE_KEY), 10) || Date.now();
  const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - last);

  if (remaining <= 0) {
    doLogout();
    return;
  }
  inactivityTimer = setTimeout(doLogout, remaining);
}

function recordActivity() {
  if (document.getElementById('dashboard').hidden) return;
  localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  scheduleInactivityCheck();
}

['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, recordActivity, { passive: true });
});

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

    try {
      await auth.signInWithEmailAndPassword(email, password);
      mySessionId = crypto.randomUUID();
      localStorage.setItem(SESSION_ID_KEY, mySessionId);
      await db.collection('admin_session').doc(auth.currentUser.uid).set({
        sessionId: mySessionId, updatedAt: FV.serverTimestamp(),
      });
      logActivity('login_success', email, '');
      showDashboard();
    } catch (err) {
      logActivity('login_failed', email, '');
      errEl.hidden    = false;
      btn.textContent = 'Enter';
      btn.disabled    = false;
      passEl.value    = '';
      passEl.focus();
    }
  }

  btn.addEventListener('click', attemptLogin);
  passEl.addEventListener('keydown', e => { if (e.key === 'Enter') attemptLogin(); });
  emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl.focus(); });
})();

document.getElementById('logoutBtn').addEventListener('click', doLogout);

// ── Load all data ──
async function loadAll() {
  const [paintSnap, viewSnap, likeSnap] = await Promise.all([
    db.collection('paintings').orderBy('sort_order', 'asc').get(),
    db.collection('views').get(),
    db.collection('likes').get(),
  ]);

  const paintings = paintSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const views     = {};
  viewSnap.forEach(d  => { views[d.id]  = d.data().count || 0; });
  const likes     = {};
  likeSnap.forEach(d  => { likes[d.id]  = d.data().count || 0; });

  const totalViews = Object.values(views).reduce((s, c) => s + c, 0);
  const totalLikes = Object.values(likes).reduce((s, c) => s + c, 0);

  document.getElementById('statPaintings').textContent = paintings.length;
  document.getElementById('statViews').textContent     = totalViews.toLocaleString();
  document.getElementById('statLikes').textContent     = totalLikes.toLocaleString();

  renderPaintingsAdmin(paintings, views, likes);
}

// ── Paintings admin ──
let allPaintings = [];

async function loadReactionCounts(paintingIds) {
  const keys = [];
  paintingIds.forEach(id => ['love', 'wow', 'want'].forEach(t => keys.push(`${id}:${t}`)));
  const snaps = await Promise.all(keys.map(k => db.collection('reactions').doc(k).get()));
  const map = {};
  snaps.forEach((snap, i) => { map[keys[i]] = snap.exists ? (snap.data().count || 0) : 0; });
  return map;
}

async function renderPaintingsAdmin(paintings, views, likes) {
  allPaintings = paintings;
  const grid = document.getElementById('paintingsGrid');
  const reactionMap = await loadReactionCounts(paintings.map(p => p.id));

  grid.innerHTML = paintings.map((p, i) => {
    const id    = p.id;
    const view  = views[id] || 0;
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
          <span title="Views">👁 ${view}</span>
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
  const { items } = await storage.ref('paintings').listAll();
  if (items.some(item => item.name === `${hash}.${ext}`)) {
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
  let filename = currentPainting?.filename  || null;

  // Upload new image if selected
  if (file) {
    const ext      = file.name.split('.').pop().toLowerCase();
    const hash     = document.getElementById('pmImageFile').dataset.hash || Date.now().toString(16);
    filename       = `${hash}.${ext}`;
    const uploadStatus = document.getElementById('pmUploadStatus');

    uploadStatus.textContent = 'Uploading image...';
    uploadStatus.hidden = false;

    try {
      const ref = storage.ref('paintings').child(filename);
      await ref.put(file);
      imageUrl = await ref.getDownloadURL();
      uploadStatus.textContent = 'Image uploaded.';
    } catch (err) {
      uploadStatus.textContent = 'Image upload failed.';
      btn.disabled    = false;
      btn.textContent = 'Save Changes';
      return;
    }
  }

  const payload = {
    title:       document.getElementById('pmTitle').value.trim(),
    medium:      document.getElementById('pmMedium').value.trim(),
    year:        parseInt(document.getElementById('pmYear').value),
    status:      document.getElementById('pmStatus').value,
    description: document.getElementById('pmDescription').value.trim(),
    image_url:   imageUrl,
    filename:    filename,
  };

  try {
    if (currentPainting) {
      await db.collection('paintings').doc(currentPainting.id).set(payload, { merge: true });
      logActivity('painting_update', auth.currentUser.email, payload.title);
    } else {
      const id = filename ? filename.replace(/\.[^.]+$/, '') : `painting-${Date.now()}`;
      await db.collection('paintings').doc(id).set({
        ...payload,
        sort_order: allPaintings.length + 1,
      });
      logActivity('painting_create', auth.currentUser.email, payload.title);
    }
    statusEl.textContent = 'Saved!';
    statusEl.style.color = '#2e7d32';
    setTimeout(closePaintingModal, 800);
    loadAll();
  } catch (err) {
    statusEl.textContent = 'Error saving. Try again.';
    statusEl.style.color = '#b71c1c';
  }

  statusEl.hidden = false;
  btn.disabled    = false;
  btn.textContent = 'Save Changes';
});

// Delete painting
document.getElementById('pmDeleteBtn').addEventListener('click', async () => {
  if (!currentPainting) return;
  if (!confirm(`Delete "${currentPainting.title}"? This cannot be undone.`)) return;

  const title = currentPainting.title;
  const id    = currentPainting.id;
  await db.collection('paintings').doc(id).delete();
  logActivity('painting_delete', auth.currentUser.email, title);
  closePaintingModal();
  loadAll();
});

// Add new painting
document.getElementById('addPaintingBtn').addEventListener('click', () => openPaintingModal(null));

// ── One-time migration: seed Firestore from data/paintings.json ──
document.getElementById('seedFirestoreBtn').addEventListener('click', async () => {
  const btn = document.getElementById('seedFirestoreBtn');
  if (!confirm('Import all paintings from data/paintings.json into Firestore? Existing docs with the same ID will be overwritten.')) return;

  btn.disabled    = true;
  btn.textContent = 'Importing...';

  try {
    const res  = await fetch('data/paintings.json');
    const rows = await res.json();
    const batch = db.batch();

    rows.forEach(p => {
      const id  = (p.filename || '').replace(/\.[^.]+$/, '') || `painting-${p.sort_order}`;
      const ref = db.collection('paintings').doc(id);
      batch.set(ref, p, { merge: true });
    });

    await batch.commit();
    logActivity('paintings_bulk_import', auth.currentUser.email, `${rows.length} paintings`);
    btn.textContent = 'Imported!';
    loadAll();
  } catch (err) {
    btn.textContent = 'Import failed';
  }

  setTimeout(() => { btn.disabled = false; btn.textContent = 'Import from JSON (one-time)'; }, 1500);
});

// ── Escape HTML ──
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Activity log ──
async function logActivity(type, email, details) {
  try {
    await db.collection('audit_log').add({
      type, email: email || '', details: details || '', timestamp: FV.serverTimestamp(),
    });
  } catch (err) {
    console.error('logActivity failed:', err);
  }
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function labelForType(type) {
  return {
    login_success:         'Login',
    login_failed:          'Login Failed',
    painting_create:       'Painting Added',
    painting_update:       'Painting Edited',
    painting_delete:       'Painting Deleted',
    paintings_bulk_import: 'Bulk Import',
    session_kicked:        'Session Ended (New Login)',
  }[type] || type;
}

async function loadActivityLog() {
  const tbody = document.getElementById('activityLogBody');
  const snap = await db.collection('audit_log').orderBy('timestamp', 'desc').limit(100).get();

  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-msg">No activity yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = snap.docs.map(d => {
    const e = d.data();
    return `
    <tr>
      <td class="date-cell">${fmtDate(e.timestamp)}</td>
      <td><span class="type-tag">${esc(labelForType(e.type))}</span></td>
      <td>${esc(e.email)}</td>
      <td>${esc(e.details)}</td>
    </tr>`;
  }).join('');
}

// ── Tab switching ──
document.querySelectorAll('.admin-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.hidden = true);
    tabBtn.classList.add('active');
    document.getElementById(tabBtn.dataset.tab).hidden = false;
    if (tabBtn.dataset.tab === 'tabActivityLog') loadActivityLog();
  });
});

// ── Init ──
if (localStorage.getItem(SIGNOUT_REASON_KEY) === 'elsewhere') {
  document.getElementById('signoutNotice').hidden = false;
  localStorage.removeItem(SIGNOUT_REASON_KEY);
}

auth.onAuthStateChanged(user => {
  if (user) showDashboard();
});
