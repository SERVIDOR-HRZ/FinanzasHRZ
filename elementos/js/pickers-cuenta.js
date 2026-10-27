// ── PICKERS DEL FORMULARIO DE CUENTA ────────────────────────
// Dos selectores con el mismo patrón que el icon-picker:
// un botón en el formulario que abre una hoja emergente.
//
//   initColorPicker({ btn, colores, selected, onSelect })
//   initOpcionPicker({ btn, opciones, selected, eyebrow, titulo, placeholder, onSelect })

function abrirHoja(id, html) {
  if (document.getElementById(id)) return null;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = id;
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });
  const close = () => {
    overlay.classList.add('closing'); overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 320);
  };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  return { overlay, close };
}

// ── Color ────────────────────────────────────────────────────
export function initColorPicker({ btn, colores, selected = null, accent = '#38bdf8', onSelect }) {
  let sel = selected;

  function renderBtn() {
    btn.classList.toggle('empty', !sel);
    btn.innerHTML = sel
      ? `<span class="color-select-swatch" style="--sw:${sel}"></span>
         <span class="cat-select-name">Color elegido</span>
         <span class="color-select-hex">${sel.toUpperCase()}</span>
         <i class="fa-solid fa-chevron-down cat-select-chev"></i>`
      : `<span class="color-select-swatch none"><i class="fa-solid fa-palette"></i></span>
         <span class="cat-select-name muted">Elegir color</span>
         <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
  }

  function open() {
    let temp = sel;
    const hoja = abrirHoja('modalColorPicker', `
    <div class="modal-sheet glass color-picker-sheet cuenta-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
      <div class="modal-handle"></div>
      <p class="modal-eyebrow">Color</p>
      <h2 class="modal-title">Elige un color</h2>
      <p class="modal-subtitle">Identifica la cuenta de un vistazo</p>
      <div class="color-picker-grid" id="colorGrid">
        ${colores.map(c => `
          <button type="button" class="color-pick-btn${c === temp ? ' selected' : ''}" data-color="${c}" style="--sw:${c}" aria-label="${c}">
            <i class="fa-solid fa-check"></i>
          </button>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="modal-cancel" id="colorCancel">Cancelar</button>
        <button class="btn-primary" id="colorUsar"><i class="fa-solid fa-check"></i> Usar color</button>
      </div>
    </div>`);
    if (!hoja) return;
    const { overlay, close } = hoja;
    const grid = overlay.querySelector('#colorGrid');
    const usar = overlay.querySelector('#colorUsar');

    function pintar() {
      overlay.querySelector('.color-picker-sheet').style.setProperty('--accent', temp || accent);
    }

    grid.querySelectorAll('.color-pick-btn').forEach(el => {
      el.addEventListener('click', () => {
        temp = el.dataset.color;
        grid.querySelectorAll('.color-pick-btn.selected').forEach(b => b.classList.remove('selected'));
        el.classList.add('selected');
        pintar();
      });
    });
    pintar();

    overlay.querySelector('#colorCancel').addEventListener('click', close);
    usar.addEventListener('click', () => {
      if (!temp) { grid.classList.add('grid-error'); return; }
      sel = temp;
      renderBtn();
      btn.classList.remove('input-error');
      if (onSelect) onSelect(sel);
      close();
    });
  }

  btn.addEventListener('click', open);
  renderBtn();

  return {
    getSelected: () => sel,
    setSelected(c) { sel = c; renderBtn(); },
    marcarError() { btn.classList.add('input-error'); },
  };
}

// ── Opción de lista (categoría de la cuenta) ─────────────────
export function initOpcionPicker({ btn, opciones, selected = null, accent = '#38bdf8', eyebrow = 'Opción', titulo = 'Elige una opción', placeholder = 'Seleccionar', onSelect }) {
  let sel = selected;
  const info = id => opciones.find(o => o.id === id) || null;

  function renderBtn() {
    const o = info(sel);
    btn.innerHTML = o
      ? `<span class="cat-select-icon" style="background:${accent}22;color:${accent};border-color:${accent}45"><i class="${o.icon}"></i></span>
         <span class="cat-select-name">${o.label}</span>
         ${o.sub ? `<span class="color-select-hex">${o.sub}</span>` : ''}
         <i class="fa-solid fa-chevron-down cat-select-chev"></i>`
      : `<span class="cat-select-icon"><i class="fa-solid fa-layer-group"></i></span>
         <span class="cat-select-name muted">${placeholder}</span>
         <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
  }

  function open() {
    const hoja = abrirHoja('modalOpcionPicker', `
    <div class="modal-sheet glass cat-picker-sheet cuenta-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
      <div class="modal-handle"></div>
      <p class="modal-eyebrow">${eyebrow}</p>
      <h2 class="modal-title">${titulo}</h2>
      <div class="cat-picker-list">
        ${opciones.map(o => `
          <button type="button" class="cat-picker-item${o.id === sel ? ' selected' : ''}" data-id="${o.id}">
            <span class="cat-picker-item-icon" style="background:${accent}1f;color:${accent};border-color:${accent}40"><i class="${o.icon}"></i></span>
            <span class="cat-picker-item-name">${o.label}</span>
            ${o.sub ? `<span class="cat-picker-item-val">${o.sub}</span>` : ''}
            <i class="fa-solid fa-check cat-picker-item-check"></i>
          </button>`).join('')}
      </div>
      <button class="modal-cancel" id="opcionCancel">Cancelar</button>
    </div>`);
    if (!hoja) return;
    const { overlay, close } = hoja;
    overlay.querySelectorAll('.cat-picker-item').forEach(el => {
      el.addEventListener('click', () => {
        sel = el.dataset.id;
        renderBtn();
        if (onSelect) onSelect(sel);
        close();
      });
    });
    overlay.querySelector('#opcionCancel').addEventListener('click', close);
  }

  btn.addEventListener('click', open);
  renderBtn();

  return {
    getSelected: () => sel,
    setSelected(id) { sel = id; renderBtn(); },
  };
}
