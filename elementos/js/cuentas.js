import { db } from "./firebase.js";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── CATEGORÍAS ──────────────────────────────────────────────
const CATEGORIAS = [
  { id: 'supervivencia', label: 'Supervivencia', porcentaje: 40, icon: 'fa-solid fa-house' },
  { id: 'empresa',       label: 'Empresa',       porcentaje: 30, icon: 'fa-solid fa-briefcase' },
  { id: 'ahorro',        label: 'Ahorro',         porcentaje: 15, icon: 'fa-solid fa-piggy-bank' },
  { id: 'libre',         label: 'Libre',          porcentaje: 10, icon: 'fa-solid fa-star' },
  { id: 'emergencia',    label: 'Emergencia',     porcentaje: 5,  icon: 'fa-solid fa-shield-halved' },
  { id: 'normal',        label: 'Normal',         porcentaje: null, icon: 'fa-solid fa-wallet' },
];

const ICONOS = [
  { id: 'efectivo',    clase: 'fa-solid fa-money-bill-wave'  },
  { id: 'banco',       clase: 'fa-solid fa-building-columns' },
  { id: 'tarjeta',     clase: 'fa-solid fa-credit-card'      },
  { id: 'paypal',      clase: 'fa-brands fa-paypal'          },
  { id: 'mercadopago', clase: 'fa-solid fa-tag'              },
  { id: 'nequi',       clase: 'fa-solid fa-mobile-screen'    },
  { id: 'crypto',      clase: 'fa-solid fa-bitcoin-sign'     },
  { id: 'binance',     clase: 'fa-solid fa-coins'            },
  { id: 'ahorro',      clase: 'fa-solid fa-piggy-bank'       },
  { id: 'inversion',   clase: 'fa-solid fa-chart-line'       },
  { id: 'negocio',     clase: 'fa-solid fa-briefcase'        },
  { id: 'wallet',      clase: 'fa-solid fa-wallet'           },
  { id: 'transferencia', clase: 'fa-solid fa-right-left'          },
  { id: 'recibo',        clase: 'fa-solid fa-receipt'             },
  { id: 'caja',          clase: 'fa-solid fa-cash-register'       },
  { id: 'porcentaje',    clase: 'fa-solid fa-percent'             },
  { id: 'deuda',         clase: 'fa-solid fa-hand-holding-dollar' },
  { id: 'banco2',        clase: 'fa-solid fa-landmark'            },
];

const COLORES = [
  '#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE',
  '#007AFF','#5856D6','#AF52DE','#FF2D55','#8E8E93',
  '#30D158','#64D2FF','#BF5AF2','#FF6961','#FFD60A',
  '#0A84FF','#FF375F','#ffffff',
];

// ── ESTADO ──────────────────────────────────────────────────
let cuentas = [];
const COL = collection(db, 'cuentas');

const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

function catInfo(id) { return CATEGORIAS.find(c => c.id === id) || CATEGORIAS.at(-1); }
function iconoInfo(id) { return ICONOS.find(i => i.id === id) || ICONOS[0]; }

// ── FIRESTORE CRUD ───────────────────────────────────────────
async function crearCuenta(data) {
  await addDoc(COL, { ...data, creadoEn: Date.now() });
}

async function actualizarCuenta(id, data) {
  await updateDoc(doc(db, 'cuentas', id), data);
}

async function eliminarCuenta(id) {
  await deleteDoc(doc(db, 'cuentas', id));
}

// ── RENDER ───────────────────────────────────────────────────
const lista     = document.getElementById('cuentasList');
const balanceEl = document.getElementById('balanceTotal');
const subEl     = document.getElementById('balanceSub');

function renderCuentas() {
  const total = cuentas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
  balanceEl.textContent = fmt(total);
  subEl.textContent = cuentas.length === 1 ? '1 cuenta' : `${cuentas.length} cuentas`;

  if (!cuentas.length) {
    lista.innerHTML = `
      <div class="cuentas-empty glass">
        <i class="fa-solid fa-wallet"></i>
        <p>Sin cuentas aún.<br>Toca <strong>Nueva cuenta</strong> para empezar.</p>
      </div>`;
    return;
  }

  lista.innerHTML = cuentas.map(c => {
    const cat   = catInfo(c.categoria);
    const ico   = iconoInfo(c.icono);
    const color = c.color || '#ffffff';

    return `
    <div class="cuenta-card" data-id="${c.id}" style="--cuenta-color:${color}">
      <div class="cuenta-icon-wrap">
        <i class="${ico.clase}"></i>
      </div>
      <div class="cuenta-info">
        <span class="cuenta-nombre">${c.nombre}</span>
        <span class="cuenta-cat-label">${cat.label}${cat.porcentaje ? ` · ${cat.porcentaje}%` : ''}</span>
      </div>
      <div class="cuenta-right">
        <span class="cuenta-saldo">${fmt(c.monto)}</span>
      </div>
    </div>`;
  }).join('');

  lista.querySelectorAll('.cuenta-card').forEach(card => {
    card.addEventListener('click', () => openOptions(card.dataset.id));
  });
}

function maskKey(key) {
  if (key.length <= 8) return key;
  return key.slice(0, 4) + '···' + key.slice(-4);
}

// ── LISTENER TIEMPO REAL ─────────────────────────────────────
const q = query(COL, orderBy('creadoEn', 'asc'));
onSnapshot(q, snap => {
  cuentas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  cuentas.sort((a, b) => (parseFloat(b.monto) || 0) - (parseFloat(a.monto) || 0));
  renderCuentas();
});

// ── BOTTOM SHEET OPCIONES ────────────────────────────────────
function openOptions(id) {
  const c = cuentas.find(x => x.id === id);
  if (!c) return;
  const ico   = iconoInfo(c.icono);
  const color = c.color || '#ffffff';
  const tieneKey = c.llave && c.llave.trim();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOpciones';

  overlay.innerHTML = `
  <div class="modal-sheet glass options-sheet" role="dialog" aria-modal="true">
    <div class="modal-handle"></div>
    <div class="options-cuenta-header">
      <div class="options-cuenta-icon" style="background:${color}18;color:${color};border:1px solid ${color}35">
        <i class="${ico.clase}"></i>
      </div>
      <div>
        <div class="options-cuenta-nombre">${c.nombre}</div>
        <div class="options-cuenta-saldo">${fmt(c.monto)}</div>
      </div>
    </div>
    <div class="options-btns">
      <button class="options-btn" id="optEditar">
        <i class="fa-solid fa-pen"></i>
        <span>Editar</span>
      </button>
      ${tieneKey ? `
      <button class="options-btn" id="optCopiarLlave">
        <i class="fa-solid fa-key"></i>
        <span>Copiar Bre-B</span>
      </button>` : ''}
    </div>
  </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  overlay.addEventListener('click', e => { if (e.target === overlay) closeOptions(); });

  overlay.querySelector('#optEditar').addEventListener('click', () => {
    closeOptions();
    setTimeout(() => openFormCuenta(id), 320);
  });

  if (tieneKey) {
    overlay.querySelector('#optCopiarLlave').addEventListener('click', () => {
      const btn = overlay.querySelector('#optCopiarLlave');

      function onCopied() {
        btn.innerHTML = '<i class="fa-solid fa-check"></i><span>¡Copiado!</span>';
        btn.style.color = '#34C759';
        btn.style.borderColor = 'rgba(52,199,89,.35)';
        btn.style.background = 'rgba(52,199,89,.1)';
        setTimeout(() => { closeOptions(); showToast('Bre-B copiada'); }, 900);
      }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(c.llave).then(onCopied).catch(() => fallbackCopy(c.llave, onCopied));
      } else {
        fallbackCopy(c.llave, onCopied);
      }
    });
  }
}

function closeOptions() {
  const o = document.getElementById('modalOpciones');
  if (!o) return;
  o.classList.add('closing'); o.classList.remove('active');
  setTimeout(() => o.remove(), 320);
}

// ── CONFIRMACIÓN ELIMINAR ────────────────────────────────────
function confirmarEliminar(id, onConfirm) {
  const c = cuentas.find(x => x.id === id);
  if (!c) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalConfirm';

  overlay.innerHTML = `
  <div class="modal-sheet glass confirm-sheet" role="alertdialog" aria-modal="true">
    <div class="modal-handle"></div>
    <div class="confirm-icon"><i class="fa-solid fa-trash-can"></i></div>
    <h2 class="confirm-title">Eliminar cuenta</h2>
    <p class="confirm-desc">¿Seguro que quieres eliminar <strong>${c.nombre}</strong>? Esta acción no se puede deshacer.</p>
    <div class="confirm-btns">
      <button class="options-btn" id="btnNoEliminar">Cancelar</button>
      <button class="options-btn danger" id="btnSiEliminar">
        <i class="fa-solid fa-trash-can"></i><span>Eliminar</span>
      </button>
    </div>
  </div>`;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  overlay.querySelector('#btnNoEliminar').addEventListener('click', closeConfirm);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeConfirm(); });
  overlay.querySelector('#btnSiEliminar').addEventListener('click', () => {
    closeConfirm();
    onConfirm();
  });
}

function closeConfirm() {
  const o = document.getElementById('modalConfirm');
  if (!o) return;
  o.classList.add('closing'); o.classList.remove('active');
  setTimeout(() => o.remove(), 320);
}

// ── MODAL CREAR / EDITAR ─────────────────────────────────────
let selIcono = 'efectivo';
let selColor = null;
let selCat   = 'normal';

function openFormCuenta(editId = null) {
  if (document.getElementById('modalCuenta')) return;

  const editing = editId ? cuentas.find(c => c.id === editId) : null;
  if (editing) {
    selIcono = editing.icono;
    selColor = editing.color || null;
    selCat   = editing.categoria;
  } else {
    selIcono = 'efectivo'; selColor = null; selCat = 'normal';
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalCuenta';

  overlay.innerHTML = `
  <div class="modal-sheet glass modal-cuenta-sheet" role="dialog" aria-modal="true">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">${editing ? 'Editar cuenta' : 'Nueva cuenta'}</p>
    <h2 class="modal-title">${editing ? 'Modificar datos' : 'Agregar cuenta'}</h2>
    <div class="form-scroll">

      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input class="form-input" id="inputNombre" type="text" placeholder="Ej. Efectivo diario" maxlength="30"
          value="${editing ? editing.nombre : ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Monto</label>
        <div class="input-prefix-wrap">
          <span class="input-prefix">$</span>
          <input class="form-input input-with-prefix input-monto-fmt" id="inputMonto"
            type="text" inputmode="decimal" placeholder="0" autocomplete="off"
            value="${editing ? fmtInput(editing.monto) : ''}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Llave / Bre-B <span class="form-label-opt">(opcional)</span></label>
        <input class="form-input" id="inputLlave" type="text"
          placeholder="Ej. 123456789012345678" maxlength="60"
          value="${editing ? (editing.llave || '') : ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Icono</label>
        <div class="iconos-grid" id="iconosGrid"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Color</label>
        <div class="colores-grid" id="coloresGrid"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Categoría</label>
        <div class="cats-grid" id="catsGrid"></div>
      </div>

      ${editing ? `
      <button class="btn-eliminar-cuenta" id="btnEliminarCuenta">
        <i class="fa-solid fa-trash-can"></i> Eliminar cuenta
      </button>` : ''}

    </div>
    <div class="modal-actions">
      <button class="modal-cancel" id="btnCancelar">Cancelar</button>
      <button class="btn-primary" id="btnGuardar">${editing ? 'Guardar cambios' : 'Crear'}</button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // Iconos
  const iconosGrid = overlay.querySelector('#iconosGrid');
  ICONOS.forEach(ico => {
    const btn = document.createElement('button');
    btn.className = 'ico-btn' + (ico.id === selIcono ? ' selected' : '');
    btn.dataset.id = ico.id;
    btn.innerHTML = `<i class="${ico.clase}"></i>`;
    btn.addEventListener('click', () => {
      selIcono = ico.id;
      iconosGrid.querySelectorAll('.ico-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    iconosGrid.appendChild(btn);
  });

  // Colores
  const coloresGrid = overlay.querySelector('#coloresGrid');
  COLORES.forEach(col => {
    const btn = document.createElement('button');
    btn.className = 'color-btn' + (col === selColor ? ' selected' : '');
    btn.dataset.color = col;
    btn.style.background = col;
    btn.addEventListener('click', () => {
      selColor = col;
      coloresGrid.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      coloresGrid.classList.remove('grid-error');
    });
    coloresGrid.appendChild(btn);
  });

  // Categorías
  const catsGrid = overlay.querySelector('#catsGrid');
  CATEGORIAS.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat.id === selCat ? ' selected' : '');
    btn.dataset.id = cat.id;
    btn.innerHTML = `
      <i class="${cat.icon}"></i>
      <span class="cat-btn-label">${cat.label}</span>
      ${cat.porcentaje ? `<span class="cat-btn-pct">${cat.porcentaje}%</span>` : ''}`;
    btn.addEventListener('click', () => {
      selCat = cat.id;
      catsGrid.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    catsGrid.appendChild(btn);
  });

  // Formato miles
  attachMontoFmt(overlay.querySelector('#inputMonto'));

  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden','false'); overlay.classList.add('active'); });

  overlay.querySelector('#btnCancelar').addEventListener('click', closeFormCuenta);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeFormCuenta(); });

  if (editing) {
    overlay.querySelector('#btnEliminarCuenta').addEventListener('click', () => {
      closeFormCuenta();
      setTimeout(() => {
        confirmarEliminar(editId, () => eliminarCuenta(editId));
      }, 320);
    });
  }

  overlay.querySelector('#btnGuardar').addEventListener('click', async () => {
    const nombre = document.getElementById('inputNombre').value.trim();
    const monto  = parseMonto(document.getElementById('inputMonto').value);
    const llave  = document.getElementById('inputLlave').value.trim();

    if (!nombre) {
      const inp = document.getElementById('inputNombre');
      inp.focus(); inp.classList.add('input-error'); return;
    }
    if (!selColor) {
      overlay.querySelector('#coloresGrid').classList.add('grid-error'); return;
    }

    const btnGuardar = overlay.querySelector('#btnGuardar');
    btnGuardar.disabled = true;
    btnGuardar.textContent = 'Guardando…';

    const data = { nombre, monto, llave, icono: selIcono, color: selColor, categoria: selCat };

    if (editing) {
      await actualizarCuenta(editId, data);
    } else {
      await crearCuenta(data);
    }

    closeFormCuenta();
  });
}

function closeFormCuenta() {
  const o = document.getElementById('modalCuenta');
  if (!o) return;
  o.classList.add('closing'); o.classList.remove('active');
  setTimeout(() => o.remove(), 320);
}

// ── HELPERS FORMATO ──────────────────────────────────────────
function fmtInput(val) {
  if (!val && val !== 0) return '';
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(num);
}

function parseMonto(str) {
  return parseFloat(String(str).replace(/\./g, '').replace(',', '.')) || 0;
}

function attachMontoFmt(input) {
  input.addEventListener('input', () => {
    const raw = input.value.replace(/[^0-9]/g, '');
    input.value = raw ? new Intl.NumberFormat('es-CO').format(parseInt(raw)) : '';
  });
}

// ── TOAST ────────────────────────────────────────────────────
function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  try { document.execCommand('copy'); cb(); } catch(e) { console.warn('Copy failed', e); }
  document.body.removeChild(ta);
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
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 400);
  }, 2000);
}

// ── BOTÓN NUEVA CUENTA ───────────────────────────────────────
document.getElementById('btnNuevaCuenta').addEventListener('click', () => openFormCuenta());
