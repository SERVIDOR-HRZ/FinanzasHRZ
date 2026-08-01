// ── CALENDAR ─────────────────────────────────────────────────
// Selector de "día del mes" para cobros fijos (1-31).
// Uso: pickDayOfMonth(actual, (dia) => {...})

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEM = ['L','M','X','J','V','S','D'];

function ordinal(d) {
  return d + (d === 1 ? 'er' : '') + ' día';
}

export function pickDayOfMonth(actual, onPick, accent = '#34d399') {
  const hoy = new Date();
  // `actual` puede ser un número (día) o un objeto { dia, mes, anio }
  // para reabrir en el mes/año que se había configurado.
  let mesVista = hoy.getMonth();
  let anioVista = hoy.getFullYear();
  let seleccion = null;
  if (actual && typeof actual === 'object') {
    seleccion = actual.dia || null;
    if (Number.isInteger(actual.mes))  mesVista  = actual.mes;
    if (Number.isInteger(actual.anio)) anioVista = actual.anio;
  } else {
    seleccion = actual || null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay cal-overlay';
  overlay.id = 'modalCalendar';
  overlay.innerHTML = `
  <div class="modal-sheet glass cal-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
    <div class="modal-handle"></div>
    <div class="cal-head">
      <div>
        <p class="modal-eyebrow">Día de cobro</p>
        <h2 class="cal-title" id="calTitle">Selecciona un día</h2>
      </div>
      <div class="cal-badge" id="calBadge">—</div>
    </div>

    <div class="cal-nav">
      <button class="cal-nav-btn" id="calPrev" aria-label="Mes anterior"><i class="fa-solid fa-chevron-left"></i></button>
      <span class="cal-month" id="calMonth"></span>
      <button class="cal-nav-btn" id="calNext" aria-label="Mes siguiente"><i class="fa-solid fa-chevron-right"></i></button>
    </div>

    <div class="cal-weekdays">${DIAS_SEM.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid" id="calGrid"></div>

    <p class="cal-hint"><i class="fa-solid fa-circle-info"></i> El cobro se repetirá este día cada mes.</p>

    <div class="modal-actions cal-actions">
      <button class="modal-cancel" id="calCancel">Cancelar</button>
      <button class="btn-primary" id="calConfirm">Confirmar</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  const gridEl  = overlay.querySelector('#calGrid');
  const monthEl = overlay.querySelector('#calMonth');
  const badgeEl = overlay.querySelector('#calBadge');
  const titleEl = overlay.querySelector('#calTitle');

  function updateBadge() {
    if (seleccion) {
      badgeEl.textContent = seleccion;
      titleEl.textContent = ordinal(seleccion) + ' del mes';
    } else {
      badgeEl.textContent = '—';
      titleEl.textContent = 'Selecciona un día';
    }
  }

  function render() {
    monthEl.textContent = MESES[mesVista] + ' ' + anioVista;

    // primer día (0=Dom) -> convertir a Lunes=0
    const primerDia = new Date(anioVista, mesVista, 1).getDay();
    const offset = (primerDia + 6) % 7;
    const diasEnMes = new Date(anioVista, mesVista + 1, 0).getDate();

    let html = '';
    for (let i = 0; i < offset; i++) html += '<span class="cal-day empty"></span>';
    for (let d = 1; d <= diasEnMes; d++) {
      const esHoy = d === hoy.getDate() && mesVista === hoy.getMonth() && anioVista === hoy.getFullYear();
      const sel = d === seleccion;
      html += `<button class="cal-day${sel ? ' selected' : ''}${esHoy ? ' today' : ''}" data-dia="${d}">${d}</button>`;
    }
    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.cal-day:not(.empty)').forEach(btn => {
      btn.addEventListener('click', () => {
        seleccion = parseInt(btn.dataset.dia, 10);
        gridEl.querySelectorAll('.cal-day').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateBadge();
      });
    });
  }

  overlay.querySelector('#calPrev').addEventListener('click', () => {
    mesVista--; if (mesVista < 0) { mesVista = 11; anioVista--; } render();
  });
  overlay.querySelector('#calNext').addEventListener('click', () => {
    mesVista++; if (mesVista > 11) { mesVista = 0; anioVista++; } render();
  });

  function close() {
    overlay.classList.add('closing'); overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 320);
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#calCancel').addEventListener('click', close);
  overlay.querySelector('#calConfirm').addEventListener('click', () => {
    if (!seleccion) { badgeEl.classList.add('cal-badge-error'); setTimeout(() => badgeEl.classList.remove('cal-badge-error'), 500); return; }
    // Devolvemos el día (compatibilidad) + el mes/año en que se configuró,
    // para saber a partir de cuándo empieza a repetirse el cobro.
    onPick(seleccion, { dia: seleccion, mes: mesVista, anio: anioVista });
    close();
  });

  render();
  updateBadge();
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });
}
