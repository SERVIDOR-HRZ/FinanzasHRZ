// ── ICON-PICKER ─────────────────────────────────────────────
// Botón que abre una hoja modal para elegir un icono, con buscador
// y grupos por temática. Devuelve la clase FontAwesome elegida.
//
// Uso:
//   const picker = initIconPicker({ btn, selected, accent, onSelect });
//   picker.getSelected() / setSelected(clase)

import { ICON_GROUPS, ALL_ICONS } from "./icon-library.js";

export function initIconPicker({ btn, selected = null, accent = '#34d399', onSelect }) {
  let sel = selected || (ALL_ICONS[0] && ALL_ICONS[0].c);

  function renderBtn() {
    btn.innerHTML = `
      <span class="icon-select-preview" style="background:${accent}20;color:${accent};border-color:${accent}40">
        <i class="${sel}"></i>
      </span>
      <span class="icon-select-text">Cambiar icono</span>
      <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
  }

  function openPicker() {
    if (document.getElementById('modalIconPicker')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalIconPicker';
    overlay.innerHTML = `
    <div class="modal-sheet glass icon-picker-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
      <div class="modal-handle"></div>
      <p class="modal-eyebrow">Icono</p>
      <h2 class="modal-title">Elige un icono</h2>
      <div class="cat-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" class="cat-search-input" id="iconSearch" placeholder="Buscar icono…" autocomplete="off" />
      </div>
      <div class="icon-tabs" id="iconTabs"></div>
      <div class="icon-picker-grid" id="iconGrid"></div>
      <button class="modal-cancel" id="iconPickerCancel">Cerrar</button>
    </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });

    const tabsEl = overlay.querySelector('#iconTabs');
    const gridEl = overlay.querySelector('#iconGrid');
    const searchEl = overlay.querySelector('#iconSearch');
    let grupoActivo = ICON_GROUPS[0].id;

    // Pestañas de grupos
    tabsEl.innerHTML = ICON_GROUPS.map(g =>
      `<button class="icon-tab${g.id === grupoActivo ? ' active' : ''}" data-g="${g.id}" title="${g.label}">
        <i class="${g.icon}"></i>
      </button>`).join('');

    tabsEl.querySelectorAll('.icon-tab').forEach(t => {
      t.addEventListener('click', () => {
        grupoActivo = t.dataset.g;
        tabsEl.querySelectorAll('.icon-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        searchEl.value = '';
        renderGrid();
      });
    });

    function pintar(iconos) {
      if (!iconos.length) {
        gridEl.innerHTML = `<div class="cat-picker-empty">
          <i class="fa-solid fa-magnifying-glass"></i><span>Sin resultados</span>
        </div>`;
        return;
      }
      gridEl.innerHTML = iconos.map(ic =>
        `<button class="icon-pick-btn${ic.c === sel ? ' selected' : ''}" type="button" data-c="${ic.c}" title="${ic.k.split(' ')[0]}">
          <i class="${ic.c}"></i>
        </button>`).join('');

      gridEl.querySelectorAll('.icon-pick-btn').forEach(el => {
        el.addEventListener('click', () => {
          sel = el.dataset.c;
          renderBtn();
          if (onSelect) onSelect(sel);
          close();
        });
      });
    }

    function renderGrid() {
      const q = searchEl.value.trim().toLowerCase();
      if (q) {
        tabsEl.querySelectorAll('.icon-tab').forEach(x => x.classList.remove('active'));
        const found = ALL_ICONS.filter(ic => ic.k.toLowerCase().includes(q) || ic.c.toLowerCase().includes(q));
        // sin duplicados por clase
        const seen = new Set();
        pintar(found.filter(ic => !seen.has(ic.c) && seen.add(ic.c)));
      } else {
        const g = ICON_GROUPS.find(x => x.id === grupoActivo);
        pintar(g ? g.icons : []);
      }
    }

    searchEl.addEventListener('input', renderGrid);
    renderGrid();

    function close() {
      overlay.classList.add('closing'); overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 320);
    }
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#iconPickerCancel').addEventListener('click', close);
  }

  btn.addEventListener('click', openPicker);
  renderBtn();

  return {
    getSelected: () => sel,
    setSelected(c) { sel = c; renderBtn(); },
  };
}
