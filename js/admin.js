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

    try {
      await auth.signInWithEmailAndPassword(email, password);
      showDashboard();
    } catch (err) {
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

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await auth.signOut();
  location.reload();
});

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
    } else {
      const id = filename ? filename.replace(/\.[^.]+$/, '') : `painting-${Date.now()}`;
      await db.collection('paintings').doc(id).set({
        ...payload,
        sort_order: allPaintings.length + 1,
      });
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

  await db.collection('paintings').doc(currentPainting.id).delete();
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

// ── Init ──
auth.onAuthStateChanged(user => {
  if (user) showDashboard();
});
