// ── PENDIENTES ──────────────────────────────────────────────
// Ingresos/gastos anotados por adelantado que NO tocan el balance ni
// aparecen en Ingresos/Gastos hasta que el usuario los aprueba. Al
// aprobar, se crea un movimiento real y se ajusta el saldo de la cuenta.
import { db } from "./firebase.js";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc,
  query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { subscribeCategorias } from "./cats-store.js";
import { initCatPicker } from "./cat-picker.js";
import { initCuentaPicker } from "./cuenta-picker.js";
import { openCapturaModal, confirmarQuitarFoto } from "./quick-mov.js";
import { subirImgBB, IMGBB_KEY, analizarComprobante } from "./ai-config.js";

const PEND_COL = collection(db, 'pendientes');
const MOV_COL  = collection(db, 'movimientos');
const CUE_COL  = collection(db, 'cuentas');

let tipoActivo = 'ingreso';
let pendientes = [];
let cuentas = [];
let movimientos = [];
let catsPorTipo = { ingreso: [], gasto: [] };
let unsub = null;

const listaEl = document.getElementById('pendList');
const totalEl = document.getElementById('pendTotal');

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// ── Periodo actual (mismo formato que movimientos.js: getMonth) ──
const _ahora = new Date();
const PERIODO_ACTUAL = `${_ahora.getFullYear()}-${String(_ahora.getMonth()).padStart(2, '0')}`;
function periodoDe(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
}

// ── Datos en vivo ────────────────────────────────────────────
onSnapshot(query(CUE_COL, orderBy('creadoEn', 'asc')), snap => {
  cuentas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});
onSnapshot(MOV_COL, snap => {
  movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});
subscribeCategorias('ingreso', c => { catsPorTipo.ingreso = c; if (tipoActivo === 'ingreso') render(); });
subscribeCategorias('gasto',   c => { catsPorTipo.gasto   = c; if (tipoActivo === 'gasto')   render(); });

function catInfo(id) {
  const cats = catsPorTipo[tipoActivo] || [];
  return cats.find(c => c.id === id) || { nombre: 'Sin categoría', icon: 'fa-solid fa-ellipsis', color: tipoActivo === 'ingreso' ? '#34d399' : '#f87171' };
}
function cuentaInfo(id) { return cuentas.find(c => c.id === id); }

// ── Suscripción según tab ────────────────────────────────────
function suscribir() {
  if (unsub) unsub();
  unsub = onSnapshot(query(PEND_COL, where('tipo', '==', tipoActivo)), snap => {
    pendientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    pendientes.sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0));
    render();
  });
}

// ── Categorías fijas del mes (día de cobro) aún sin registrar ──
// Una categoría con `fija` y `diaCobro` genera un pendiente automático
// cada mes. Se oculta si ya hay un movimiento de esa categoría este mes.
// ¿ya empezó a regir la categoría fija este mes?
// Compara el mes/año actual con el mes/año de inicio configurado.
function fijaVigente(c) {
  const anioActual = _ahora.getFullYear();
  const mesActual = _ahora.getMonth();
  // Si no tiene inicio guardado (categorías antiguas), se asume vigente.
  if (!Number.isInteger(c.inicioMes) || !Number.isInteger(c.inicioAnio)) return true;
  // El mes actual debe ser igual o posterior al mes/año de inicio.
  if (anioActual > c.inicioAnio) return true;
  if (anioActual === c.inicioAnio && mesActual >= c.inicioMes) return true;
  return false;
}

function fijosPendientes() {
  const cats = catsPorTipo[tipoActivo] || [];
  return cats
    .filter(c => c.fija && c.diaCobro && c.valor)
    .filter(fijaVigente)
    .filter(c => !movimientos.some(m =>
      m.tipo === tipoActivo &&
      m.categoria === c.id &&
      periodoDe(m.fecha || m.creadoEn || 0) === PERIODO_ACTUAL
    ))
    .map(c => ({
      id: `fijo:${c.id}`,
      esFijo: true,
      tipo: tipoActivo,
      monto: c.valor,
      concepto: c.nombre,
      categoria: c.id,
      cuentaId: c.cuentaId || null,
      diaCobro: c.diaCobro,
    }))
    .sort((a, b) => a.diaCobro - b.diaCobro);
}

// Lista combinada: fijos del mes + pendientes manuales
function itemsCombinados() {
  return [...fijosPendientes(), ...pendientes];
}

// ── Render ───────────────────────────────────────────────────
function render() {
  const esIngreso = tipoActivo === 'ingreso';
  const items = itemsCombinados();

  // Total pendiente en el color del tipo: verde por cobrar / rojo por pagar
  const accent = esIngreso ? '#34d399' : '#f87171';
  const total = items.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
  if (totalEl) {
    totalEl.style.setProperty('--accent', accent);
    totalEl.innerHTML = `
      <span class="pend-total-label">${esIngreso ? 'Total por cobrar' : 'Total por pagar'}</span>
      <span class="pend-total-amount">${fmt(total)}</span>
      <span class="pend-total-sub">${items.length} ${items.length === 1 ? 'pendiente' : 'pendientes'} · no afecta tu balance</span>`;
  }

  listaEl.style.setProperty('--accent', accent);

  if (!items.length) {
    listaEl.innerHTML = `
      <div class="mov-empty glass">
        <i class="fa-solid fa-clock-rotate-left"></i>
        <p>Sin ${esIngreso ? 'cobros' : 'pagos'} pendientes.<br>Toca <strong>Nuevo pendiente</strong> para anotar uno.</p>
      </div>`;
    return;
  }

  listaEl.innerHTML = items.map(rowHTML).join('');

  listaEl.querySelectorAll('[data-aprobar]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); confirmarAprobar(btn.dataset.aprobar); });
  });
  listaEl.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openForm(btn.dataset.edit); });
  });
  listaEl.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); confirmarEliminar(btn.dataset.del); });
  });
}

// Nombre del mes actual para las etiquetas de día
const MESES_NOM = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function rowHTML(p) {
  const cat = catInfo(p.categoria);
  const cue = cuentaInfo(p.cuentaId);
  const titulo = p.concepto || cat.nombre;

  // Metadatos sin repetir el título: categoría (si difiere) y cuenta.
  const metaPartes = [];
  if (cat.nombre && cat.nombre !== titulo) metaPartes.push(cat.nombre);
  if (cue) metaPartes.push(cue.nombre);
  const meta = metaPartes.join(' · ');

  const diaChip = p.diaCobro
    ? `<span class="pend-dia-chip"><i class="fa-solid fa-calendar-day"></i> ${p.diaCobro} ${MESES_NOM[_ahora.getMonth()]}</span>`
    : '';

  const nComp = Array.isArray(p.comprobantes) ? p.comprobantes.length : 0;
  const compChip = nComp
    ? `<span class="pend-comp-chip"><i class="fa-solid fa-paperclip"></i> ${nComp}</span>`
    : '';

  const acciones = p.esFijo
    ? `<button class="cat-icon-btn ok" data-aprobar="${p.id}" aria-label="Confirmar"><i class="fa-solid fa-check"></i></button>`
    : `<button class="cat-icon-btn ok" data-aprobar="${p.id}" aria-label="Aprobar"><i class="fa-solid fa-check"></i></button>
       <button class="cat-icon-btn" data-edit="${p.id}" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
       <button class="cat-icon-btn danger" data-del="${p.id}" aria-label="Eliminar"><i class="fa-solid fa-trash-can"></i></button>`;

  return `
  <div class="cat-row pend-row${p.esFijo ? ' pend-fijo' : ''}" style="--c:${cat.color}">
    <div class="cat-row-icon"><i class="${cat.icon}"></i></div>
    <div class="cat-row-info">
      <div class="pend-row-top">
        <span class="cat-row-nombre">${titulo}</span>
        ${p.esFijo ? '<span class="pend-fijo-badge"><i class="fa-solid fa-repeat"></i> Fija</span>' : ''}
      </div>
      <div class="pend-monto-row">
        <span class="pend-monto">${fmt(p.monto)}</span>
        ${diaChip}
        ${compChip}
      </div>
      ${meta ? `<div class="pend-meta-row"><span class="pend-meta">${meta}</span></div>` : ''}
    </div>
    <div class="cat-row-actions">
      ${acciones}
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

// ── Form crear / editar ──────────────────────────────────────
function openForm(editId = null) {
  if (document.getElementById('modalPend')) return;
  const editing = editId ? pendientes.find(p => p.id === editId) : null;

  const esIngreso = tipoActivo === 'ingreso';
  const accent = esIngreso ? '#34d399' : '#f87171';
  const cats = catsPorTipo[tipoActivo] || [];

  let selCat    = editing ? (editing.categoria || null) : null;
  let selCuenta = editing ? (editing.cuentaId  || null) : (cuentas[0] ? cuentas[0].id : null);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalPend';
  overlay.innerHTML = `
  <div class="modal-sheet glass modal-cuenta-sheet mov-form-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">${editing ? 'Editar' : 'Nuevo'} pendiente · ${esIngreso ? 'Por cobrar' : 'Por pagar'}</p>
    <h2 class="modal-title">${editing ? 'Modificar pendiente' : 'Anotar pendiente'}</h2>
    <div class="form-scroll">

      <div class="form-group">
        <label class="form-label">Monto</label>
        <div class="input-prefix-wrap">
          <span class="input-prefix">$</span>
          <input class="form-input input-with-prefix" id="pMonto"
            type="text" inputmode="numeric" placeholder="0" autocomplete="off"
            value="${editing ? fmtInput(editing.monto) : ''}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Concepto <span class="form-label-opt">(opcional)</span></label>
        <input class="form-input" id="pConcepto" type="text" maxlength="40"
          placeholder="${esIngreso ? 'Ej. Pago de Thalía' : 'Ej. Arriendo'}"
          value="${editing ? (editing.concepto || '') : ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Cuenta <span class="form-label-opt">(al aprobar)</span></label>
        <button type="button" class="cat-select-btn" id="pCuentaBtn"></button>
        <span class="form-hint">Donde se ${esIngreso ? 'abonará' : 'cobrará'} cuando lo apruebes.</span>
      </div>

      <div class="form-group">
        <label class="form-label">Categoría <span class="form-label-opt">(opcional)</span></label>
        <button type="button" class="cat-select-btn" id="pCatBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Comprobantes <span class="form-label-opt">(opcional)</span></label>
        <button class="foto-ia-btn" id="pBtnFoto" type="button">
          <span class="foto-ia-icon"><i class="fa-solid fa-camera"></i></span>
          <span class="foto-ia-text">
            <span class="foto-ia-title">Agregar comprobante</span>
            <span class="foto-ia-desc">Toma o sube fotos y la IA rellena los datos</span>
          </span>
          <i class="fa-solid fa-wand-magic-sparkles foto-ia-magic"></i>
        </button>
        <div class="foto-gallery" id="pFotoGallery" hidden></div>
      </div>

    </div>
    <div class="modal-actions">
      <button class="modal-cancel" id="pCancel">Cancelar</button>
      <button class="btn-primary" id="pGuardar">${editing ? 'Guardar' : 'Anotar'}</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  const montoInput = overlay.querySelector('#pMonto');
  attachMontoFmt(montoInput);

  const cuentaPicker = initCuentaPicker({
    btn: overlay.querySelector('#pCuentaBtn'),
    cuentas,
    selectedId: selCuenta,
    accent,
    onSelect: (c) => { selCuenta = c ? c.id : null; },
  });

  function aplicarValorCategoria(cat) {
    if (!cat || !cat.valor) return;
    if (!montoInput.value) montoInput.value = fmtInput(cat.valor);
  }
  function aplicarCuentaCategoria(cat) {
    if (!cat || !cat.cuentaId) return;
    if (cuentas.some(c => c.id === cat.cuentaId)) {
      selCuenta = cat.cuentaId;
      cuentaPicker.setSelected(cat.cuentaId);
    }
  }

  const catPicker = initCatPicker({
    btn: overlay.querySelector('#pCatBtn'),
    cats,
    selectedId: selCat,
    accent,
    tipo: tipoActivo,
    onSelect: (cat) => {
      selCat = cat ? cat.id : null;
      aplicarValorCategoria(cat);
      aplicarCuentaCategoria(cat);
    },
  });

  // ── Comprobantes (galería + captura + IA) ──────────────────
  // Al editar arrancamos con los que ya tenía; se pueden agregar más.
  const previos = Array.isArray(editing?.comprobantes) && editing.comprobantes.length
    ? editing.comprobantes.slice()
    : (editing?.comprobante ? [editing.comprobante] : []);
  // fotos: { url? (ya subido) | dataUrl? (nuevo por subir) }
  let fotos = previos.map(url => ({ url }));
  const fotoGallery = overlay.querySelector('#pFotoGallery');
  const conceptoInput = overlay.querySelector('#pConcepto');
  let iaHecha = false;

  function renderGallery() {
    if (!fotos.length) { fotoGallery.hidden = true; fotoGallery.innerHTML = ''; return; }
    fotoGallery.hidden = false;
    fotoGallery.innerHTML = fotos.map((f, i) => `
      <div class="foto-thumb">
        <img src="${f.url || f.dataUrl}" alt="comprobante ${i + 1}" />
        <button class="foto-thumb-x" type="button" data-i="${i}" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('') +
      `<button class="foto-thumb-add" type="button" id="pFotoAddMore" aria-label="Agregar otra"><i class="fa-solid fa-plus"></i></button>`;
    fotoGallery.querySelectorAll('.foto-thumb-x').forEach(b => {
      b.addEventListener('click', () => {
        confirmarQuitarFoto(() => { fotos.splice(parseInt(b.dataset.i), 1); renderGallery(); });
      });
    });
    const addBtn = fotoGallery.querySelector('#pFotoAddMore');
    if (addBtn) addBtn.addEventListener('click', abrirCaptura);
  }

  function abrirCaptura() {
    openCapturaModal(accent, (dataUrl, usarIA) => {
      fotos.push({ dataUrl });
      renderGallery();
      if (usarIA) analizarConIA(dataUrl);
    }, { permitirIA: true, iaPorDefecto: !iaHecha });
  }
  overlay.querySelector('#pBtnFoto').addEventListener('click', abrirCaptura);
  renderGallery();

  async function analizarConIA(dataUrl) {
    iaHecha = true;
    mostrarIaOverlay(true);
    try {
      const r = await analizarComprobante(dataUrl, tipoActivo, cats);
      if (r.monto && !parseMonto(montoInput.value)) montoInput.value = fmtInput(r.monto);
      if (r.concepto && !conceptoInput.value) conceptoInput.value = r.concepto;
      if (r.categoria) { selCat = r.categoria; catPicker.setSelected(r.categoria); }
      showToast('Datos cargados por IA');
    } catch { showToast('No se pudo leer con IA, complétalo a mano'); }
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

  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  overlay.querySelector('#pCancel').addEventListener('click', closeForm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeForm(); });

  overlay.querySelector('#pGuardar').addEventListener('click', async () => {
    const monto = parseMonto(montoInput.value);
    if (!monto || monto <= 0) { montoInput.focus(); montoInput.classList.add('input-error'); return; }

    const btn = overlay.querySelector('#pGuardar');
    btn.disabled = true;

    // Subir comprobantes nuevos (con dataUrl); conservar los ya subidos.
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
        btn.disabled = false; btn.textContent = editing ? 'Guardar' : 'Anotar';
        return;
      }
    } else {
      // Sin clave de ImgBB: guardamos dataURL como respaldo
      comprobantes = fotos.map(f => f.url || f.dataUrl);
    }

    btn.textContent = 'Guardando…';

    const data = {
      tipo: tipoActivo,
      monto,
      concepto: overlay.querySelector('#pConcepto').value.trim(),
      cuentaId: selCuenta,
      categoria: selCat,
      comprobantes,
      comprobante: comprobantes[0] || null,
    };

    if (editing) await updateDoc(doc(db, 'pendientes', editId), data);
    else await addDoc(PEND_COL, { ...data, creadoEn: Date.now() });

    closeForm();
    showToast(editing ? 'Pendiente actualizado' : 'Pendiente anotado');
  });
}

function closeForm() {
  const o = document.getElementById('modalPend');
  if (!o) return;
  o.classList.add('closing'); o.classList.remove('active');
  setTimeout(() => o.remove(), 320);
}

// ── Aprobar (convertir en movimiento real) ───────────────────
async function ajustarSaldo(cuentaId, delta) {
  if (!cuentaId || !delta) return;
  const ref = doc(db, 'cuentas', cuentaId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const actual = parseFloat(snap.data().monto) || 0;
  await updateDoc(ref, { monto: actual + delta });
}

function itemPorId(id) {
  return itemsCombinados().find(x => x.id === id);
}

function confirmarAprobar(id) {
  const p = itemPorId(id);
  if (!p) return;
  const esIngreso = p.tipo === 'ingreso';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAprobarPend';
  overlay.innerHTML = `
  <div class="modal-sheet glass confirm-sheet" role="alertdialog" aria-modal="true" style="--accent:${esIngreso ? '#34d399' : '#f87171'}">
    <div class="modal-handle"></div>
    <div class="confirm-icon ok"><i class="fa-solid fa-circle-check"></i></div>
    <h2 class="confirm-title">${esIngreso ? 'Confirmar cobro' : 'Confirmar pago'}</h2>
    <p class="confirm-desc">Se registrará <strong>${fmt(p.monto)}</strong> como ${esIngreso ? 'ingreso' : 'gasto'} real y se ajustará el saldo de la cuenta.</p>
    <div class="confirm-btns">
      <button class="options-btn" id="apNo">Cancelar</button>
      <button class="options-btn ok" id="apSi"><i class="fa-solid fa-check"></i><span>${esIngreso ? 'Recibido' : 'Pagado'}</span></button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay('modalAprobarPend'); });
  overlay.querySelector('#apNo').addEventListener('click', () => closeOverlay('modalAprobarPend'));
  overlay.querySelector('#apSi').addEventListener('click', async () => {
    closeOverlay('modalAprobarPend');
    await aprobar(p);
  });
}

async function aprobar(p) {
  const esIngreso = p.tipo === 'ingreso';
  const monto = parseFloat(p.monto) || 0;

  // Comprobantes guardados en el pendiente (si los hay)
  const comprobantes = Array.isArray(p.comprobantes) ? p.comprobantes : [];

  // Crea el movimiento real
  await addDoc(MOV_COL, {
    tipo: p.tipo,
    monto,
    concepto: p.concepto || '',
    cuentaId: p.cuentaId || null,
    categoria: p.categoria || null,
    comprobantes,
    comprobante: comprobantes[0] || null,
    fecha: Date.now(),
    creadoEn: Date.now(),
    desdePendiente: true,
  });
  // Ajusta el saldo de la cuenta
  await ajustarSaldo(p.cuentaId, esIngreso ? monto : -monto);
  // Elimina el pendiente manual (los fijos vienen de una categoría,
  // no hay documento que borrar; desaparecen solos al haber movimiento).
  if (!p.esFijo) await deleteDoc(doc(db, 'pendientes', p.id));

  showToast(esIngreso ? 'Ingreso registrado' : 'Gasto registrado');
}

// ── Eliminar ─────────────────────────────────────────────────
function confirmarEliminar(id) {
  const p = pendientes.find(x => x.id === id);
  if (!p) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalConfirmPend';
  overlay.innerHTML = `
  <div class="modal-sheet glass confirm-sheet" role="alertdialog" aria-modal="true">
    <div class="modal-handle"></div>
    <div class="confirm-icon"><i class="fa-solid fa-trash-can"></i></div>
    <h2 class="confirm-title">Eliminar pendiente</h2>
    <p class="confirm-desc">¿Seguro que quieres eliminar <strong>${p.concepto || fmt(p.monto)}</strong>?</p>
    <div class="confirm-btns">
      <button class="options-btn" id="pNo">Cancelar</button>
      <button class="options-btn danger" id="pSi"><i class="fa-solid fa-trash-can"></i><span>Eliminar</span></button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay('modalConfirmPend'); });
  overlay.querySelector('#pNo').addEventListener('click', () => closeOverlay('modalConfirmPend'));
  overlay.querySelector('#pSi').addEventListener('click', () => {
    closeOverlay('modalConfirmPend');
    deleteDoc(doc(db, 'pendientes', id));
    showToast('Pendiente eliminado');
  });
}

function closeOverlay(id) {
  const o = document.getElementById(id);
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
document.getElementById('btnNuevoPend').addEventListener('click', () => openForm());
suscribir();
