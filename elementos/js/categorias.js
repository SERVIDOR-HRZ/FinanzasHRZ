import {
  subscribeCategorias, crearCategoria, actualizarCategoria, eliminarCategoria
} from "./cats-store.js";
import { ALL_ICONS } from "./icon-library.js";
import { pickDayOfMonth } from "./calendar.js";
import { initCuentaPicker } from "./cuenta-picker.js";
import { initIconPicker } from "./icon-picker.js";
import { db } from "./firebase.js";
import {
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let tipoActivo = 'ingreso';
let categorias = [];         // combinadas (default + custom) del tipo activo
let cuentas = [];            // cuentas disponibles para asignar
let unsub = null;

// ── Cuentas en tiempo real ───────────────────────────────────
onSnapshot(query(collection(db, 'cuentas'), orderBy('creadoEn', 'asc')), snap => {
  cuentas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});

const listaEl = document.getElementById('catList');

// ── Suscripción según tab ────────────────────────────────────
function suscribir() {
  if (unsub) unsub();
  unsub = subscribeCategorias(tipoActivo, cats => {
    categorias = cats;
    render();
  });
}

// ── Render ───────────────────────────────────────────────────
function render() {
  if (!categorias.length) {
    listaEl.innerHTML = `
      <div class="mov-empty glass">
        <i class="fa-solid fa-tags"></i>
        <p>Sin categorías de ${tipoActivo === 'ingreso' ? 'ingreso' : 'gasto'} aún.<br>Toca <strong>Nueva categoría</strong> para crear la primera.</p>
      </div>`;
    return;
  }

  listaEl.innerHTML = categorias.map(rowHTML).join('');

  listaEl.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openForm(btn.dataset.edit));
  });
  listaEl.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminar(btn.dataset.del));
  });
}

function rowHTML(c) {
  const fija = c.fija && c.diaCobro;
  const valorTxt = c.valor
    ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.valor)
    : null;
  return `
  <div class="cat-row" style="--c:${c.color}">
    <div class="cat-row-icon"><i class="${c.icon}"></i></div>
    <div class="cat-row-info">
      <div class="cat-row-nombre">${c.nombre}</div>
      <div class="cat-row-tag">
        ${fija ? `<span class="fija-chip"><i class="fa-solid fa-calendar-day"></i> Día ${c.diaCobro}</span>` : ''}
        ${valorTxt ? `<span class="valor-chip">${valorTxt}</span>` : (fija ? '' : 'Variable')}
      </div>
    </div>
    <div class="cat-row-actions">
      <button class="cat-icon-btn" data-edit="${c.id}" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
      <button class="cat-icon-btn danger" data-del="${c.id}" aria-label="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
    </div>
  </div>`;
}

// ── Tabs ─────────────────────────────────────────────────────
document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === tipoActivo) return;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    tipoActivo = tab.dataset.tab;
    suscribir();
  });
});

// ── Form crear / editar ──────────────────────────────────────
const ICON_DEFAULT = ALL_ICONS[0].c;
let selIcon = ICON_DEFAULT;
let esFija = false;
let diaCobro = null;

function openForm(editId = null) {
  if (document.getElementById('modalCat')) return;
  const editing = editId ? categorias.find(c => c.id === editId) : null;

  selIcon  = editing ? editing.icon  : ICON_DEFAULT;
  esFija   = editing ? !!editing.fija : false;
  diaCobro = editing ? (editing.diaCobro || null) : null;

  // El color de la categoría lo define el tipo: verde ingreso / rojo gasto
  const accent = tipoActivo === 'ingreso' ? '#34d399' : '#f87171';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalCat';
  overlay.innerHTML = `
  <div class="modal-sheet glass modal-cuenta-sheet mov-form-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">${editing ? 'Editar' : 'Nueva'} categoría · ${tipoActivo === 'ingreso' ? 'Ingreso' : 'Gasto'}</p>
    <h2 class="modal-title">${editing ? 'Modificar categoría' : 'Crear categoría'}</h2>
    <div class="form-scroll">

      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input class="form-input" id="catNombre" type="text" maxlength="24"
          placeholder="Ej. Arriendo, Netflix, Freelance" value="${editing ? editing.nombre : ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Valor <span class="form-label-opt">(opcional)</span></label>
        <div class="input-prefix-wrap">
          <span class="input-prefix">$</span>
          <input class="form-input input-with-prefix" id="catValor"
            type="text" inputmode="numeric" placeholder="0" autocomplete="off"
            value="${editing && editing.valor ? fmtInput(editing.valor) : ''}" />
        </div>
        <span class="form-hint">Si lo dejas vacío, usarás el valor que registres en cada movimiento.</span>
      </div>

      <div class="form-group">
        <label class="form-label">Cuenta asignada <span class="form-label-opt">(opcional)</span></label>
        <button type="button" class="cat-select-btn" id="catCuentaBtn"></button>
        <span class="form-hint">Si eliges una cuenta, se cobrará/abonará ahí automáticamente.</span>
      </div>

      <div class="form-group">
        <label class="form-label">Icono</label>
        <button type="button" class="icon-select-btn" id="catIconBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Cobro fijo</label>
        <div class="switch-row">
          <div class="switch-row-text">
            <span class="switch-row-title">Categoría fija</span>
            <span class="switch-row-desc">Se cobra un día específico cada mes</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="switchFija" ${esFija ? 'checked' : ''} />
            <span class="switch-slider"></span>
          </label>
        </div>
        <div class="dia-cobro-wrap ${esFija ? 'open' : ''}" id="diaWrap">
          <button class="dia-cobro-btn" id="btnDiaCobro" type="button">
            <i class="fa-solid fa-calendar-days cal-ico"></i>
            <span class="dia-cobro-label">Día de cobro</span>
            <span class="dia-cobro-val" id="diaVal">${diaCobro ? 'Día ' + diaCobro : 'Elegir'}</span>
            <i class="fa-solid fa-chevron-right chev"></i>
          </button>
        </div>
      </div>

    </div>
    <div class="modal-actions">
      <button class="modal-cancel" id="catCancel">Cancelar</button>
      <button class="btn-primary" id="catGuardar">${editing ? 'Guardar' : 'Crear'}</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // Selector de cuenta asignada (opcional)
  let selCuenta = editing ? (editing.cuentaId || null) : null;
  const cuentaPicker = initCuentaPicker({
    btn: overlay.querySelector('#catCuentaBtn'),
    cuentas,
    selectedId: selCuenta,
    accent,
    noneLabel: 'Preguntar en cada movimiento',
    onSelect: (c) => { selCuenta = c ? c.id : null; },
  });

  // Selector de icono (botón + hoja con buscador y grupos).
  // El color de la categoría es blanco por defecto.
  const iconPicker = initIconPicker({
    btn: overlay.querySelector('#catIconBtn'),
    selected: selIcon,
    accent: '#ffffff',
    onSelect: (c) => { selIcon = c; },
  });

  // Formato de miles en el valor
  attachMontoFmt(overlay.querySelector('#catValor'));

  // Switch fija
  const switchFija = overlay.querySelector('#switchFija');
  const diaWrap = overlay.querySelector('#diaWrap');
  switchFija.addEventListener('change', () => {
    esFija = switchFija.checked;
    diaWrap.classList.toggle('open', esFija);
    if (!esFija) { diaCobro = null; overlay.querySelector('#diaVal').textContent = 'Elegir'; }
  });

  // Botón día -> calendario (color según tipo)
  overlay.querySelector('#btnDiaCobro').addEventListener('click', () => {
    pickDayOfMonth(diaCobro, dia => {
      diaCobro = dia;
      overlay.querySelector('#diaVal').textContent = 'Día ' + dia;
    }, accent);
  });

  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  overlay.querySelector('#catCancel').addEventListener('click', closeForm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeForm(); });

  overlay.querySelector('#catGuardar').addEventListener('click', async () => {
    const nombre = overlay.querySelector('#catNombre').value.trim();
    if (!nombre) {
      const inp = overlay.querySelector('#catNombre');
      inp.focus(); inp.classList.add('input-error'); return;
    }
    if (esFija && !diaCobro) {
      overlay.querySelector('#btnDiaCobro').click();
      return;
    }

    const valor = parseMonto(overlay.querySelector('#catValor').value);

    const btn = overlay.querySelector('#catGuardar');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const cuentaId = selCuenta || null;

    const data = {
      tipo: tipoActivo,
      nombre,
      icon: selIcon,
      color: '#ffffff',            // color por defecto: blanco
      valor: valor || null,        // opcional
      cuentaId,                    // cuenta asignada (opcional)
      fija: esFija,
      diaCobro: esFija ? diaCobro : null,
    };

    if (editing) await actualizarCategoria(editId, data);
    else await crearCategoria(data);

    closeForm();
    showToast(editing ? 'Categoría actualizada' : 'Categoría creada');
  });
}

// ── Helpers de formato de valor ──────────────────────────────
function fmtInput(val) {
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num);
}

function parseMonto(str) {
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

function attachMontoFmt(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    const raw = input.value.replace(/[^0-9]/g, '');
    input.value = raw ? new Intl.NumberFormat('es-CO').format(parseInt(raw)) : '';
  });
}

function closeForm() {
  const o = document.getElementById('modalCat');
  if (!o) return;
  o.classList.add('closing'); o.classList.remove('active');
  setTimeout(() => o.remove(), 320);
}

// ── Eliminar ─────────────────────────────────────────────────
function confirmarEliminar(id) {
  const c = categorias.find(x => x.id === id);
  if (!c) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalConfirmCat';
  overlay.innerHTML = `
  <div class="modal-sheet glass confirm-sheet" role="alertdialog" aria-modal="true">
    <div class="modal-handle"></div>
    <div class="confirm-icon"><i class="fa-solid fa-trash-can"></i></div>
    <h2 class="confirm-title">Eliminar categoría</h2>
    <p class="confirm-desc">¿Seguro que quieres eliminar <strong>${c.nombre}</strong>?</p>
    <div class="confirm-btns">
      <button class="options-btn" id="cNo">Cancelar</button>
      <button class="options-btn danger" id="cSi"><i class="fa-solid fa-trash-can"></i><span>Eliminar</span></button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  overlay.querySelector('#cNo').addEventListener('click', closeConfirm);
  overlay.querySelector('#cSi').addEventListener('click', () => {
    closeConfirm();
    eliminarCategoria(id);
    showToast('Categoría eliminada');
  });
}

function closeConfirm() {
  const o = document.getElementById('modalConfirmCat');
  if (!o) return;
  o.classList.add('closing'); o.classList.remove('active');
  setTimeout(() => o.remove(), 320);
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg) {
  const existing = document.getElementById('cuentaToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'cuentaToast';
  toast.className = 'cuenta-toast';
  toast.innerHTML = `<i class="fa-solid fa-check"></i> ${msg}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 2000);
}

// ── Init ─────────────────────────────────────────────────────
document.getElementById('btnNuevaCat').addEventListener('click', () => openForm());
suscribir();

// Permite que el FAB (app.js) abra el formulario de nueva categoría,
// ya sea estando en esta pantalla o llegando desde otra con ?nueva=1.
window.abrirNuevaCategoria = () => openForm();

if (new URLSearchParams(location.search).get('nueva') === '1') {
  // limpiamos el parámetro para que no se reabra al recargar
  history.replaceState(null, '', location.pathname);
  setTimeout(() => openForm(), 300);
}
