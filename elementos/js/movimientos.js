import { db } from "./firebase.js";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, getDoc, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { subscribeCategorias } from "./cats-store.js";
import { initCatPicker } from "./cat-picker.js";
import { initCuentaPicker } from "./cuenta-picker.js";

// ── TIPO (ingreso | gasto) ───────────────────────────────────
const TIPO = document.body.dataset.tipo;               // 'ingreso' | 'gasto'
const ES_INGRESO = TIPO === 'ingreso';
const ACCENT = ES_INGRESO ? '#34d399' : '#f87171';

// ── CATEGORÍAS (default + personalizadas, en tiempo real) ────
let CATS = [];
function catInfo(id) {
  return CATS.find(c => c.id === id) || CATS.at(-1) || { nombre: 'Otro', icon: 'fa-solid fa-ellipsis', color: '#94a3b8' };
}
// nombre unificado: el store usa "nombre", aquí mostramos como label
function catLabel(c) { return c ? (c.nombre || c.label) : 'Otro'; }

subscribeCategorias(TIPO, cats => {
  CATS = cats;
  render();
});

// ── ESTADO ───────────────────────────────────────────────────
let movimientos = [];
let cuentas = [];
const MOV_COL = collection(db, 'movimientos');
const CUE_COL = collection(db, 'cuentas');

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

function cuentaInfo(id) { return cuentas.find(c => c.id === id); }

// ── ELEMENTOS ────────────────────────────────────────────────
const lista     = document.getElementById('movList');
const totalEl   = document.getElementById('movTotal');
const subEl     = document.getElementById('movSub');

// ── FECHAS / PERIODO ─────────────────────────────────────────
const MESES_NOM = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _ahora = new Date();
const PERIODO_ACTUAL = `${_ahora.getFullYear()}-${String(_ahora.getMonth()).padStart(2,'0')}`;
let periodoSel = PERIODO_ACTUAL;

function periodoDe(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
}
function periodoLabel(key) {
  const [y, m] = key.split('-');
  return `${MESES_NOM[parseInt(m,10)]} ${y}`;
}

function fechaCorta(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function fechaLarga(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── RENDER ───────────────────────────────────────────────────
function render() {
  // Filtrar por periodo seleccionado
  const filtrados = movimientos.filter(m => periodoDe(m.fecha || m.creadoEn || 0) === periodoSel);

  const total = filtrados.reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  totalEl.textContent = fmt(total);
  const n = filtrados.length;
  subEl.textContent = n === 1 ? '1 movimiento' : `${n} movimientos`;

  // Etiqueta del periodo (siempre muestra el mes y año)
  const lbl = document.getElementById('periodoLabel');
  if (lbl) lbl.textContent = periodoLabel(periodoSel);

  if (!n) {
    const mismoMes = periodoSel === PERIODO_ACTUAL;
    lista.innerHTML = `
      <div class="mov-empty glass">
        <i class="fa-solid ${ES_INGRESO ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
        <p>${mismoMes
          ? `Sin ${ES_INGRESO ? 'ingresos' : 'gastos'} este mes.<br>Toca <strong>Registrar ${TIPO}</strong> para empezar.`
          : `Sin ${ES_INGRESO ? 'ingresos' : 'gastos'} en ${periodoLabel(periodoSel)}.`}</p>
      </div>`;
    return;
  }

  lista.innerHTML = filtrados.map(m => {
    const cat = catInfo(m.categoria);
    const cue = cuentaInfo(m.cuentaId);
    const signo = ES_INGRESO ? '+' : '−';
    return `
    <div class="mov-card" data-id="${m.id}" style="--cat-color:${cat.color}">
      <div class="mov-card-icon"><i class="${cat.icon}"></i></div>
      <div class="mov-card-info">
        <span class="mov-card-concepto">${m.concepto || catLabel(cat)}</span>
        <span class="mov-card-meta">${catLabel(cat)}<span class="dot">·</span>${cue ? cue.nombre : 'Cuenta eliminada'}</span>
      </div>
      <div class="mov-card-right">
        <span class="mov-card-monto">${signo}${fmt(m.monto)}</span>
        <span class="mov-card-fecha">${fechaCorta(m.fecha)}</span>
      </div>
    </div>`;
  }).join('');

  lista.querySelectorAll('.mov-card').forEach(card => {
    card.addEventListener('click', () => openOptions(card.dataset.id));
  });
}

// ── LISTENERS TIEMPO REAL ────────────────────────────────────
onSnapshot(query(CUE_COL, orderBy('creadoEn', 'asc')), snap => {
  cuentas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});

onSnapshot(query(MOV_COL, where('tipo', '==', TIPO)), snap => {
  movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  movimientos.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  render();
});

// ── SELECTOR DE PERIODO ──────────────────────────────────────
function periodosDisponibles() {
  const set = new Set(movimientos.map(m => periodoDe(m.fecha || m.creadoEn || 0)));
  set.add(PERIODO_ACTUAL);
  return [...set].sort((a, b) => b.localeCompare(a));
}

const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const periodoBtn = document.getElementById('periodoSelector');
if (periodoBtn) {
  periodoBtn.addEventListener('click', abrirSelectorPeriodo);
}

function abrirSelectorPeriodo() {
  const periodos = periodosDisponibles();               // ['YYYY-MM', ...]
  const conRegistro = new Set(periodos);
  const anios = [...new Set(periodos.map(p => parseInt(p.split('-')[0], 10)))].sort((a, b) => b - a);

  // año que se muestra al abrir = el del periodo seleccionado
  let anioVista = parseInt(periodoSel.split('-')[0], 10);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalPeriodo';
  overlay.innerHTML = `
  <div class="modal-sheet glass" role="dialog" aria-modal="true" style="--accent:${ACCENT}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">Filtrar</p>
    <h2 class="modal-title">Selecciona un periodo</h2>
    <p class="modal-subtitle">${ES_INGRESO ? 'Ingresos' : 'Gastos'} del mes elegido</p>

    <div class="anio-nav">
      <button class="cal-nav-btn" id="anioPrev" aria-label="Año anterior"><i class="fa-solid fa-chevron-left"></i></button>
      <span class="anio-actual" id="anioActual"></span>
      <button class="cal-nav-btn" id="anioNext" aria-label="Año siguiente"><i class="fa-solid fa-chevron-right"></i></button>
    </div>

    <div class="meses-grid" id="mesesGrid"></div>

    <button class="modal-cancel" id="periodoCancel">Cerrar</button>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  const anioEl  = overlay.querySelector('#anioActual');
  const gridEl  = overlay.querySelector('#mesesGrid');
  const prevBtn = overlay.querySelector('#anioPrev');
  const nextBtn = overlay.querySelector('#anioNext');

  function renderMeses() {
    anioEl.textContent = anioVista;

    // limitar navegación a años con registros (o al año actual)
    const minAnio = Math.min(...anios, _ahora.getFullYear());
    const maxAnio = Math.max(...anios, _ahora.getFullYear());
    prevBtn.disabled = anioVista <= minAnio;
    nextBtn.disabled = anioVista >= maxAnio;

    let html = '';
    for (let m = 0; m < 12; m++) {
      const key = `${anioVista}-${String(m).padStart(2,'0')}`;
      const hay = conRegistro.has(key);
      const sel = key === periodoSel;
      const esActual = key === PERIODO_ACTUAL;
      html += `<button class="mes-btn${sel ? ' selected' : ''}${hay ? '' : ' vacio'}${esActual ? ' actual' : ''}" data-p="${key}"${hay ? '' : ' disabled'}>
        ${MESES_CORTO[m]}
      </button>`;
    }
    gridEl.innerHTML = html;

    gridEl.querySelectorAll('.mes-btn:not(.vacio)').forEach(btn => {
      btn.addEventListener('click', () => {
        periodoSel = btn.dataset.p;
        render();
        close();
      });
    });
  }

  prevBtn.addEventListener('click', () => { anioVista--; renderMeses(); });
  nextBtn.addEventListener('click', () => { anioVista++; renderMeses(); });

  function close() {
    overlay.classList.add('closing'); overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 320);
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#periodoCancel').addEventListener('click', close);

  renderMeses();
}

// ── FIRESTORE: crear / editar / eliminar con ajuste de saldo ──
async function ajustarSaldo(cuentaId, delta) {
  if (!cuentaId || !delta) return;
  const ref = doc(db, 'cuentas', cuentaId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const actual = parseFloat(snap.data().monto) || 0;
  await updateDoc(ref, { monto: actual + delta });
}

async function crearMovimiento(data) {
  const monto = parseFloat(data.monto) || 0;
  await addDoc(MOV_COL, { ...data, tipo: TIPO, monto, fecha: Date.now(), creadoEn: Date.now() });
  await ajustarSaldo(data.cuentaId, ES_INGRESO ? monto : -monto);
}

async function editarMovimiento(id, prev, data) {
  const nuevoMonto = parseFloat(data.monto) || 0;
  await updateDoc(doc(db, 'movimientos', id), { ...data, monto: nuevoMonto });
  // revertir efecto anterior y aplicar nuevo
  const signo = ES_INGRESO ? 1 : -1;
  await ajustarSaldo(prev.cuentaId, -signo * (parseFloat(prev.monto) || 0));
  await ajustarSaldo(data.cuentaId, signo * nuevoMonto);
}

async function eliminarMovimiento(m) {
  await deleteDoc(doc(db, 'movimientos', m.id));
  const signo = ES_INGRESO ? 1 : -1;
  await ajustarSaldo(m.cuentaId, -signo * (parseFloat(m.monto) || 0));
}

// ── OPCIONES (editar / eliminar) ─────────────────────────────
function openOptions(id) {
  const m = movimientos.find(x => x.id === id);
  if (!m) return;
  const cat = catInfo(m.categoria);
  const cue = cuentaInfo(m.cuentaId);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOpciones';
  overlay.innerHTML = `
  <div class="modal-sheet glass options-sheet" role="dialog" aria-modal="true">
    <div class="modal-handle"></div>
    <div class="options-cuenta-header">
      <div class="options-cuenta-icon" style="background:${cat.color}18;color:${cat.color};border:1px solid ${cat.color}35">
        <i class="${cat.icon}"></i>
      </div>
      <div>
        <div class="options-cuenta-nombre">${m.concepto || catLabel(cat)}</div>
        <div class="options-cuenta-saldo">${fmt(m.monto)} · ${cue ? cue.nombre : 'Cuenta eliminada'} · ${fechaLarga(m.fecha)}</div>
      </div>
    </div>
    <div class="options-btns">
      <button class="options-btn" id="optEditar"><i class="fa-solid fa-pen"></i><span>Editar</span></button>
      <button class="options-btn danger" id="optEliminar"><i class="fa-solid fa-trash-can"></i><span>Eliminar</span></button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay('modalOpciones'); });

  overlay.querySelector('#optEditar').addEventListener('click', () => {
    closeOverlay('modalOpciones');
    setTimeout(() => openForm(id), 320);
  });
  overlay.querySelector('#optEliminar').addEventListener('click', () => {
    closeOverlay('modalOpciones');
    setTimeout(() => confirmarEliminar(m), 320);
  });
}

function confirmarEliminar(m) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalConfirm';
  overlay.innerHTML = `
  <div class="modal-sheet glass confirm-sheet" role="alertdialog" aria-modal="true">
    <div class="modal-handle"></div>
    <div class="confirm-icon"><i class="fa-solid fa-trash-can"></i></div>
    <h2 class="confirm-title">Eliminar ${TIPO}</h2>
    <p class="confirm-desc">¿Seguro que quieres eliminar <strong>${m.concepto || catInfo(m.categoria).label}</strong>? Se ajustará el saldo de la cuenta.</p>
    <div class="confirm-btns">
      <button class="options-btn" id="btnNo">Cancelar</button>
      <button class="options-btn danger" id="btnSi"><i class="fa-solid fa-trash-can"></i><span>Eliminar</span></button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay('modalConfirm'); });
  overlay.querySelector('#btnNo').addEventListener('click', () => closeOverlay('modalConfirm'));
  overlay.querySelector('#btnSi').addEventListener('click', () => {
    closeOverlay('modalConfirm');
    eliminarMovimiento(m);
    showToast(ES_INGRESO ? 'Ingreso eliminado' : 'Gasto eliminado');
  });
}

// ── FORM CREAR / EDITAR ──────────────────────────────────────
let selCat = null;
let selCuenta = null;

function openForm(editId = null) {
  if (document.getElementById('modalMov')) return;
  if (!cuentas.length) {
    showToast('Primero crea una cuenta');
    return;
  }

  const editing = editId ? movimientos.find(m => m.id === editId) : null;
  selCat    = editing ? editing.categoria : null;   // al crear: sin categoría por defecto
  selCuenta = editing ? editing.cuentaId  : cuentas[0].id;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalMov';
  overlay.innerHTML = `
  <div class="modal-sheet glass modal-cuenta-sheet mov-form-sheet" role="dialog" aria-modal="true" style="--accent:${ACCENT}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">${editing ? 'Editar' : 'Nuevo'} ${TIPO}</p>
    <h2 class="modal-title">${editing ? 'Modificar' : 'Registrar'} ${TIPO}</h2>
    <div class="form-scroll">

      <div class="form-group">
        <label class="form-label">Monto</label>
        <div class="input-prefix-wrap">
          <span class="input-prefix">$</span>
          <input class="form-input input-with-prefix input-monto-fmt" id="inputMonto"
            type="text" inputmode="numeric" placeholder="0" autocomplete="off"
            value="${editing ? fmtInput(editing.monto) : ''}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Concepto <span class="form-label-opt">(opcional)</span></label>
        <input class="form-input" id="inputConcepto" type="text" maxlength="40"
          placeholder="${ES_INGRESO ? 'Ej. Pago cliente' : 'Ej. Supermercado'}"
          value="${editing ? (editing.concepto || '') : ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Cuenta</label>
        <button type="button" class="cat-select-btn" id="cuentaSelectBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Categoría</label>
        <button type="button" class="cat-select-btn" id="catSelectBtn"></button>
      </div>

    </div>
    <div class="modal-actions">
      <button class="modal-cancel" id="btnCancelar">Cancelar</button>
      <button class="btn-primary" id="btnGuardar">${editing ? 'Guardar' : 'Registrar'}</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  const inputMonto = overlay.querySelector('#inputMonto');
  const catSelectBtn = overlay.querySelector('#catSelectBtn');

  // ¿el monto actual lo puso una categoría automáticamente?
  let montoAuto = false;

  function aplicarValorCategoria(cat) {
    if (!cat || !cat.valor) return;
    // No pisamos un monto escrito a mano por el usuario.
    if (!inputMonto.value || montoAuto) {
      inputMonto.value = new Intl.NumberFormat('es-CO').format(cat.valor);
      inputMonto.classList.remove('input-error');
      montoAuto = true;
    }
  }

  const cuentaSelectBtn = overlay.querySelector('#cuentaSelectBtn');
  const cuentaPicker = initCuentaPicker({
    btn: cuentaSelectBtn,
    cuentas,
    selectedId: selCuenta,
    accent: ACCENT,
    onSelect: (c) => { selCuenta = c ? c.id : null; },
  });

  function aplicarCuentaCategoria(cat) {
    if (!cat || !cat.cuentaId) return;
    if (cuentas.some(c => c.id === cat.cuentaId)) {
      selCuenta = cat.cuentaId;
      cuentaPicker.setSelected(cat.cuentaId);
    }
  }

  initCatPicker({
    btn: catSelectBtn,
    cats: CATS,
    selectedId: selCat,
    accent: ACCENT,
    tipo: TIPO,
    onSelect: (cat) => {
      selCat = cat ? cat.id : null;
      aplicarValorCategoria(cat);
      aplicarCuentaCategoria(cat);
    },
  });
  // Al editar no autocompletamos (ya hay datos); al crear sí si aplica.
  if (!editing) {
    const catInicial = CATS.find(c => c.id === selCat);
    aplicarValorCategoria(catInicial);
    aplicarCuentaCategoria(catInicial);
  }

  inputMonto.addEventListener('input', () => {
    inputMonto.classList.remove('input-error');
    montoAuto = false;   // el usuario tomó control del monto
    const raw = inputMonto.value.replace(/[^0-9]/g, '');
    inputMonto.value = raw ? new Intl.NumberFormat('es-CO').format(parseInt(raw)) : '';
  });

  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  overlay.querySelector('#btnCancelar').addEventListener('click', () => closeOverlay('modalMov'));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay('modalMov'); });

  overlay.querySelector('#btnGuardar').addEventListener('click', async () => {
    const monto     = parseMonto(overlay.querySelector('#inputMonto').value);
    const concepto  = overlay.querySelector('#inputConcepto').value.trim();
    const cuentaId  = selCuenta;

    if (!monto || monto <= 0) {
      const inp = overlay.querySelector('#inputMonto');
      inp.focus(); inp.classList.add('input-error'); return;
    }

    const btn = overlay.querySelector('#btnGuardar');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const data = { monto, concepto, cuentaId, categoria: selCat };

    if (editing) await editarMovimiento(editId, editing, data);
    else await crearMovimiento(data);

    closeOverlay('modalMov');
    showToast(ES_INGRESO ? 'Ingreso registrado' : 'Gasto registrado');
  });
}

// ── HELPERS ──────────────────────────────────────────────────
function closeOverlay(id) {
  const o = document.getElementById(id);
  if (!o) return;
  o.classList.add('closing'); o.classList.remove('active');
  setTimeout(() => o.remove(), 320);
}

function fmtInput(val) {
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num);
}

function parseMonto(str) {
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

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

// ── BOTÓN NUEVO (usa el form compartido con foto + IA) ───────
import('./quick-mov.js').then(({ openQuickMov }) => {
  document.getElementById('btnNuevoMov').addEventListener('click', () => openQuickMov(TIPO));
});
