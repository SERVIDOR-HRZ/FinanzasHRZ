const navItems = document.querySelectorAll('.nav-item');
const fab = document.getElementById('fabBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalCancel = document.getElementById('modalCancel');
const optIngreso = document.getElementById('optIngreso');
const optGasto = document.getElementById('optGasto');

// Nav activo
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
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

// Cerrar modal con animación
function closeModal() {
  modalOverlay.classList.add('closing');
  modalOverlay.classList.remove('active');
  fab.classList.remove('open');
  setTimeout(() => {
    modalOverlay.classList.remove('closing');
    modalOverlay.setAttribute('aria-hidden', 'true');
  }, 300);
}

// Cerrar al tocar overlay (fuera del sheet)
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

modalCancel.addEventListener('click', closeModal);

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Opciones
optIngreso.addEventListener('click', () => {
  closeModal();
  // TODO: abrir formulario de ingreso
  console.log('Nuevo ingreso');
});

optGasto.addEventListener('click', () => {
  closeModal();
  // TODO: abrir formulario de gasto
  console.log('Nuevo gasto');
});
