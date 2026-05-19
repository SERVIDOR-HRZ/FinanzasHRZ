const navItems = document.querySelectorAll('.nav-item');
const fab = document.getElementById('fabBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalCancel = document.getElementById('modalCancel');
const optIngreso = document.getElementById('optIngreso');
const optGasto = document.getElementById('optGasto');
const navWrapper = document.querySelector('.nav-wrapper');

// Detectar teclado virtual (cuando el viewport se achica más del 25%)
const initialHeight = window.innerHeight;
window.addEventListener('resize', () => {
  const currentHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const diff = initialHeight - currentHeight;
  if (diff > 150) {
    navWrapper.classList.add('keyboard-open');
  } else {
    navWrapper.classList.remove('keyboard-open');
  }
});

// También con visualViewport API (más preciso en móviles)
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const diff = initialHeight - window.visualViewport.height;
    if (diff > 150) {
      navWrapper.classList.add('keyboard-open');
    } else {
      navWrapper.classList.remove('keyboard-open');
    }
  });
}

// Nav activo
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    const href = item.getAttribute('href');
    // Solo bloquear navegación si es un link vacío (#)
    if (!href || href === '#') {
      e.preventDefault();
    }
    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

// Abrir modal
fab.addEventListener('click', () => {
  fab.classList.add('open');
  modalOverlay.setAttribute('aria-hidden', 'false');
  modalOverlay.classList.add('active');
  modalOverlay.classList.remove('closing');
});

// Cerrar modal
function closeModal() {
  modalOverlay.classList.add('closing');
  modalOverlay.classList.remove('active');
  fab.classList.remove('open');
  setTimeout(() => {
    modalOverlay.classList.remove('closing');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }, 300);
}

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalCancel.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

optIngreso.addEventListener('click', () => {
  closeModal();
  console.log('Nuevo ingreso');
});

optGasto.addEventListener('click', () => {
  closeModal();
  console.log('Nuevo gasto');
});
