// ── ICON-PICKER ─────────────────────────────────────────────
// Botón que abre una hoja modal para elegir un icono. Muestra TODOS
// los iconos directamente, agrupados por secciones con su título, y
// un buscador arriba para filtrar por nombre/palabra clave.
//
// Uso:
//   const picker = initIconPicker({ btn, selected, accent, onSelect });
//   picker.getSelected() / setSelected(clase)

import { ICON_GROUPS, ALL_ICONS } from "./icon-library.js";

export function initIconPicker({ btn, selected = null, accent = '#34d399', onSelect }) {
  let sel = selected || (ALL_ICONS[0] && ALL_ICONS[0].c);
  let acc = accent;

  function renderBtn() {
    btn.innerHTML = `
      <span class="icon-select-preview" style="background:${acc}20;color:${acc};border-color:${acc}40">
        <i class="${sel}"></i>
      </span>
      <span class="icon-select-text">Cambiar icono</span>
      <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
  }

  function openPicker() {
    if (document.getElementById('modalIconPicker')) return;

    // Selección temporal: solo se aplica al confirmar con "Usar icono".
    let tempSel = sel;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalIconPicker';
    overlay.innerHTML = `
    <div class="modal-sheet glass icon-picker-sheet" role="dialog" aria-modal="true" style="--accent:${acc}">
      <div class="modal-handle"></div>
      <p class="modal-eyebrow">Icono</p>
      <h2 class="modal-title">Elige un icono</h2>
      <div class="cat-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" class="cat-search-input" id="iconSearch" placeholder="Buscar icono…" autocomplete="off" />
      </div>
      <div class="icon-picker-scroll" id="iconScroll"></div>
      <div class="modal-actions">
        <button class="modal-cancel" id="iconPickerCancel">Cancelar</button>
        <button class="btn-primary" id="iconPickerUsar"><i class="fa-solid fa-check"></i> Usar icono</button>
      </div>
    </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });

    const scrollEl = overlay.querySelector('#iconScroll');
    const searchEl = overlay.querySelector('#iconSearch');

    const iconoHTML = ic =>
      `<button class="icon-pick-btn${ic.c === tempSel ? ' selected' : ''}" type="button" data-c="${ic.c}">
        <i class="${ic.c}"></i>
      </button>`;

    function bindBtns() {
      scrollEl.querySelectorAll('.icon-pick-btn').forEach(el => {
        el.addEventListener('click', () => {
          // Solo marca el icono como seleccionado, sin cerrar la hoja.
          tempSel = el.dataset.c;
          scrollEl.querySelectorAll('.icon-pick-btn.selected').forEach(b => b.classList.remove('selected'));
          el.classList.add('selected');
        });
      });
    }

    // Vista completa: todas las secciones con su título
    function renderAll() {
      scrollEl.innerHTML = ICON_GROUPS.map(g => `
        <div class="icon-section-title"><i class="${g.icon}"></i> ${g.label}</div>
        <div class="icon-picker-grid">${g.icons.map(iconoHTML).join('')}</div>
      `).join('');
      bindBtns();
    }

    // Vista de búsqueda: una sola rejilla con resultados
    function renderSearch(q) {
      const seen = new Set();
      const found = ALL_ICONS.filter(ic => {
        if (seen.has(ic.c)) return false;
        const match = ic.k.toLowerCase().includes(q) || ic.c.toLowerCase().includes(q);
        if (match) seen.add(ic.c);
        return match;
      });
      if (!found.length) {
        scrollEl.innerHTML = `<div class="cat-picker-empty">
          <i class="fa-solid fa-magnifying-glass"></i><span>Sin resultados para "${q}"</span>
        </div>`;
        return;
      }
      scrollEl.innerHTML = `<div class="icon-picker-grid">${found.map(iconoHTML).join('')}</div>`;
      bindBtns();
    }

    function render() {
      const q = searchEl.value.trim().toLowerCase();
      if (q) renderSearch(q);
      else renderAll();
    }

    searchEl.addEventListener('input', render);
    renderAll();

    function close() {
      overlay.classList.add('closing'); overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 320);
    }
    function confirmar() {
      sel = tempSel;
      renderBtn();
      if (onSelect) onSelect(sel);
      close();
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#iconPickerCancel').addEventListener('click', close);
    overlay.querySelector('#iconPickerUsar').addEventListener('click', confirmar);
  }

  btn.addEventListener('click', openPicker);
  renderBtn();

  return {
    getSelected: () => sel,
    setSelected(c) { sel = c; renderBtn(); },
    setAccent(color) { acc = color; renderBtn(); },
  };
}
