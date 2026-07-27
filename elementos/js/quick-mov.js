// ── QUICK-MOV ───────────────────────────────────────────────
// Formulario de NUEVO ingreso/gasto disponible en cualquier pantalla,
// con captura de foto + análisis por IA. Escribe en Firestore y ajusta
// el saldo de la cuenta.
import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, doc, getDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { subscribeCategorias } from "./cats-store.js";
import { comprimirImagen, analizarComprobante } from "./ai-config.js";

const MOV_COL = collection(db, 'movimientos');
const CUE_COL = collection(db, 'cuentas');

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// ── Datos en vivo ────────────────────────────────────────────
let cuentas = [];
let catsPorTipo = { ingreso: [], gasto: [] };

onSnapshot(query(CUE_COL, orderBy('creadoEn', 'asc')), snap => {
  cuentas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});
subscribeCategorias('ingreso', c => { catsPorTipo.ingreso = c; });
subscribeCategorias('gasto',   c => { catsPorTipo.gasto   = c; });

// ── Helpers formato ──────────────────────────────────────────
function parseMonto(str) { return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0; }
function fmtMiles(n) { return n ? new Intl.NumberFormat('es-CO').format(n) : ''; }

async function ajustarSaldo(cuentaId, delta) {
  if (!cuentaId || !delta) return;
  const ref = doc(db, 'cuentas', cuentaId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const actual = parseFloat(snap.data().monto) || 0;
  await updateDoc(ref, { monto: actual + delta });
}

// ── API pública ──────────────────────────────────────────────
export function openQuickMov(tipo) {
  if (document.getElementById('modalQuickMov')) return;

  const esIngreso = tipo === 'ingreso';
  const accent = esIngreso ? '#34d399' : '#f87171';
  const cats = catsPorTipo[tipo] || [];

  if (!cuentas.length) { toast('Primero crea una cuenta'); return; }

  let selCat = cats[0] ? cats[0].id : null;
  let selCuenta = cuentas[0].id;
  let comprobante = null;   // dataURL

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalQuickMov';
  overlay.innerHTML = `
  <div class="modal-sheet glass modal-cuenta-sheet mov-form-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">Nuevo ${tipo}</p>
    <h2 class="modal-title">Registrar ${tipo}</h2>
    <div class="form-scroll">

      <button class="foto-ia-btn" id="btnFoto" type="button">
        <span class="foto-ia-icon"><i class="fa-solid fa-camera"></i></span>
        <span class="foto-ia-text">
          <span class="foto-ia-title">Escanear comprobante</span>
          <span class="foto-ia-desc">Toma o sube una foto y la IA rellena los datos</span>
        </span>
        <i class="fa-solid fa-wand-magic-sparkles foto-ia-magic"></i>
      </button>
      <input type="file" id="inputFoto" accept="image/*" capture="environment" hidden />
      <div class="foto-preview" id="fotoPreview" hidden></div>

      <div class="form-group">
        <label class="form-label">Monto</label>
        <div class="input-prefix-wrap">
          <span class="input-prefix">$</span>
          <input class="form-input input-with-prefix input-monto-fmt" id="qMonto"
            type="text" inputmode="numeric" placeholder="0" autocomplete="off" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Concepto <span class="form-label-opt">(opcional)</span></label>
        <input class="form-input" id="qConcepto" type="text" maxlength="40"
          placeholder="${esIngreso ? 'Ej. Pago cliente' : 'Ej. Supermercado'}" />
      </div>

      <div class="form-group">
        <label class="form-label">Cuenta</label>
        <div class="form-select-wrap">
          <select class="form-select" id="qCuenta">
            ${cuentas.map(c => `<option value="${c.id}">${c.nombre} — ${fmt(c.monto)}</option>`).join('')}
          </select>
          <i class="fa-solid fa-chevron-down form-select-arrow"></i>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Categoría</label>
        <div class="cats-grid" id="qCats"></div>
      </div>

    </div>
    <div class="modal-actions">
      <button class="modal-cancel" id="qCancel">Cancelar</button>
      <button class="btn-primary" id="qGuardar">Registrar</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  const montoInput = overlay.querySelector('#qMonto');
  const conceptoInput = overlay.querySelector('#qConcepto');
  const cuentaSel = overlay.querySelector('#qCuenta');
  const catsGrid = overlay.querySelector('#qCats');
  const fotoPreview = overlay.querySelector('#fotoPreview');

  // Categorías
  function pintarCats() {
    if (!cats.length) {
      catsGrid.innerHTML = `<a href="${enSecciones() ? '' : 'secciones/'}categorias.html" class="cats-empty-link">
        <i class="fa-solid fa-plus"></i> Crea una categoría de ${tipo}</a>`;
      return;
    }
    catsGrid.innerHTML = '';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (cat.id === selCat ? ' selected' : '');
      btn.type = 'button';
      btn.innerHTML = `<i class="${cat.icon}" style="color:${cat.color}"></i><span class="cat-btn-label">${cat.nombre || cat.label}</span>`;
      btn.addEventListener('click', () => {
        selCat = cat.id;
        catsGrid.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        if (cat.valor && !parseMonto(montoInput.value)) {
          montoInput.value = fmtMiles(cat.valor);
          montoInput.classList.remove('input-error');
        }
      });
      catsGrid.appendChild(btn);
    });
  }
  pintarCats();

  montoInput.addEventListener('input', () => {
    montoInput.classList.remove('input-error');
    const raw = montoInput.value.replace(/[^0-9]/g, '');
    montoInput.value = raw ? new Intl.NumberFormat('es-CO').format(parseInt(raw)) : '';
  });
  cuentaSel.addEventListener('change', () => { selCuenta = cuentaSel.value; });

  // ── Foto + IA ──────────────────────────────────────────────
  const inputFoto = overlay.querySelector('#inputFoto');
  overlay.querySelector('#btnFoto').addEventListener('click', () => inputFoto.click());

  inputFoto.addEventListener('change', async () => {
    const file = inputFoto.files && inputFoto.files[0];
    if (!file) return;

    let dataUrl;
    try { dataUrl = await comprimirImagen(file); }
    catch { toast('No se pudo leer la imagen'); return; }
    comprobante = dataUrl;

    fotoPreview.hidden = false;
    fotoPreview.innerHTML = `
      <img src="${dataUrl}" alt="comprobante" />
      <div class="foto-analizando"><span class="spinner"></span> Analizando con IA…</div>
      <button class="foto-quitar" type="button" id="qQuitarFoto" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>`;
    fotoPreview.querySelector('#qQuitarFoto').addEventListener('click', () => {
      comprobante = null; fotoPreview.hidden = true; fotoPreview.innerHTML = '';
    });

    try {
      const r = await analizarComprobante(dataUrl, tipo, cats);
      if (r.monto) montoInput.value = fmtMiles(r.monto);
      if (r.concepto) conceptoInput.value = r.concepto;
      if (r.categoria) {
        selCat = r.categoria;
        catsGrid.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
        const idx = cats.findIndex(c => c.id === r.categoria);
        if (idx >= 0 && catsGrid.children[idx]) catsGrid.children[idx].classList.add('selected');
      }
      const est = fotoPreview.querySelector('.foto-analizando');
      if (est) est.innerHTML = '<i class="fa-solid fa-circle-check"></i> Datos cargados';
    } catch (e) {
      const est = fotoPreview.querySelector('.foto-analizando');
      if (est) est.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> No se pudo leer, complétalo a mano';
    }
  });

  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  function close() {
    overlay.classList.add('closing'); overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 320);
  }
  overlay.querySelector('#qCancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#qGuardar').addEventListener('click', async () => {
    const monto = parseMonto(montoInput.value);
    if (!monto || monto <= 0) { montoInput.focus(); montoInput.classList.add('input-error'); return; }

    const btn = overlay.querySelector('#qGuardar');
    btn.disabled = true; btn.textContent = 'Guardando…';

    const data = {
      tipo,
      monto,
      concepto: conceptoInput.value.trim(),
      cuentaId: cuentaSel.value,
      categoria: selCat,
      comprobante: comprobante || null,
      fecha: Date.now(),
      creadoEn: Date.now(),
    };
    await addDoc(MOV_COL, data);
    await ajustarSaldo(data.cuentaId, esIngreso ? monto : -monto);

    close();
    toast(esIngreso ? 'Ingreso registrado' : 'Gasto registrado');
  });
}

function enSecciones() { return location.pathname.includes('/secciones/'); }

function toast(msg) {
  const ex = document.getElementById('cuentaToast');
  if (ex) ex.remove();
  const t = document.createElement('div');
  t.id = 'cuentaToast'; t.className = 'cuenta-toast';
  t.innerHTML = `<i class="fa-solid fa-check"></i> ${msg}`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 2000);
}
