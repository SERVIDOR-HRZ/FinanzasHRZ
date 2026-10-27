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

function scrollActual() {
  return window.scrollY
      || window.pageYOffset
      || document.documentElement.scrollTop
      || document.body.scrollTop
      || 0;
}

function actualizarScrollTop() {
  scrollTopBtn.classList.toggle('visible', scrollActual() > 140);
}

// Escuchamos en captura para detectar el scroll venga de donde venga
// (ventana o cualquier contenedor con scroll interno).
document.addEventListener('scroll', actualizarScrollTop, { passive: true, capture: true });
window.addEventListener('scroll', actualizarScrollTop, { passive: true });
window.addEventListener('resize', actualizarScrollTop, { passive: true });
window.addEventListener('load', actualizarScrollTop);
actualizarScrollTop();

scrollTopBtn.addEventListener('click', () => {
  // Sube tanto la ventana como cualquier contenedor scrolleable de la página
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.documentElement.scrollTo?.({ top: 0, behavior: 'smooth' });
  document.body.scrollTo?.({ top: 0, behavior: 'smooth' });
  document.querySelectorAll('.cuentas-page, .mov-page').forEach(el => {
    el.scrollTo?.({ top: 0, behavior: 'smooth' });
  });
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

// ── FAB contextual + Modal ───────────────────────────────────
// · Ingresos / Gastos  → abre directo el formulario del tipo de la página
// · Categorías         → abre directo "nueva categoría"
// · Cuentas / resto    → abre el menú de opciones
if (fab && modalOverlay) {
  const modalCancel  = document.getElementById('modalCancel');
  const optIngreso   = document.getElementById('optIngreso');
  const optGasto     = document.getElementById('optGasto');
  const optCategoria = document.getElementById('optCategoria');
  const optCuenta    = document.getElementById('optCuenta');

  const tipoPagina   = document.body.dataset.tipo || null;          // 'ingreso' | 'gasto'
  const enCategorias = location.pathname.endsWith('categorias.html');
  const enAgenda     = location.pathname.endsWith('agenda.html');
  const enCuentas    = !location.pathname.includes('/secciones/');
  const base         = location.pathname.includes('/secciones/') ? '' : 'secciones/';

  function openModal() {
    fab.classList.add('open');
    modalOverlay.setAttribute('aria-hidden', 'false');
    modalOverlay.classList.add('active');
    modalOverlay.classList.remove('closing');
  }

  function closeModal() {
    modalOverlay.classList.add('closing');
    modalOverlay.classList.remove('active');
    fab.classList.remove('open');
    setTimeout(() => {
      modalOverlay.classList.remove('closing');
      modalOverlay.setAttribute('aria-hidden', 'true');
    }, 300);
  }

  fab.addEventListener('click', () => {
    if (tipoPagina) {
      import('./quick-mov.js').then(({ openQuickMov }) => openQuickMov(tipoPagina));
      return;
    }
    if (enCategorias && window.abrirNuevaCategoria) {
      window.abrirNuevaCategoria();
      return;
    }
    if (enAgenda && window.abrirNuevoEvento) {
      window.abrirNuevoEvento();
      return;
    }
    openModal();
  });

  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
  modalCancel.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  import('./quick-mov.js').then(({ openQuickMov }) => {
    optIngreso?.addEventListener('click', () => { closeModal(); setTimeout(() => openQuickMov('ingreso'), 260); });
    optGasto?.addEventListener('click',   () => { closeModal(); setTimeout(() => openQuickMov('gasto'), 260); });
  });

  optCategoria?.addEventListener('click', () => {
    closeModal();
    if (enCategorias && window.abrirNuevaCategoria) {
      setTimeout(() => window.abrirNuevaCategoria(), 260);
    } else {
      location.href = `${base}categorias.html?nueva=1`;
    }
  });

  optCuenta?.addEventListener('click', () => {
    closeModal();
    if (enCuentas && window.abrirNuevaCuenta) {
      setTimeout(() => window.abrirNuevaCuenta(), 260);
    } else {
      location.href = '../index.html?nueva=1';
    }
  });
}

// ── Marcas de esquina en tarjetas héroe (capa visual "pro") ──
document.querySelectorAll('.balance-card, .mov-summary, .converter-card').forEach(card => {
  if (card.querySelector('.hero-corners')) return;
  const c = document.createElement('div');
  c.className = 'hero-corners';
  c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<i></i><i></i><i></i><i></i>';
  card.appendChild(c);
});

// ── PWA: service worker + aviso de instalación ───────────────
(() => {
  const base = location.pathname.includes('/secciones/') ? '../' : '';
  const enCuentas = !location.pathname.includes('/secciones/');
  const KEY = 'pwaInstallDone';        // 'instalada' | 'descartada'
  const yaDecidido = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
  const marcar = v => { try { localStorage.setItem(KEY, v); } catch {} };
  const esStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

  // Reinicio manual del aviso: abrir index.html?pwa=reset
  if (new URLSearchParams(location.search).get('pwa') === 'reset') {
    try { localStorage.removeItem(KEY); } catch {}
    history.replaceState(null, '', location.pathname);
  }

  // Service worker (solo con http/https; en file:// no aplica)
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(base + 'sw.js').catch(err => console.warn('SW no registrado', err));
    });
  }

  if (esStandalone) { marcar('instalada'); return; }   // ya corre como app: nunca más preguntar
  if (!enCuentas || yaDecidido()) return;              // solo en Cuentas y solo la primera vez

  let promptEvt = null;
  let banner = null;

  function mostrarBanner(modoIOS) {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'pwa-banner';
    banner.setAttribute('role', 'dialog');
    banner.innerHTML = `
      <div class="pwa-banner-ico"><img src="${base}elementos/img/icon-192.png" alt="" /></div>
      <div class="pwa-banner-text">
        <strong>Instala FinanzasHRZ</strong>
        ${modoIOS ? '<span>Toca <i class="fa-solid fa-arrow-up-from-bracket"></i> Compartir y luego <b>Añadir a pantalla de inicio</b>.</span>' : ''}
      </div>
      <div class="pwa-banner-btns">
        ${modoIOS ? '' : '<button class="pwa-btn-install" id="pwaInstalar"><i class="fa-solid fa-download"></i> Instalar</button>'}
        <button class="pwa-btn-later" id="pwaLuego" aria-label="Cerrar">${modoIOS ? 'Entendido' : 'Ahora no'}</button>
      </div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('visible'));

    const cerrar = () => { banner.classList.remove('visible'); setTimeout(() => banner.remove(), 350); banner = null; };

    banner.querySelector('#pwaLuego').addEventListener('click', () => { marcar('descartada'); cerrar(); });
    banner.querySelector('#pwaInstalar')?.addEventListener('click', async () => {
      if (!promptEvt) return;
      promptEvt.prompt();
      const { outcome } = await promptEvt.userChoice;
      promptEvt = null;
      marcar(outcome === 'accepted' ? 'instalada' : 'descartada');
      cerrar();
    });
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    promptEvt = e;
    setTimeout(() => mostrarBanner(false), 1200);
  });
  window.addEventListener('appinstalled', () => { marcar('instalada'); if (banner) { banner.classList.remove('visible'); setTimeout(() => banner?.remove(), 350); } });

  // iOS no dispara beforeinstallprompt: mostramos las instrucciones una vez
  if (esIOS) setTimeout(() => mostrarBanner(true), 1500);
})();
