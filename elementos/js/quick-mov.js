// ── QUICK-MOV ───────────────────────────────────────────────
// Formulario de NUEVO ingreso/gasto disponible en cualquier pantalla,
// con captura de foto + análisis por IA. Escribe en Firestore y ajusta
// el saldo de la cuenta.
import { db } from "./firebase.js";
import {
  collection, addDoc, updateDoc, doc, getDoc, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { subscribeCategorias } from "./cats-store.js";
import { comprimirImagen, analizarComprobante, subirImgBB, IMGBB_KEY } from "./ai-config.js";
import { initCatPicker } from "./cat-picker.js";
import { initCuentaPicker } from "./cuenta-picker.js";
import { notify } from "./toast.js";

const MOV_COL = collection(db, 'movimientos');
const CUE_COL = collection(db, 'cuentas');

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

  let selCat = null;   // por defecto: ninguna categoría seleccionada
  let selCuenta = cuentas[0].id;
  let fotos = [];   // [{ dataUrl }]  comprobantes aprobados

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalQuickMov';
  overlay.innerHTML = `
  <div class="modal-sheet glass modal-cuenta-sheet mov-form-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">Nuevo ${tipo}</p>
    <h2 class="modal-title">Registrar ${tipo}</h2>
    <div class="form-scroll">

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
        <button type="button" class="cat-select-btn" id="qCuentaBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Categoría</label>
        <button type="button" class="cat-select-btn" id="qCatBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Comprobantes <span class="form-label-opt">(opcional)</span></label>
        <button class="foto-ia-btn" id="btnFoto" type="button">
          <span class="foto-ia-icon"><i class="fa-solid fa-camera"></i></span>
          <span class="foto-ia-text">
            <span class="foto-ia-title">Agregar comprobante</span>
            <span class="foto-ia-desc">Toma o sube fotos y la IA rellena los datos</span>
          </span>
          <i class="fa-solid fa-wand-magic-sparkles foto-ia-magic"></i>
        </button>
        <div class="foto-gallery" id="fotoGallery" hidden></div>
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
  const cuentaBtn = overlay.querySelector('#qCuentaBtn');
  const catBtn = overlay.querySelector('#qCatBtn');
  const fotoGallery = overlay.querySelector('#fotoGallery');

  // Selector de cuenta (botón + buscador)
  const cuentaPicker = initCuentaPicker({
    btn: cuentaBtn,
    cuentas,
    selectedId: selCuenta,
    accent,
    onSelect: (c) => { selCuenta = c ? c.id : null; },
  });

  // ¿el monto actual fue puesto automáticamente por una categoría?
  let montoAuto = false;

  function aplicarValorCategoria(cat) {
    if (!cat || !cat.valor) return;
    // Solo autocompletamos si el campo está vacío o lo llenó otra categoría,
    // así no pisamos un monto que el usuario escribió a mano.
    if (!montoInput.value || montoAuto) {
      montoInput.value = fmtMiles(cat.valor);
      montoInput.classList.remove('input-error');
      montoAuto = true;
    }
  }

  // Selector de categoría (botón + buscador)
  const catPicker = initCatPicker({
    btn: catBtn,
    cats,
    selectedId: selCat,
    accent,
    tipo,
    onSelect: (cat) => {
      selCat = cat ? cat.id : null;
      aplicarValorCategoria(cat);
      aplicarCuentaCategoria(cat);
    },
  });

  function aplicarCuentaCategoria(cat) {
    if (!cat || !cat.cuentaId) return;
    if (cuentas.some(c => c.id === cat.cuentaId)) {
      selCuenta = cat.cuentaId;
      cuentaPicker.setSelected(cat.cuentaId);
    }
  }

  // valores iniciales de la categoría preseleccionada
  const catInicial = cats.find(c => c.id === selCat);
  aplicarValorCategoria(catInicial);
  aplicarCuentaCategoria(catInicial);

  montoInput.addEventListener('input', () => {
    montoInput.classList.remove('input-error');
    montoAuto = false;   // el usuario tomó control del monto
    const raw = montoInput.value.replace(/[^0-9]/g, '');
    montoInput.value = raw ? new Intl.NumberFormat('es-CO').format(parseInt(raw)) : '';
  });

  // ── Comprobantes (galería + captura) ───────────────────────
  let iaHecha = false;   // solo autocompletamos con la primera foto

  function renderGallery() {
    if (!fotos.length) { fotoGallery.hidden = true; fotoGallery.innerHTML = ''; return; }
    fotoGallery.hidden = false;
    fotoGallery.innerHTML = fotos.map((f, i) => `
      <div class="foto-thumb">
        <img src="${f.dataUrl}" alt="comprobante ${i + 1}" />
        <button class="foto-thumb-x" type="button" data-i="${i}" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('') +
      `<button class="foto-thumb-add" type="button" id="fotoAddMore" aria-label="Agregar otra"><i class="fa-solid fa-plus"></i></button>`;

    fotoGallery.querySelectorAll('.foto-thumb-x').forEach(b => {
      b.addEventListener('click', () => { fotos.splice(parseInt(b.dataset.i), 1); renderGallery(); });
    });
    const addBtn = fotoGallery.querySelector('#fotoAddMore');
    if (addBtn) addBtn.addEventListener('click', abrirCaptura);
  }

  async function analizarPrimera(dataUrl) {
    if (iaHecha) return;
    iaHecha = true;
    mostrarIaOverlay(true);
    try {
      const r = await analizarComprobante(dataUrl, tipo, cats);
      if (r.monto && !parseMonto(montoInput.value)) { montoInput.value = fmtMiles(r.monto); montoAuto = false; }
      if (r.concepto && !conceptoInput.value) conceptoInput.value = r.concepto;
      if (r.categoria) { selCat = r.categoria; catPicker.setSelected(r.categoria); }
      toast('Datos cargados por IA', 'success');
    } catch { toast('No se pudo leer con IA, complétalo a mano', 'error'); }
    finally { mostrarIaOverlay(false); }
  }

  // Overlay de bloqueo mientras la IA analiza la imagen
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

  // Al aprobar una foto en el modal de captura
  function onFotoAprobada(dataUrl) {
    const primera = fotos.length === 0;
    fotos.push({ dataUrl });
    renderGallery();
    if (primera) analizarPrimera(dataUrl);
  }

  function abrirCaptura() { openCapturaModal(accent, onFotoAprobada); }
  overlay.querySelector('#btnFoto').addEventListener('click', abrirCaptura);
  renderGallery();

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
    btn.disabled = true;

    // Subir comprobantes a ImgBB (si hay clave y fotos)
    let comprobantes = [];
    if (fotos.length && IMGBB_KEY) {
      btn.textContent = 'Subiendo fotos…';
      try {
        comprobantes = await Promise.all(fotos.map(f => subirImgBB(f.dataUrl)));
      } catch (e) {
        toast('No se pudieron subir las fotos', 'error');
        btn.disabled = false; btn.textContent = 'Registrar';
        return;
      }
    } else if (fotos.length && !IMGBB_KEY) {
      // Sin clave de ImgBB: guardamos las imágenes comprimidas como respaldo
      comprobantes = fotos.map(f => f.dataUrl);
    }

    btn.textContent = 'Guardando…';

    const data = {
      tipo,
      monto,
      concepto: conceptoInput.value.trim(),
      cuentaId: selCuenta,
      categoria: selCat,
      comprobantes,                         // array de URLs (o dataURLs de respaldo)
      comprobante: comprobantes[0] || null, // compatibilidad
      fecha: Date.now(),
      creadoEn: Date.now(),
    };
    await addDoc(MOV_COL, data);
    await ajustarSaldo(data.cuentaId, esIngreso ? monto : -monto);

    close();
    toast(esIngreso ? 'Ingreso registrado' : 'Gasto registrado');
  });
}

// ── MODAL DE CAPTURA ────────────────────────────────────────
// Deja tomar/subir una foto, previsualizarla y aprobarla o repetirla.
function openCapturaModal(accent, onAprobar) {
  if (document.getElementById('modalCaptura')) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalCaptura';
  overlay.innerHTML = `
  <div class="modal-sheet glass captura-sheet" role="dialog" aria-modal="true" style="--accent:${accent}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow"><i class="fa-solid fa-receipt"></i> Comprobante</p>
    <h2 class="modal-title">Agregar foto</h2>
    <p class="modal-subtitle">Captura o sube el recibo, luego revísalo antes de usarlo.</p>

    <div class="captura-stage" id="capturaStage">
      <div class="captura-shot" id="capturaShot">
        <img id="capturaImg" src="" alt="previsualización" />
        <button class="captura-retake" id="capRetake" type="button"><i class="fa-solid fa-rotate-left"></i> Repetir</button>
        <span class="captura-badge"><i class="fa-solid fa-circle-check"></i> Lista</span>
      </div>

      <div class="captura-cam" id="capturaCam">
        <video id="capturaVideo" playsinline autoplay muted></video>
        <button class="captura-shutter" id="capShutter" type="button" aria-label="Tomar foto"><span></span></button>
      </div>

      <div class="captura-loading" id="capturaLoading">
        <span class="spinner"></span>
        <span id="capturaLoadingTxt">Procesando imagen…</span>
      </div>
    </div>

    <div class="captura-source">
      <button class="captura-src-btn" id="btnCamara" type="button">
        <span class="captura-src-ico"><i class="fa-solid fa-camera"></i></span>
        <span class="captura-src-txt">
          <span class="captura-src-title">Cámara</span>
          <span class="captura-src-desc">Toma la foto ahora</span>
        </span>
      </button>
      <button class="captura-src-btn" id="btnGaleria" type="button">
        <span class="captura-src-ico"><i class="fa-solid fa-images"></i></span>
        <span class="captura-src-txt">
          <span class="captura-src-title">Galería</span>
          <span class="captura-src-desc">Elige una imagen</span>
        </span>
      </button>
    </div>

    <input type="file" id="capGaleria" accept="image/*" hidden />

    <div class="modal-actions">
      <button class="modal-cancel" id="capCancel">Cancelar</button>
      <button class="btn-primary" id="capUsar"><i class="fa-solid fa-check"></i> Usar foto</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  const sheet = overlay.querySelector('.captura-sheet');
  const capImg = overlay.querySelector('#capturaImg');
  const capGaleria = overlay.querySelector('#capGaleria');
  const video = overlay.querySelector('#capturaVideo');
  let dataUrl = null;
  let stream = null;

  // Estados: 'empty' | 'camera' | 'loading' | 'shot'
  function setState(s) { sheet.dataset.state = s; }
  setState('empty');

  function detenerCamara() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null;
  }

  async function abrirCamara() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Tu navegador no permite la cámara, usa Galería');
      capGaleria.click();
      return;
    }
    setState('loading');
    overlay.querySelector('#capturaLoadingTxt').textContent = 'Abriendo cámara…';
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      });
      video.srcObject = stream;
      await video.play().catch(() => {});
      setState('camera');
    } catch (e) {
      detenerCamara();
      toast('No se pudo acceder a la cámara');
      setState('empty');
    }
  }

  function tomarFoto() {
    if (!stream) return;
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    detenerCamara();
    capImg.src = dataUrl;
    setState('shot');
  }

  async function cargarArchivo(file) {
    if (!file) return;
    setState('loading');
    overlay.querySelector('#capturaLoadingTxt').textContent = 'Procesando imagen…';
    try { dataUrl = await comprimirImagen(file); }
    catch { toast('No se pudo leer la imagen'); setState(dataUrl ? 'shot' : 'empty'); return; }
    capImg.src = dataUrl;
    setState('shot');
  }

  overlay.querySelector('#btnCamara').addEventListener('click', abrirCamara);
  overlay.querySelector('#btnGaleria').addEventListener('click', () => capGaleria.click());
  overlay.querySelector('#capShutter').addEventListener('click', tomarFoto);
  overlay.querySelector('#capRetake').addEventListener('click', () => { dataUrl = null; setState('empty'); });
  capGaleria.addEventListener('change', () => cargarArchivo(capGaleria.files[0]));

  function close() {
    detenerCamara();
    overlay.classList.add('closing'); overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 320);
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#capCancel').addEventListener('click', close);
  overlay.querySelector('#capUsar').addEventListener('click', () => {
    if (!dataUrl) return;
    onAprobar(dataUrl);
    close();
  });
}

function toast(msg, tipo) { notify(msg, tipo); }
