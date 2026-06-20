// ── Supabase ──
const SUPABASE_URL = 'https://djozmuyolvuzkcykoqhb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M5f5QO7e_PiAUGKLz5hUeQ_BrYyo1wl';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Escape HTML ──
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Likes ──
const likeCounts   = {};
const viewCounts   = {};
const LIKED_KEY    = 'uf_liked';
const likeInFlight = new Set();

function getLiked() { return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'); }
function saveLiked(arr) { localStorage.setItem(LIKED_KEY, JSON.stringify(arr)); }

async function loadLikes() {
  const { data } = await sb.from('likes').select('painting, count');
  if (data) data.forEach(r => { likeCounts[r.painting] = r.count; });
  updateAllBadges();
}

async function loadViews() {
  const { data } = await sb.from('views').select('painting, count');
  if (data) data.forEach(r => { viewCounts[r.painting] = r.count; });
}

function paintingIdFromItem(el) {
  return el.querySelector('img').src.split('/').pop().split('.')[0];
}

function updateAllBadges() {
  const liked = getLiked();
  document.querySelectorAll('.like-badge').forEach(badge => {
    const id    = badge.dataset.id;
    const count = likeCounts[id] || 0;
    badge.querySelector('.like-count').textContent = count > 0 ? count : '';
    badge.querySelector('.like-heart').textContent  = liked.includes(id) ? '♥' : '♡';
    badge.classList.toggle('liked', liked.includes(id));
  });
}

function updateLightboxLike(paintingId) {
  const liked   = getLiked();
  const count   = likeCounts[paintingId] || 0;
  const btn     = document.getElementById('lbLikeBtn');
  const countEl = document.getElementById('lbLikeCount');
  if (btn) {
    btn.querySelector('.lb-like-heart').textContent = liked.includes(paintingId) ? '♥' : '♡';
    btn.classList.toggle('liked', liked.includes(paintingId));
  }
  if (countEl) countEl.textContent = count;
}

async function toggleLike(paintingId) {
  if (likeInFlight.has(paintingId)) return;
  likeInFlight.add(paintingId);

  const btn = document.getElementById('lbLikeBtn');
  if (btn) btn.disabled = true;

  const liked   = getLiked();
  const isLiked = liked.includes(paintingId);

  likeCounts[paintingId] = isLiked
    ? Math.max(0, (likeCounts[paintingId] || 0) - 1)
    : (likeCounts[paintingId] || 0) + 1;
  saveLiked(isLiked ? liked.filter(id => id !== paintingId) : [...liked, paintingId]);
  updateAllBadges();
  updateLightboxLike(paintingId);

  await sb.rpc(isLiked ? 'decrement_like' : 'increment_like', { painting_id: paintingId });
  likeInFlight.delete(paintingId);
  if (btn) btn.disabled = false;
}

// ── View count ──
async function incrementView(paintingId) {
  const current = (viewCounts[paintingId] || 0) + 1;
  viewCounts[paintingId] = current;
  document.getElementById('lbViews').textContent = current + ' views';
  await sb.rpc('increment_view', { painting_id: paintingId });
}

// ── Nav scroll ──
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ── Mobile menu ──
document.querySelector('.nav-toggle').addEventListener('click', () => {
  document.querySelector('.nav-links').classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => document.querySelector('.nav-links').classList.remove('open'));
});

// ── Pagination ──
const PAGE_SIZE   = 9;
let visibleCount  = PAGE_SIZE;
const loadMoreBtn = document.getElementById('loadMoreBtn');
const countEl     = document.getElementById('galleryCount');

function applyPagination() {
  const all = Array.from(grid.querySelectorAll('.gallery-item'));
  all.forEach((el, i) => {
    el.classList.toggle('hidden-item', i >= visibleCount);
  });
  const shown = Math.min(visibleCount, all.length);
  countEl.textContent = `Showing ${shown} of ${all.length}`;
  loadMoreBtn.hidden  = shown >= all.length;
  rebindLightbox();
}

loadMoreBtn.addEventListener('click', () => {
  visibleCount += PAGE_SIZE;
  applyPagination();
});

// ── Sort ──
const grid = document.getElementById('galleryGrid');

function sortGallery(order) {
  visibleCount = PAGE_SIZE;
  const els = Array.from(grid.querySelectorAll('.gallery-item'));
  els.sort((a, b) => {
    const aO = parseInt(a.dataset.order) || 0;
    const bO = parseInt(b.dataset.order) || 0;
    return order === 'oldest' ? aO - bO : bO - aO;
  });
  els.forEach(el => grid.appendChild(el));
  applyPagination();
}

document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sortGallery(btn.dataset.sort);
  });
});

// ── Lightbox ──
const lightbox  = document.getElementById('lightbox');
const lbImg     = document.getElementById('lbImg');
const lbTitle   = document.getElementById('lbTitle');
const lbMedium  = document.getElementById('lbMedium');
const lbYear    = document.getElementById('lbYear');
const lbViews   = document.getElementById('lbViews');
const lbDesc    = document.getElementById('lbDesc');
const lbStatus  = document.getElementById('lbStatus');
const lbLikeBtn = document.getElementById('lbLikeBtn');
let items   = [];
let current = 0;
let currentPaintingId = '';

function rebindLightbox() {
  items = Array.from(grid.querySelectorAll('.gallery-item:not(.hidden-item)'));
  items.forEach(item => {
    if (!item.querySelector('.like-badge')) {
      const id    = paintingIdFromItem(item);
      const badge = document.createElement('div');
      badge.className  = 'like-badge';
      badge.dataset.id = id;
      badge.innerHTML  = '<span class="like-heart">♡</span><span class="like-count"></span>';
      item.appendChild(badge);
    }
  });
  items.forEach((item, i) => { item.onclick = () => openLightbox(i); });
  updateAllBadges();
}

function populateLightbox(index) {
  const el     = items[index];
  const img    = el.querySelector('img');
  const status = el.dataset.status || 'available';

  currentPaintingId    = paintingIdFromItem(el);
  lbImg.src            = img.src;
  lbImg.alt            = img.alt;
  lbTitle.textContent  = el.dataset.title       || '';
  lbMedium.textContent = el.dataset.medium      || '';
  lbYear.textContent   = el.dataset.year        || '';
  lbDesc.textContent   = el.dataset.description || '';
  lbStatus.textContent = status === 'sold' ? 'Sold' : 'Available';
  lbStatus.className   = 'lb-status ' + status;
  lbViews.textContent  = (viewCounts[currentPaintingId] || 0) + ' views';
  updateLightboxLike(currentPaintingId);
}

function openLightbox(index) {
  current = index;
  populateLightbox(current);
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  incrementView(currentPaintingId);
  loadReactions(currentPaintingId);
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function showNext() { current = (current + 1) % items.length; populateLightbox(current); loadReactions(currentPaintingId); }
function showPrev() { current = (current - 1 + items.length) % items.length; populateLightbox(current); loadReactions(currentPaintingId); }

// ── Reactions ──
const reactionCounts = {};
const REACTED_KEY    = 'uf_reacted';

function getReacted() { return JSON.parse(localStorage.getItem(REACTED_KEY) || '{}'); }
function saveReacted(obj) { localStorage.setItem(REACTED_KEY, JSON.stringify(obj)); }
function rkey(paintingId, type) { return `${paintingId}:${type}`; }

async function loadReactions(paintingId) {
  const keys = ['love','wow','want'].map(t => rkey(paintingId, t));
  const { data } = await sb.from('likes').select('painting,count').in('painting', keys);
  if (data) data.forEach(r => { reactionCounts[r.painting] = r.count; });
  updateReactionDisplay(paintingId);
}

function updateReactionDisplay(paintingId) {
  const reacted = getReacted();
  [['love','rcLove'],['wow','rcWow'],['want','rcWant']].forEach(([type, id]) => {
    const key     = rkey(paintingId, type);
    const countEl = document.getElementById(id);
    const btn     = countEl?.closest('.reaction-btn');
    if (countEl) countEl.textContent = reactionCounts[key] || 0;
    if (btn) btn.classList.toggle('reacted', !!reacted[key]);
  });
}

async function toggleReaction(paintingId, type) {
  const key      = rkey(paintingId, type);
  const reacted  = getReacted();
  const wasOn    = !!reacted[key];
  reactionCounts[key] = wasOn ? Math.max(0, (reactionCounts[key] || 0) - 1) : (reactionCounts[key] || 0) + 1;
  if (wasOn) delete reacted[key]; else reacted[key] = true;
  saveReacted(reacted);
  updateReactionDisplay(paintingId);
  await sb.rpc(wasOn ? 'decrement_like' : 'increment_like', { painting_id: key });
}

document.querySelectorAll('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isRateLimited('reaction', 2_000)) return;
    toggleReaction(currentPaintingId, btn.dataset.reaction);
  });
});

// ── Wishlist ──
document.getElementById('wishlistBtn').addEventListener('click', async () => {
  const email   = document.getElementById('wishlistEmail').value.trim();
  const consent = document.getElementById('wishlistConsent').checked;
  const msg     = document.getElementById('wishlistMsg');

  if (!consent) { msg.textContent = 'Please check the consent box.'; msg.hidden = false; return; }
  if (!email)   { msg.textContent = 'Please enter your email.';      msg.hidden = false; return; }
  if (isRateLimited('wishlist', 60_000)) {
    msg.textContent = 'Please wait before submitting again.'; msg.hidden = false; return;
  }

  const { error } = await sb.from('signups').insert({ email });
  msg.hidden = false;
  if (error?.code === '23505') {
    msg.textContent = "You're already subscribed!";
  } else if (error) {
    msg.textContent = 'Something went wrong. Try again.';
  } else {
    msg.textContent = "You're on the list!";
    document.getElementById('wishlistEmail').value = '';
    document.getElementById('wishlistConsent').checked = false;
  }
});

lbLikeBtn?.addEventListener('click', () => toggleLike(currentPaintingId));
document.querySelector('.lb-close').addEventListener('click', closeLightbox);
document.querySelector('.lb-next').addEventListener('click', showNext);
document.querySelector('.lb-prev').addEventListener('click', showPrev);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowRight') showNext();
  if (e.key === 'ArrowLeft')  showPrev();
});

// ── Commission type selection ──
document.querySelectorAll('.commission-chooser .commission-card').forEach(card => {
  function selectCard() {
    document.getElementById('commissionTypeInput').value = card.dataset.type;
    document.getElementById('commissionTypeBadge').textContent = card.dataset.label;
    document.getElementById('commissionStep1').hidden = true;
    document.getElementById('commissionStep2').hidden = false;
    document.getElementById('commissionStep2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  card.addEventListener('click', selectCard);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectCard(); });
});

document.getElementById('commissionChangeBtn').addEventListener('click', () => {
  document.getElementById('commissionStep1').hidden = false;
  document.getElementById('commissionStep2').hidden = true;
  document.getElementById('commissionStep1').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ── Form rate limiting (persists across reloads via localStorage) ──
function isRateLimited(key, cooldownMs = 60_000) {
  const storageKey = 'uf_rl_' + key;
  const last = parseInt(localStorage.getItem(storageKey) || '0');
  if (Date.now() - last < cooldownMs) return true;
  localStorage.setItem(storageKey, Date.now().toString());
  return false;
}

// ── Commission form ──
document.getElementById('commissionForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form    = e.target;
  const success = form.querySelector('.success');
  const error   = form.querySelector('.error');
  const btn     = form.querySelector('button[type=submit]');

  if (isRateLimited('commission')) {
    error.textContent = 'Please wait before submitting again.';
    error.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  success.hidden = true;
  error.hidden   = true;

  const { error: err } = await sb.from('commissions').insert({
    name:        form.name.value.trim(),
    email:       form.email.value.trim(),
    type:        form.type.value,
    description: form.description.value.trim(),
  });

  if (err) {
    error.hidden = false;
  } else {
    success.hidden = false;
    form.reset();
  }

  btn.disabled = false;
  btn.textContent = 'Send Request';
});

// ── Contact form ──
document.getElementById('contactForm').addEventListener('submit', async e => {
  e.preventDefault();
  const form    = e.target;
  const success = form.querySelector('.success');
  const error   = form.querySelector('.error');
  const btn     = form.querySelector('button[type=submit]');

  if (isRateLimited('contact')) {
    error.textContent = 'Please wait before submitting again.';
    error.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending...';
  success.hidden = true;
  error.hidden   = true;

  const { error: err } = await sb.from('messages').insert({
    name:    form.name.value.trim(),
    email:   form.email.value.trim(),
    message: form.message.value.trim(),
  });

  if (err) {
    error.hidden = false;
  } else {
    success.hidden = false;
    form.reset();
  }

  btn.disabled = false;
  btn.textContent = 'Send Message';
});

// ── Load paintings from Supabase ──
async function loadPaintings() {
  let data;
  const { data: sbData, error } = await sb
    .from('paintings')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !sbData?.length) {
    const res = await fetch('data/paintings.json');
    data = await res.json();
  } else {
    data = sbData;
  }

  if (!data?.length) return;

  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = '';

  data.forEach(p => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.dataset.category    = p.category    || 'acrylic';
    div.dataset.order       = p.sort_order  || 0;
    div.dataset.title       = p.title       || '';
    div.dataset.medium      = p.medium      || '';
    div.dataset.year        = p.year        || '';
    div.dataset.description = p.description || '';
    div.dataset.status      = p.status      || 'available';
    div.dataset.paintingId  = p.id;

    div.innerHTML = `
      <img src="${esc(p.image_url || 'images/' + p.filename)}" alt="${esc(p.title)}" loading="lazy" />
      <div class="item-hover"><span>View</span></div>
    `;
    grid.appendChild(div);
  });

  sortGallery('newest');
  loadLikes();
  loadViews();
}

// ── Email signup ──
document.getElementById('signupForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form    = e.target;
  const success = form.parentElement.querySelector('.signup-success');
  const btn     = form.querySelector('button');

  if (isRateLimited('signup')) return;

  btn.disabled    = true;
  btn.textContent = '...';

  const { error } = await sb.from('signups').insert({ email: form.email.value.trim() });

  if (!error) {
    success.hidden = false;
    form.hidden    = true;
  } else if (error.code === '23505') {
    success.hidden = false;
    success.textContent = 'You are already subscribed!';
    form.hidden = true;
  }

  btn.disabled    = false;
  btn.textContent = 'Subscribe';
});

// ── Init ──
try { loadPaintings(); } catch(e) { console.error('Init failed:', e); }
