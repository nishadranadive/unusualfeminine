// ── Supabase ──
const SUPABASE_URL = 'https://djozmuyolvuzkcykoqhb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_M5f5QO7e_PiAUGKLz5hUeQ_BrYyo1wl';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const likeCounts  = {};
const LIKED_KEY   = 'uf_liked';
const likeInFlight = new Set();

function getLiked() {
  return JSON.parse(localStorage.getItem(LIKED_KEY) || '[]');
}
function saveLiked(arr) {
  localStorage.setItem(LIKED_KEY, JSON.stringify(arr));
}

async function loadLikes() {
  const { data } = await sb.from('likes').select('painting, count');
  if (data) data.forEach(r => { likeCounts[r.painting] = r.count; });
  updateAllBadges();
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
  const liked  = getLiked();
  const count  = likeCounts[paintingId] || 0;
  const btn    = document.getElementById('lbLikeBtn');
  const countEl = document.getElementById('lbLikeCount');
  btn.querySelector('.lb-like-heart').textContent = liked.includes(paintingId) ? '♥' : '♡';
  btn.classList.toggle('liked', liked.includes(paintingId));
  countEl.textContent = count;
}

async function toggleLike(paintingId) {
  if (likeInFlight.has(paintingId)) return;
  likeInFlight.add(paintingId);

  const btn = document.getElementById('lbLikeBtn');
  btn.disabled = true;

  const liked    = getLiked();
  const isLiked  = liked.includes(paintingId);
  const newCount = isLiked ? Math.max(0, (likeCounts[paintingId] || 0) - 1) : (likeCounts[paintingId] || 0) + 1;

  likeCounts[paintingId] = newCount;
  saveLiked(isLiked ? liked.filter(id => id !== paintingId) : [...liked, paintingId]);

  updateAllBadges();
  updateLightboxLike(paintingId);

  await sb.from('likes').upsert({ painting: paintingId, count: newCount });

  likeInFlight.delete(paintingId);
  btn.disabled = false;
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

// ── Sort ──
const grid = document.getElementById('galleryGrid');

function sortGallery(order) {
  const els = Array.from(grid.querySelectorAll('.gallery-item'));
  els.sort((a, b) => {
    const aO = parseInt(a.dataset.order) || 0;
    const bO = parseInt(b.dataset.order) || 0;
    return order === 'oldest' ? aO - bO : bO - aO;
  });
  els.forEach(el => grid.appendChild(el));
  rebindLightbox();
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
const lbDesc    = document.getElementById('lbDesc');
const lbStatus  = document.getElementById('lbStatus');
const lbLikeBtn = document.getElementById('lbLikeBtn');
let items   = [];
let current = 0;
let currentPaintingId = '';

function rebindLightbox() {
  items = Array.from(grid.querySelectorAll('.gallery-item'));

  // Attach like badges dynamically
  items.forEach(item => {
    if (!item.querySelector('.like-badge')) {
      const id    = paintingIdFromItem(item);
      const badge = document.createElement('div');
      badge.className   = 'like-badge';
      badge.dataset.id  = id;
      badge.innerHTML   = '<span class="like-heart">♡</span><span class="like-count"></span>';
      item.appendChild(badge);
    }
  });

  items.forEach((item, i) => {
    item.onclick = () => openLightbox(i);
  });

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
  updateLightboxLike(currentPaintingId);
}

function openLightbox(index) {
  current = index;
  populateLightbox(current);
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function showNext() { current = (current + 1) % items.length; populateLightbox(current); }
function showPrev() { current = (current - 1 + items.length) % items.length; populateLightbox(current); }

lbLikeBtn.addEventListener('click', () => toggleLike(currentPaintingId));
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

// ── Init ──
sortGallery('newest');
loadLikes();
