import { db } from "./firebase.js";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, getDoc, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { subscribeCategorias } from "./cats-store.js";
import { initCatPicker } from "./cat-picker.js";
import { initCuentaPicker } from "./cuenta-picker.js";
import { openCapturaModal, confirmarQuitarFoto } from "./quick-mov.js";
import { subirImgBB, IMGBB_KEY, analizarComprobante } from "./ai-config.js";

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

// ── DETALLE DEL MOVIMIENTO (ver / editar / eliminar) ─────────
function openOptions(id) {
  const m = movimientos.find(x => x.id === id);
  if (!m) return;
  const cat = catInfo(m.categoria);
  const cue = cuentaInfo(m.cuentaId);
  const signo = ES_INGRESO ? '+' : '−';

  // comprobantes: array nuevo o campo único antiguo
  const comprobantes = Array.isArray(m.comprobantes) && m.comprobantes.length
    ? m.comprobantes
    : (m.comprobante ? [m.comprobante] : []);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOpciones';
  overlay.innerHTML = `
  <div class="modal-sheet glass mov-detail-sheet" role="dialog" aria-modal="true" style="--cat-color:${cat.color}">
    <div class="modal-handle"></div>

    <div class="mov-detail-head">
      <div class="mov-detail-icon"><i class="${cat.icon}"></i></div>
      <div class="mov-detail-amount ${ES_INGRESO ? 'ingreso' : 'gasto'}">${signo}${fmt(m.monto)}</div>
      <div class="mov-detail-concepto">${m.concepto || catLabel(cat)}</div>
    </div>

    <div class="mov-detail-rows">
      <div class="mov-detail-row">
        <span class="mov-detail-k"><i class="fa-solid fa-tag"></i> Categoría</span>
        <span class="mov-detail-v">${catLabel(cat)}</span>
      </div>
      <div class="mov-detail-row">
        <span class="mov-detail-k"><i class="fa-solid fa-wallet"></i> Cuenta</span>
        <span class="mov-detail-v">${cue ? cue.nombre : 'Cuenta eliminada'}</span>
      </div>
      <div class="mov-detail-row">
        <span class="mov-detail-k"><i class="fa-solid fa-calendar-day"></i> Fecha</span>
        <span class="mov-detail-v">${fechaLarga(m.fecha)}</span>
      </div>
    </div>

    ${comprobantes.length ? `
    <div class="mov-detail-comprobantes">
      <span class="mov-detail-label">Comprobante${comprobantes.length > 1 ? 's' : ''}</span>
      <div class="mov-detail-gallery">
        ${comprobantes.map((url, i) => `
          <button class="mov-detail-thumb" type="button" data-i="${i}">
            <img src="${url}" alt="comprobante ${i + 1}" loading="lazy" />
            <span class="mov-detail-thumb-zoom"><i class="fa-solid fa-magnifying-glass-plus"></i></span>
          </button>`).join('')}
      </div>
    </div>` : ''}

    <div class="options-btns">
      <button class="options-btn" id="optEditar"><i class="fa-solid fa-pen"></i><span>Editar</span></button>
      <button class="options-btn danger" id="optEliminar"><i class="fa-solid fa-trash-can"></i><span>Eliminar</span></button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay('modalOpciones'); });

  // Abrir visor al tocar un comprobante
  overlay.querySelectorAll('.mov-detail-thumb').forEach(btn => {
    btn.addEventListener('click', () => openVisor(comprobantes, parseInt(btn.dataset.i)));
  });

  overlay.querySelector('#optEditar').addEventListener('click', () => {
    closeOverlay('modalOpciones');
    setTimeout(() => openForm(id), 320);
  });
  overlay.querySelector('#optEliminar').addEventListener('click', () => {
    closeOverlay('modalOpciones');
    setTimeout(() => confirmarEliminar(m), 320);
  });
}

// ── VISOR DE COMPROBANTE (zoom + descarga) ───────────────────
function openVisor(imagenes, indice = 0) {
  let idx = indice;
  const overlay = document.createElement('div');
  overlay.className = 'visor-overlay';
  overlay.id = 'modalVisor';
  overlay.innerHTML = `
    <div class="visor-topbar">
      <span class="visor-count"></span>
      <div class="visor-actions">
        <a class="visor-btn" id="visorDescargar" download title="Descargar"><i class="fa-solid fa-download"></i></a>
        <button class="visor-btn" id="visorCerrar" title="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
    <div class="visor-stage" id="visorStage">
      <img class="visor-img" id="visorImg" src="" alt="comprobante" />
    </div>
    ${imagenes.length > 1 ? `
      <button class="visor-nav visor-prev" id="visorPrev"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="visor-nav visor-next" id="visorNext"><i class="fa-solid fa-chevron-right"></i></button>
    ` : ''}
    <p class="visor-hint">Toca la imagen para acercar · doble toque para restablecer</p>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  const img = overlay.querySelector('#visorImg');
  const stage = overlay.querySelector('#visorStage');
  const countEl = overlay.querySelector('.visor-count');
  const descargar = overlay.querySelector('#visorDescargar');

  let zoom = 1;
  function mostrar() {
    zoom = 1;
    img.style.transform = 'scale(1)';
    img.src = imagenes[idx];
    descargar.href = imagenes[idx];
    descargar.setAttribute('download', `comprobante-${idx + 1}.jpg`);
    if (countEl) countEl.textContent = imagenes.length > 1 ? `${idx + 1} / ${imagenes.length}` : '';
  }
  mostrar();

  // Zoom con un toque (alterna 1x / 2.4x) y doble toque para restablecer
  img.addEventListener('click', (e) => {
    e.stopPropagation();
    zoom = zoom > 1 ? 1 : 2.4;
    img.style.transform = `scale(${zoom})`;
  });
  img.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    zoom = 1; img.style.transform = 'scale(1)';
  });

  const prev = overlay.querySelector('#visorPrev');
  const next = overlay.querySelector('#visorNext');
  if (prev) prev.addEventListener('click', e => { e.stopPropagation(); idx = (idx - 1 + imagenes.length) % imagenes.length; mostrar(); });
  if (next) next.addEventListener('click', e => { e.stopPropagation(); idx = (idx + 1) % imagenes.length; mostrar(); });

  function cerrar() {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 260);
  }
  overlay.querySelector('#visorCerrar').addEventListener('click', cerrar);
  stage.addEventListener('click', e => { if (e.target === stage) cerrar(); });
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

      <div class="form-group">
        <label class="form-label">Comprobantes <span class="form-label-opt">(opcional)</span></label>
        <button class="foto-ia-btn" id="btnFoto" type="button">
          <span class="foto-ia-icon"><i class="fa-solid fa-camera"></i></span>
          <span class="foto-ia-text">
            <span class="foto-ia-title">Agregar comprobante</span>
            <span class="foto-ia-desc">Toma o sube una foto como evidencia</span>
          </span>
          <i class="fa-solid fa-wand-magic-sparkles foto-ia-magic"></i>
        </button>
        <div class="foto-gallery" id="fotoGallery" hidden></div>
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
  const conceptoInput = overlay.querySelector('#inputConcepto');

  // ── Comprobantes ───────────────────────────────────────────
  // Al editar arrancamos con los que ya tenía; se pueden agregar más.
  const previos = Array.isArray(editing?.comprobantes) && editing.comprobantes.length
    ? editing.comprobantes.slice()
    : (editing?.comprobante ? [editing.comprobante] : []);
  // fotos: { dataUrl?, url? }  (url = ya subido; dataUrl = nuevo por subir)
  let fotos = previos.map(url => ({ url }));
  const fotoGallery = overlay.querySelector('#fotoGallery');

  function renderGallery() {
    if (!fotos.length) { fotoGallery.hidden = true; fotoGallery.innerHTML = ''; return; }
    fotoGallery.hidden = false;
    fotoGallery.innerHTML = fotos.map((f, i) => `
      <div class="foto-thumb">
        <img src="${f.url || f.dataUrl}" alt="comprobante ${i + 1}" />
        <button class="foto-thumb-x" type="button" data-i="${i}" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('') +
      `<button class="foto-thumb-add" type="button" id="fotoAddMore" aria-label="Agregar otra"><i class="fa-solid fa-plus"></i></button>`;
    fotoGallery.querySelectorAll('.foto-thumb-x').forEach(b => {
      b.addEventListener('click', () => {
        confirmarQuitarFoto(() => { fotos.splice(parseInt(b.dataset.i), 1); renderGallery(); });
      });
    });
    const addBtn = fotoGallery.querySelector('#fotoAddMore');
    if (addBtn) addBtn.addEventListener('click', abrirCaptura);
  }

  function abrirCaptura() {
    openCapturaModal(ACCENT, (dataUrl, usarIA) => {
      fotos.push({ dataUrl });
      renderGallery();
      if (usarIA) analizarConIA(dataUrl);
    }, { permitirIA: true, iaPorDefecto: false });
  }
  overlay.querySelector('#btnFoto').addEventListener('click', abrirCaptura);
  renderGallery();

  async function analizarConIA(dataUrl) {
    mostrarIaOverlay(true);
    try {
      const r = await analizarComprobante(dataUrl, TIPO, CATS);
      if (r.monto && !parseMonto(inputMonto.value)) { inputMonto.value = new Intl.NumberFormat('es-CO').format(r.monto); }
      if (r.concepto && !conceptoInput.value) conceptoInput.value = r.concepto;
      if (r.categoria) { selCat = r.categoria; catPicker.setSelected(r.categoria); }
      showToast('Datos cargados por IA');
    } catch { showToast('No se pudo leer con IA'); }
    finally { mostrarIaOverlay(false); }
  }

  function mostrarIaOverlay(activo) {
    let ov = overlay.querySelector('#iaProcOverlay');
    if (activo) {
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'iaProcOverlay';
        ov.className = 'ia-proc-overlay';
        ov.innerHTML = `
          <div class="ia-proc-box">
            <span class="ia-proc-spinner"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
            <span class="ia-proc-title">Analizando con IA…</span>
            <span class="ia-proc-desc">Leyendo el comprobante, un momento.</span>
          </div>`;
        overlay.querySelector('.mov-form-sheet').appendChild(ov);
      }
      requestAnimationFrame(() => ov.classList.add('visible'));
    } else if (ov) {
      ov.classList.remove('visible');
      setTimeout(() => ov.remove(), 300);
    }
  }

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

  const catPicker = initCatPicker({
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
    btn.disabled = true;

    // Subir comprobantes nuevos (los que tienen dataUrl); conservar los ya subidos.
    let comprobantes = [];
    const nuevos = fotos.filter(f => f.dataUrl);
    if (nuevos.length && IMGBB_KEY) {
      btn.textContent = 'Subiendo fotos…';
      try {
        const subidas = await Promise.all(nuevos.map(f => subirImgBB(f.dataUrl)));
        let k = 0;
        comprobantes = fotos.map(f => f.url || subidas[k++]);
      } catch {
        showToast('No se pudieron subir las fotos');
        btn.disabled = false; btn.textContent = editing ? 'Guardar' : 'Registrar';
        return;
      }
    } else {
      // Sin clave de ImgBB: guardamos dataURL como respaldo
      comprobantes = fotos.map(f => f.url || f.dataUrl);
    }

    btn.textContent = 'Guardando…';

    const data = {
      monto, concepto, cuentaId, categoria: selCat,
      comprobantes,
      comprobante: comprobantes[0] || null,
    };

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
