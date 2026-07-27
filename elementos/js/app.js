const navItems   = document.querySelectorAll('.nav-item');
const navWrapper = document.querySelector('.nav-wrapper');
const fab        = document.getElementById('fabBtn');
const modalOverlay = document.getElementById('modalOverlay');
const navWrapper2  = navWrapper;

// ── Teclado virtual ──────────────────────────────────────────
// Solo ocultamos el nav si hay un campo de texto realmente enfocado.
// (Antes se activaba solo por diferencias de altura de la barra del
//  navegador, lo que dejaba el nav sin poder tocarse.)
function inputEnfocado() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
}

const initialHeight = window.innerHeight;

function checkKeyboard(h) {
  const teclado = (initialHeight - h) > 150 && inputEnfocado();
  navWrapper.classList.toggle('keyboard-open', teclado);
}

window.addEventListener('resize', () => {
  checkKeyboard(window.visualViewport ? window.visualViewport.height : window.innerHeight);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => checkKeyboard(window.visualViewport.height));
}

// Al quitar el foco de un input, restauramos el nav
document.addEventListener('focusout', () => {
  setTimeout(() => { if (!inputEnfocado()) navWrapper.classList.remove('keyboard-open'); }, 100);
});

// ── Botón subir al inicio ────────────────────────────────────
const scrollTopBtn = document.createElement('button');
scrollTopBtn.className = 'scroll-top-btn';
scrollTopBtn.setAttribute('aria-label', 'Subir al inicio');
scrollTopBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
document.body.appendChild(scrollTopBtn);

window.addEventListener('scroll', () => {
  scrollTopBtn.classList.toggle('visible', window.scrollY > 320);
}, { passive: true });

scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Nav activo ───────────────────────────────────────────────
navItems.forEach(item => {
  item.addEventListener('click', e => {
    const href = item.getAttribute('href');
    if (!href || href === '#') e.preventDefault();
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

// ── FAB + Modal ingreso/gasto ────────────────────────────────
if (fab && modalOverlay) {
  const modalCancel = document.getElementById('modalCancel');
  const optIngreso  = document.getElementById('optIngreso');
  const optGasto    = document.getElementById('optGasto');

  fab.addEventListener('click', () => {
    fab.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    modalOverlay.classList.add('active');
    modalOverlay.classList.remove('closing');
  });

  function closeModal() {
    modalOverlay.classList.add('closing');
    modalOverlay.classList.remove('active');
    fab.classList.remove('open');
    setTimeout(() => {
      modalOverlay.classList.remove('closing');
      modalOverlay.setAttribute('aria-hidden', 'true');
    }, 300);
  }

  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  modalCancel.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Abrir el formulario directo desde cualquier pantalla
  import('./quick-mov.js').then(({ openQuickMov }) => {
    optIngreso.addEventListener('click', () => { closeModal(); setTimeout(() => openQuickMov('ingreso'), 260); });
    optGasto.addEventListener('click',   () => { closeModal(); setTimeout(() => openQuickMov('gasto'), 260); });
  });
}
