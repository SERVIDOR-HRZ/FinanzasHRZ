// ── CUENTA-PICKER ───────────────────────────────────────────
// Selector de cuenta reutilizable: botón + hoja modal con buscador,
// mismo estilo que el selector de categoría.
//
// Uso:
//   const picker = initCuentaPicker({ btn, cuentas, selectedId, accent, onSelect });
//   picker.getSelected() / setSelected(id) / setCuentas(lista)

// Mapa de iconos de cuentas (igual que en cuentas.js)
const CUENTA_ICONOS = {
  efectivo: 'fa-solid fa-money-bill-wave',
  banco: 'fa-solid fa-building-columns',
  tarjeta: 'fa-solid fa-credit-card',
  paypal: 'fa-brands fa-paypal',
  mercadopago: 'fa-solid fa-tag',
  nequi: 'fa-solid fa-mobile-screen',
  crypto: 'fa-solid fa-bitcoin-sign',
  binance: 'fa-solid fa-coins',
  ahorro: 'fa-solid fa-piggy-bank',
  inversion: 'fa-solid fa-chart-line',
  negocio: 'fa-solid fa-briefcase',
  wallet: 'fa-solid fa-wallet',
  transferencia: 'fa-solid fa-right-left',
  recibo: 'fa-solid fa-receipt',
  caja: 'fa-solid fa-cash-register',
  porcentaje: 'fa-solid fa-percent',
  deuda: 'fa-solid fa-hand-holding-dollar',
  banco2: 'fa-solid fa-landmark',
};

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const iconoDe = c => CUENTA_ICONOS[c && c.icono] || 'fa-solid fa-wallet';
const colorDe = c => (c && c.color) || '#94a3b8';

export function initCuentaPicker({ btn, cuentas = [], selectedId = null, accent = '#34d399', onSelect, noneLabel = null, placeholder = 'Seleccionar cuenta' }) {
  let lista = cuentas;
  let selected = selectedId;

  const byId = id => lista.find(c => c.id === id);

  function renderBtn() {
    const c = byId(selected);
    if (c) {
      const color = colorDe(c);
      btn.classList.remove('empty');
      btn.innerHTML = `
        <span class="cat-select-icon" style="background:${color}20;color:${color};border-color:${color}40">
          <i class="${iconoDe(c)}"></i>
        </span>
        <span class="cat-select-name">${c.nombre}</span>
        <span class="cuenta-select-saldo">${fmt(c.monto)}</span>
        <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
    } else {
      btn.classList.add('empty');
      btn.innerHTML = `
        <span class="cat-select-icon"><i class="fa-solid fa-wallet"></i></span>
        <span class="cat-select-name muted">${noneLabel || placeholder}</span>
        <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
    }
  }

  function openPicker() {
    if (document.getElementById('modalCuentaPicker')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalCuentaPicker';
    overlay.innerHTML = `
    <div class="modal-sheet glass cat-picker-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
      <div class="modal-handle"></div>
      <p class="modal-eyebrow">Cuenta</p>
      <h2 class="modal-title">Selecciona una cuenta</h2>
      <div class="cat-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" class="cat-search-input" id="cuentaSearch" placeholder="Buscar cuenta…" autocomplete="off" />
      </div>
      <div class="cat-picker-list" id="cuentaPickerList"></div>
      <button class="modal-cancel" id="cuentaPickerCancel">Cerrar</button>
    </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });

    const listEl = overlay.querySelector('#cuentaPickerList');
    const searchEl = overlay.querySelector('#cuentaSearch');

    function renderList(filtro = '') {
      const q = filtro.trim().toLowerCase();
      const items = lista.filter(c => (c.nombre || '').toLowerCase().includes(q));

      // Opción "ninguna" (solo sin filtro y si se pidió)
      const noneHTML = (noneLabel && !q) ? `
        <button class="cat-picker-item${!selected ? ' selected' : ''}" type="button" data-none="1">
          <span class="cat-picker-item-icon" style="background:rgba(255,255,255,.06);color:rgba(255,255,255,.5)">
            <i class="fa-solid fa-ban"></i>
          </span>
          <span class="cat-picker-item-name">${noneLabel}</span>
          ${!selected ? '<i class="fa-solid fa-check cat-picker-item-check"></i>' : ''}
        </button>` : '';

      if (!items.length && !noneHTML) {
        listEl.innerHTML = `<div class="cat-picker-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span>${lista.length ? 'Sin resultados' : 'No hay cuentas'}</span>
        </div>`;
        return;
      }

      listEl.innerHTML = noneHTML + items.map(c => {
        const color = colorDe(c);
        return `
        <button class="cat-picker-item${c.id === selected ? ' selected' : ''}" type="button" data-id="${c.id}">
          <span class="cat-picker-item-icon" style="background:${color}20;color:${color};border-color:${color}40">
            <i class="${iconoDe(c)}"></i>
          </span>
          <span class="cat-picker-item-name">${c.nombre}</span>
          <span class="cat-picker-item-val">${fmt(c.monto)}</span>
          ${c.id === selected ? '<i class="fa-solid fa-check cat-picker-item-check"></i>' : ''}
        </button>`;
      }).join('');

      const noneBtn = listEl.querySelector('[data-none]');
      if (noneBtn) noneBtn.addEventListener('click', () => {
        selected = null;
        renderBtn();
        if (onSelect) onSelect(null);
        close();
      });

      listEl.querySelectorAll('.cat-picker-item[data-id]').forEach(el => {
        el.addEventListener('click', () => {
          selected = el.dataset.id;
          renderBtn();
          if (onSelect) onSelect(byId(selected));
          close();
        });
      });
    }

    searchEl.addEventListener('input', () => renderList(searchEl.value));
    renderList();

    function close() {
      overlay.classList.add('closing'); overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 320);
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#cuentaPickerCancel').addEventListener('click', close);
  }

  btn.addEventListener('click', openPicker);
  renderBtn();

  return {
    getSelected: () => selected,
    setSelected(id) { selected = id; renderBtn(); },
    setCuentas(nuevas) { lista = nuevas; renderBtn(); },
  };
}
