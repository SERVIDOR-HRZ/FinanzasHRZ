// ── REPORTES ────────────────────────────────────────────────
// Genera documentos PDF profesionales (vía vista de impresión del
// navegador) de: resumen general, estado de cuenta, ingresos, gastos,
// pendientes y categorías. Diseño en blanco/negro con acentos
// verde (ingresos) y rojo (gastos).
import { db } from "./firebase.js";
import {
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Estado en vivo ───────────────────────────────────────────
let cuentas = [];
let movimientos = [];
let pendientes = [];
let categorias = [];

let repSel = 'resumen';
let perSel = 'mes';

onSnapshot(query(collection(db, 'cuentas'), orderBy('creadoEn', 'asc')), snap => {
  cuentas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});
onSnapshot(collection(db, 'movimientos'), snap => {
  movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});
onSnapshot(collection(db, 'pendientes'), snap => {
  pendientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});
onSnapshot(collection(db, 'categorias'), snap => {
  categorias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
});

// ── Helpers ──────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _hoy = new Date();

function fechaLarga(ts) {
  return new Date(ts).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}
function catInfo(id) {
  return categorias.find(c => c.id === id) || { nombre: 'Sin categoría', color: '#111' };
}
function cuentaInfo(id) {
  return cuentas.find(c => c.id === id);
}

// Rango del periodo seleccionado
function enPeriodo(ts) {
  if (perSel === 'todo') return true;
  const d = new Date(ts || 0);
  if (perSel === 'anio') return d.getFullYear() === _hoy.getFullYear();
  // mes actual
  return d.getFullYear() === _hoy.getFullYear() && d.getMonth() === _hoy.getMonth();
}
function periodoTexto() {
  if (perSel === 'todo') return 'Histórico completo';
  if (perSel === 'anio') return `Año ${_hoy.getFullYear()}`;
  return `${MESES[_hoy.getMonth()]} ${_hoy.getFullYear()}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ── Estilos del documento PDF ────────────────────────────────
const DOC_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #111;
    background: #fff;
    font-size: 12px;
    line-height: 1.5;
    padding: 40px 44px;
  }
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #111;
    padding-bottom: 16px;
    margin-bottom: 6px;
  }
  .doc-brand { display: flex; align-items: center; gap: 12px; }
  .doc-logo {
    width: 40px; height: 40px;
    border-radius: 9px;
    background: #111; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800;
  }
  .doc-brand-name { font-size: 17px; font-weight: 800; letter-spacing: -.3px; }
  .doc-brand-sub { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 1.5px; }
  .doc-meta { text-align: right; font-size: 10.5px; color: #555; }
  .doc-meta strong { color: #111; }

  .doc-title { font-size: 24px; font-weight: 800; letter-spacing: -.5px; margin: 22px 0 2px; }
  .doc-period { font-size: 12px; color: #666; margin-bottom: 22px; }

  .cards { display: flex; gap: 12px; margin-bottom: 24px; }
  .card {
    flex: 1;
    border: 1px solid #e2e2e2;
    border-radius: 10px;
    padding: 14px 16px;
  }
  .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
  .card-value { font-size: 19px; font-weight: 800; letter-spacing: -.5px; }
  .card.pos { border-top: 3px solid #16a34a; }
  .card.neg { border-top: 3px solid #dc2626; }
  .card.neutral { border-top: 3px solid #111; }
  .card.blue { border-top: 3px solid #2563eb; }
  .pos .card-value { color: #16a34a; }
  .neg .card-value { color: #dc2626; }

  .section-title {
    font-size: 13px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 1px;
    border-bottom: 1.5px solid #111;
    padding-bottom: 6px; margin: 26px 0 12px;
  }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left;
    font-size: 9.5px; text-transform: uppercase; letter-spacing: .8px;
    color: #666; font-weight: 700;
    border-bottom: 1.5px solid #ccc;
    padding: 8px 10px;
  }
  tbody td { padding: 9px 10px; border-bottom: 1px solid #eee; font-size: 11.5px; vertical-align: middle; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .amt-in  { color: #16a34a; font-weight: 700; }
  .amt-out { color: #dc2626; font-weight: 700; }
  .muted { color: #999; }
  .dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    margin-right: 7px; vertical-align: middle; border: 1px solid rgba(0,0,0,.15);
  }
  tfoot td {
    padding: 11px 10px; font-weight: 800; font-size: 12.5px;
    border-top: 2px solid #111;
  }

  .bar-wrap { background: #eee; border-radius: 4px; height: 7px; width: 100%; overflow: hidden; }
  .bar { height: 100%; border-radius: 4px; }

  .empty { padding: 30px; text-align: center; color: #999; font-style: italic; }

  .doc-footer {
    margin-top: 40px; padding-top: 14px;
    border-top: 1px solid #ddd;
    display: flex; justify-content: space-between;
    font-size: 9.5px; color: #999;
  }
  @media print {
    body { padding: 0; }
    @page { margin: 16mm 14mm; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
`;

// ── Envoltura del documento ──────────────────────────────────
function docShell(titulo, cuerpo) {
  const ahora = new Date();
  return `<!DOCTYPE html>
  <html lang="es"><head><meta charset="UTF-8" />
  <title>${escapeHtml(titulo)} — FinanceApp</title>
  <style>${DOC_CSS}</style></head>
  <body>
    <div class="doc-header">
      <div class="doc-brand">
        <div class="doc-logo">F</div>
        <div>
          <div class="doc-brand-name">FinanceApp</div>
          <div class="doc-brand-sub">Reporte financiero</div>
        </div>
      </div>
      <div class="doc-meta">
        <div><strong>Generado</strong></div>
        <div>${ahora.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        <div>${ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
    <h1 class="doc-title">${escapeHtml(titulo)}</h1>
    <p class="doc-period">${escapeHtml(periodoTexto())}</p>
    ${cuerpo}
    <div class="doc-footer">
      <span>FinanceApp · Documento generado automáticamente</span>
      <span>${escapeHtml(periodoTexto())}</span>
    </div>
  </body></html>`;
}

// Abre el documento y lanza la impresión / guardar como PDF
function abrirImpresion(html) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permite las ventanas emergentes para generar el PDF.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Esperamos a que cargue el contenido antes de imprimir
  w.onload = () => { setTimeout(() => { w.focus(); w.print(); }, 300); };
}

// ── Tabla de movimientos (ingresos o gastos) ─────────────────
function tablaMovimientos(tipo) {
  const esIn = tipo === 'ingreso';
  const items = movimientos
    .filter(m => m.tipo === tipo && enPeriodo(m.fecha || m.creadoEn))
    .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  const total = items.reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const amtClass = esIn ? 'amt-in' : 'amt-out';
  const signo = esIn ? '+' : '−';

  if (!items.length) {
    return `<div class="empty">Sin ${esIn ? 'ingresos' : 'gastos'} en este periodo.</div>`;
  }

  const filas = items.map(m => {
    const cat = catInfo(m.categoria);
    const cue = cuentaInfo(m.cuentaId);
    return `<tr>
      <td>${escapeHtml(fechaLarga(m.fecha || m.creadoEn))}</td>
      <td>${escapeHtml(m.concepto || cat.nombre)}</td>
      <td><span class="dot" style="background:${escapeHtml(cat.color || '#111')}"></span>${escapeHtml(cat.nombre)}</td>
      <td>${escapeHtml(cue ? cue.nombre : '—')}</td>
      <td class="num ${amtClass}">${signo}${fmt(m.monto)}</td>
    </tr>`;
  }).join('');

  return `
    <table>
      <thead><tr>
        <th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Cuenta</th><th class="num">Monto</th>
      </tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr>
        <td colspan="4">Total (${items.length} ${items.length === 1 ? 'registro' : 'registros'})</td>
        <td class="num ${amtClass}">${signo}${fmt(total)}</td>
      </tr></tfoot>
    </table>`;
}

function repIngresos() { return docShell('Reporte de ingresos', tablaMovimientos('ingreso')); }
function repGastos()   { return docShell('Reporte de gastos', tablaMovimientos('gasto')); }

// ── Resumen general ──────────────────────────────────────────
function repResumen() {
  const ing = movimientos.filter(m => m.tipo === 'ingreso' && enPeriodo(m.fecha || m.creadoEn));
  const gas = movimientos.filter(m => m.tipo === 'gasto'   && enPeriodo(m.fecha || m.creadoEn));
  const totalIn  = ing.reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const totalOut = gas.reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
  const balance  = cuentas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);
  const neto = totalIn - totalOut;

  const porCobrar = pendientes.filter(p => p.tipo === 'ingreso').reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
  const porPagar  = pendientes.filter(p => p.tipo === 'gasto').reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

  const cards = `
    <div class="cards">
      <div class="card neutral"><div class="card-label">Balance total</div><div class="card-value">${fmt(balance)}</div></div>
      <div class="card pos"><div class="card-label">Ingresos</div><div class="card-value">${fmt(totalIn)}</div></div>
      <div class="card neg"><div class="card-label">Gastos</div><div class="card-value">${fmt(totalOut)}</div></div>
    </div>
    <div class="cards">
      <div class="card ${neto >= 0 ? 'pos' : 'neg'}"><div class="card-label">Flujo neto</div><div class="card-value">${neto >= 0 ? '+' : '−'}${fmt(Math.abs(neto))}</div></div>
      <div class="card blue"><div class="card-label">Por cobrar</div><div class="card-value">${fmt(porCobrar)}</div></div>
      <div class="card blue"><div class="card-label">Por pagar</div><div class="card-value">${fmt(porPagar)}</div></div>
    </div>`;

  // Top categorías de gasto del periodo
  const porCat = {};
  gas.forEach(m => {
    const c = catInfo(m.categoria);
    const k = c.nombre;
    if (!porCat[k]) porCat[k] = { total: 0, color: c.color || '#111' };
    porCat[k].total += parseFloat(m.monto) || 0;
  });
  const top = Object.entries(porCat).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
  const maxCat = top.length ? top[0][1].total : 0;

  const topHtml = top.length ? `
    <div class="section-title">Principales gastos por categoría</div>
    <table><tbody>
      ${top.map(([nombre, d]) => `
        <tr>
          <td style="width:30%"><span class="dot" style="background:${escapeHtml(d.color)}"></span>${escapeHtml(nombre)}</td>
          <td><div class="bar-wrap"><div class="bar" style="width:${maxCat ? Math.round(d.total / maxCat * 100) : 0}%;background:#dc2626"></div></div></td>
          <td class="num amt-out">${fmt(d.total)}</td>
        </tr>`).join('')}
    </tbody></table>` : '';

  return docShell('Resumen general', cards + topHtml);
}

// Etiquetas de categoría de cuenta (igual que en cuentas.js)
const CAT_CUENTA = {
  supervivencia: 'Supervivencia', empresa: 'Empresa', ahorro: 'Ahorro',
  libre: 'Libre', emergencia: 'Emergencia', normal: 'Normal',
};

// ── Estado de cuenta ─────────────────────────────────────────
function repEstado() {
  const balance = cuentas.reduce((s, c) => s + (parseFloat(c.monto) || 0), 0);

  const cards = `
    <div class="cards">
      <div class="card neutral"><div class="card-label">Balance total</div><div class="card-value">${fmt(balance)}</div></div>
      <div class="card neutral"><div class="card-label">Cuentas</div><div class="card-value">${cuentas.length}</div></div>
    </div>`;

  if (!cuentas.length) return docShell('Estado de cuenta', cards + '<div class="empty">No hay cuentas registradas.</div>');

  const filas = cuentas.map(c => {
    const monto = parseFloat(c.monto) || 0;
    return `<tr>
      <td><span class="dot" style="background:${escapeHtml(c.color || '#111')}"></span>${escapeHtml(c.nombre || 'Cuenta')}</td>
      <td class="muted">${escapeHtml(CAT_CUENTA[c.categoria] || 'Normal')}</td>
      <td class="num ${monto < 0 ? 'amt-out' : ''}">${fmt(monto)}</td>
    </tr>`;
  }).join('');

  const tabla = `
    <div class="section-title">Detalle de cuentas</div>
    <table>
      <thead><tr><th>Cuenta</th><th>Tipo</th><th class="num">Saldo</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><td colspan="2">Balance total</td><td class="num">${fmt(balance)}</td></tr></tfoot>
    </table>`;

  return docShell('Estado de cuenta', cards + tabla);
}

// ── Pendientes ───────────────────────────────────────────────
function repPendientes() {
  const porCobrar = pendientes.filter(p => p.tipo === 'ingreso');
  const porPagar  = pendientes.filter(p => p.tipo === 'gasto');
  const totalCobrar = porCobrar.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
  const totalPagar  = porPagar.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);

  const cards = `
    <div class="cards">
      <div class="card pos"><div class="card-label">Por cobrar</div><div class="card-value">${fmt(totalCobrar)}</div></div>
      <div class="card neg"><div class="card-label">Por pagar</div><div class="card-value">${fmt(totalPagar)}</div></div>
      <div class="card ${totalCobrar - totalPagar >= 0 ? 'pos' : 'neg'}"><div class="card-label">Balance pendiente</div><div class="card-value">${fmt(totalCobrar - totalPagar)}</div></div>
    </div>`;

  function bloque(items, titulo, amtClass, signo) {
    if (!items.length) return `<div class="section-title">${titulo}</div><div class="empty">Sin registros.</div>`;
    const filas = items.map(p => {
      const cat = catInfo(p.categoria);
      const cue = cuentaInfo(p.cuentaId);
      return `<tr>
        <td>${escapeHtml(p.concepto || cat.nombre)}</td>
        <td><span class="dot" style="background:${escapeHtml(cat.color || '#111')}"></span>${escapeHtml(cat.nombre)}</td>
        <td>${escapeHtml(cue ? cue.nombre : '—')}</td>
        <td class="num ${amtClass}">${signo}${fmt(p.monto)}</td>
      </tr>`;
    }).join('');
    const total = items.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
    return `
      <div class="section-title">${titulo}</div>
      <table>
        <thead><tr><th>Concepto</th><th>Categoría</th><th>Cuenta</th><th class="num">Monto</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num ${amtClass}">${signo}${fmt(total)}</td></tr></tfoot>
      </table>`;
  }

  return docShell('Reporte de pendientes',
    cards +
    bloque(porCobrar, 'Por cobrar', 'amt-in', '+') +
    bloque(porPagar, 'Por pagar', 'amt-out', '−'));
}

// ── Categorías ───────────────────────────────────────────────
function repCategorias() {
  function bloque(tipo, titulo, amtClass) {
    const cats = categorias.filter(c => c.tipo === tipo);
    if (!cats.length) return `<div class="section-title">${titulo}</div><div class="empty">Sin categorías.</div>`;

    const filas = cats.map(c => {
      // Total movido en el periodo por esta categoría
      const total = movimientos
        .filter(m => m.tipo === tipo && m.categoria === c.id && enPeriodo(m.fecha || m.creadoEn))
        .reduce((s, m) => s + (parseFloat(m.monto) || 0), 0);
      const fija = c.fija && c.diaCobro ? `Día ${c.diaCobro}` : '—';
      return `<tr>
        <td><span class="dot" style="background:${escapeHtml(c.color || '#111')}"></span>${escapeHtml(c.nombre)}</td>
        <td class="muted">${c.valor ? fmt(c.valor) : 'Variable'}</td>
        <td class="muted">${escapeHtml(fija)}</td>
        <td class="num ${amtClass}">${fmt(total)}</td>
      </tr>`;
    }).join('');

    return `
      <div class="section-title">${titulo}</div>
      <table>
        <thead><tr><th>Categoría</th><th>Valor fijo</th><th>Cobro</th><th class="num">Total periodo</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>`;
  }

  return docShell('Reporte de categorías',
    bloque('ingreso', 'Categorías de ingreso', 'amt-in') +
    bloque('gasto', 'Categorías de gasto', 'amt-out'));
}

// ── Dispatcher ───────────────────────────────────────────────
const GENERADORES = {
  resumen: repResumen,
  estado: repEstado,
  ingresos: repIngresos,
  gastos: repGastos,
  pendientes: repPendientes,
  categorias: repCategorias,
};

function generar() {
  const fn = GENERADORES[repSel];
  if (!fn) return;
  abrirImpresion(fn());
}

// ── UI: selección de tipo y periodo ──────────────────────────
document.querySelectorAll('.rep-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.rep-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    repSel = card.dataset.rep;
  });
});

document.querySelectorAll('.rep-per-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.rep-per-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    perSel = btn.dataset.per;
  });
});

document.getElementById('btnGenerar').addEventListener('click', generar);
