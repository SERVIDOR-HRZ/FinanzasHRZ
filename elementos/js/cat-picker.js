// ── CAT-PICKER ──────────────────────────────────────────────
// Selector de categoría reutilizable: un botón que abre una hoja
// modal con buscador y lista de todas las categorías disponibles.
//
// Uso:
//   const picker = initCatPicker({ btn, cats, selectedId, accent, tipo, onSelect });
//   picker.getSelected();      // id actual
//   picker.setSelected(id);    // fijar desde fuera (p. ej. IA)
//   picker.setCats(nuevas);    // refrescar lista

export function initCatPicker({ btn, cats = [], selectedId = null, accent = '#34d399', tipo = 'gasto', onSelect }) {
  let lista = cats;
  let selected = selectedId;

  const byId = id => lista.find(c => c.id === id);
  const label = c => c ? (c.nombre || c.label) : null;

  function renderBtn() {
    const c = byId(selected);
    if (c) {
      btn.classList.remove('empty');
      btn.innerHTML = `
        <span class="cat-select-icon" style="background:${c.color}20;color:${c.color};border-color:${c.color}40">
          <i class="${c.icon}"></i>
        </span>
        <span class="cat-select-name">${label(c)}</span>
        <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
    } else {
      btn.classList.add('empty');
      btn.innerHTML = `
        <span class="cat-select-icon"><i class="fa-solid fa-tag"></i></span>
        <span class="cat-select-name muted">Seleccionar categoría</span>
        <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
    }
  }

  function openPicker() {
    if (document.getElementById('modalCatPicker')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalCatPicker';
    overlay.innerHTML = `
    <div class="modal-sheet glass cat-picker-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
      <div class="modal-handle"></div>
      <p class="modal-eyebrow">Categoría</p>
      <h2 class="modal-title">Selecciona una categoría</h2>
      <div class="cat-search-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" class="cat-search-input" id="catSearch" placeholder="Buscar categoría…" autocomplete="off" />
      </div>
      <div class="cat-picker-list" id="catPickerList"></div>
      <button class="modal-cancel" id="catPickerCancel">Cerrar</button>
    </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });

    const listEl = overlay.querySelector('#catPickerList');
    const searchEl = overlay.querySelector('#catSearch');

    function renderList(filtro = '') {
      const q = filtro.trim().toLowerCase();
      const items = lista.filter(c => label(c).toLowerCase().includes(q));

      if (!items.length) {
        listEl.innerHTML = `<div class="cat-picker-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span>${lista.length ? 'Sin resultados' : `No hay categorías de ${tipo}`}</span>
        </div>`;
        return;
      }

      listEl.innerHTML = items.map(c => `
        <button class="cat-picker-item${c.id === selected ? ' selected' : ''}" type="button" data-id="${c.id}">
          <span class="cat-picker-item-icon" style="background:${c.color}20;color:${c.color};border-color:${c.color}40">
            <i class="${c.icon}"></i>
          </span>
          <span class="cat-picker-item-name">${label(c)}</span>
          ${c.valor ? `<span class="cat-picker-item-val">${new Intl.NumberFormat('es-CO').format(c.valor)}</span>` : ''}
          ${c.id === selected ? '<i class="fa-solid fa-check cat-picker-item-check"></i>' : ''}
        </button>`).join('');

      listEl.querySelectorAll('.cat-picker-item').forEach(el => {
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
    overlay.querySelector('#catPickerCancel').addEventListener('click', close);
  }

  btn.addEventListener('click', openPicker);
  renderBtn();

  return {
    getSelected: () => selected,
    setSelected(id) { selected = id; renderBtn(); },
    setCats(nuevas) { lista = nuevas; renderBtn(); },
  };
}
