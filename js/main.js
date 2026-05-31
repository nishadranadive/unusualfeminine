// Nav scroll effect
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// Mobile menu
document.querySelector('.nav-toggle').addEventListener('click', () => {
  document.querySelector('.nav-links').classList.toggle('open');
});

document.querySelectorAll('.nav-links a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelector('.nav-links').classList.remove('open');
  });
});

// Lightbox
const lightbox = document.getElementById('lightbox');
const lbImg    = document.getElementById('lbImg');
const lbTitle  = document.getElementById('lbTitle');
const lbMedium = document.getElementById('lbMedium');
const lbYear   = document.getElementById('lbYear');
const lbDesc   = document.getElementById('lbDesc');
const lbStatus = document.getElementById('lbStatus');
const items    = Array.from(document.querySelectorAll('.gallery-item'));
let current    = 0;

function populateLightbox(index) {
  const el     = items[index];
  const img    = el.querySelector('img');
  const status = el.dataset.status || 'available';

  lbImg.src              = img.src;
  lbImg.alt              = img.alt;
  lbTitle.textContent    = el.dataset.title       || '';
  lbMedium.textContent   = el.dataset.medium      || '';
  lbYear.textContent     = el.dataset.year        || '';
  lbDesc.textContent     = el.dataset.description || '';
  lbStatus.textContent   = status === 'sold' ? 'Sold' : 'Available';
  lbStatus.className     = 'lb-status ' + status;
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

function showNext() {
  current = (current + 1) % items.length;
  populateLightbox(current);
}

function showPrev() {
  current = (current - 1 + items.length) % items.length;
  populateLightbox(current);
}

items.forEach((item, i) => {
  item.addEventListener('click', () => openLightbox(i));
});

document.querySelector('.lb-close').addEventListener('click', closeLightbox);
document.querySelector('.lb-next').addEventListener('click', showNext);
document.querySelector('.lb-prev').addEventListener('click', showPrev);

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowRight') showNext();
  if (e.key === 'ArrowLeft')  showPrev();
});
