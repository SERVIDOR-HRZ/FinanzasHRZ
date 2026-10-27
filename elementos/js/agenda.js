// ── AGENDA ───────────────────────────────────────────────────
// Agenda profesional: eventos por día con título, tipo, horario,
// e imágenes. Vistas de día, semana y mes. Guarda en Firestore
// (colección "agenda").

import { db } from "./firebase.js";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { openCapturaModal, confirmarQuitarFoto } from "./quick-mov.js";
import { initOpcionPicker } from "./pickers-cuenta.js";

const ACCENT = '#a78bfa';
const COL = collection(db, 'agenda');

const TIPOS = [
  { id: 'reunion',      label: 'Reunión',      icon: 'fa-solid fa-users',       color: '#60a5fa' },
  { id: 'tarea',        label: 'Tarea',        icon: 'fa-solid fa-list-check',  color: '#34d399' },
  { id: 'recordatorio', label: 'Recordatorio', icon: 'fa-solid fa-bell',        color: '#fbbf24' },
  { id: 'personal',     label: 'Personal',     icon: 'fa-solid fa-user',        color: '#f472b6' },
];
const tipoInfo = id => TIPOS.find(t => t.id === id) || TIPOS[0];

const REPETIR = [
  { id: 'nunca',     label: 'No se repite',  corto: '',             icon: 'fa-solid fa-ban' },
  { id: 'diario',    label: 'Cada día',      corto: 'Cada día',     icon: 'fa-solid fa-sun' },
  { id: 'semanal',   label: 'Cada semana',   corto: 'Cada semana',  icon: 'fa-solid fa-calendar-week' },
  { id: 'quincenal', label: 'Cada 15 días',  corto: 'Cada 15 días', icon: 'fa-solid fa-calendar-days' },
  { id: 'mensual',   label: 'Cada mes',      corto: 'Cada mes',     icon: 'fa-solid fa-calendar' },
  { id: 'dias',      label: 'Días específicos', corto: 'Días elegidos', icon: 'fa-solid fa-list-check' },
];
const repetirInfo = id => REPETIR.find(r => r.id === id) || REPETIR[0];
const repetirTexto = ev => {
  const r = repetirInfo(ev.repetir);
  if (ev.repetir === 'dias') {
    const dias = (ev.repetirDias || []).slice().sort((a, b) => a - b);
    return dias.length ? dias.map(i => DIAS_CORTO[i]).join(' · ') : r.corto;
  }
  return r.corto;
};

const IMPORTANCIA = [
  { id: 'baja',    label: 'Baja',    icon: 'fa-solid fa-angle-down',  color: '#9ca3af' },
  { id: 'normal',  label: 'Normal',  icon: 'fa-solid fa-minus',       color: '#a78bfa' },
  { id: 'alta',    label: 'Alta',    icon: 'fa-solid fa-angle-up',    color: '#fbbf24' },
  { id: 'urgente', label: 'Urgente', icon: 'fa-solid fa-circle-exclamation', color: '#f87171' },
];
const importanciaInfo = id => IMPORTANCIA.find(i => i.id === id) || IMPORTANCIA[1];

const MESES      = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO= ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS       = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const DIAS_CORTO = ['lun','mar','mié','jue','vie','sáb','dom'];
const DIAS_LETRA = ['L','M','X','J','V','S','D'];

const MAX_IMAGENES = 6;
const MAX_BYTES_DOC = 950_000;   // límite práctico por documento en Firestore

// ── Fechas ──────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const sumarDias = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const lunesDe = d => sumarDias(d, -((d.getDay() + 6) % 7));
const mismoDia = (a, b) => key(a) === key(b);
const diaSemana = d => (d.getDay() + 6) % 7;   // 0 = lunes

function fechaLarga(d) {
  return `${DIAS[diaSemana(d)]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}
function fechaCorta(d) {
  return `${DIAS_CORTO[diaSemana(d)]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
}
function hora12(h) {
  if (!h) return '';
  const [H, M] = h.split(':').map(Number);
  const suf = H >= 12 ? 'pm' : 'am';
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return `${h12}:${pad(M)} ${suf}`;
}
function rangoHora(ev) {
  if (ev.todoDia) return 'Todo el día';
  if (!ev.horaInicio) return 'Sin hora';
  return ev.horaFin ? `${hora12(ev.horaInicio)} – ${hora12(ev.horaFin)}` : hora12(ev.horaInicio);
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

// ── Estado ──────────────────────────────────────────────────
let eventos = [];
const VISTAS = ['dia', 'semana', 'mes'];
const VISTA_KEY = 'agendaVista';
function vistaGuardada() {
  try { const v = localStorage.getItem(VISTA_KEY); return VISTAS.includes(v) ? v : 'dia'; } catch { return 'dia'; }
}
let vista = vistaGuardada();   // 'dia' | 'semana' | 'mes' — se recuerda entre visitas
let fechaSel = hoy();

const $ = id => document.getElementById(id);
const vistaEl   = $('agVista');
const navLabel  = $('agNavLabel');
const badgeHoy  = $('agHoyBadge');

// ── Firestore ───────────────────────────────────────────────
onSnapshot(query(COL, orderBy('fecha', 'asc')), snap => {
  eventos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});

const ordenEv = (a, b) => {
  if (!!a.todoDia !== !!b.todoDia) return a.todoDia ? -1 : 1;
  return (a.horaInicio || '99:99').localeCompare(b.horaInicio || '99:99') || (a.creado || 0) - (b.creado || 0);
};
const diasEntre = (a, b) => Math.round((b - a) / 86400000);

// ¿El evento (con su regla de repetición) ocurre el día d?
function ocurreEn(e, d) {
  const k = key(d);
  if (!e.repetir || e.repetir === 'nunca') return e.fecha === k;
  if (k < e.fecha) return false;
  if (e.repetirHasta && k > e.repetirHasta) return false;
  const base = deKey(e.fecha);
  const diff = diasEntre(base, d);
  switch (e.repetir) {
    case 'diario':    return true;
    case 'semanal':   return diff % 7 === 0;
    case 'quincenal': return diff % 14 === 0;
    case 'dias':      return (e.repetirDias || []).includes(diaSemana(d));
    case 'mensual': {
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(base.getDate(), ultimo);
    }
    default: return false;
  }
}

// Eventos de un día, incluyendo repeticiones (cada ocurrencia lleva la fecha del día)
const eventosDe = d => {
  const k = key(d);
  return eventos
    .filter(e => ocurreEn(e, d))
    .map(e => (e.fecha === k ? e : { ...e, fecha: k, esRepeticion: true }))
    .sort(ordenEv);
};
// Cruce de horario: dos eventos del mismo día cuyos rangos se solapan.
// Sin hora de fin se asume una duración de 30 minutos.
const aMin = h => { const [H, M] = h.split(':').map(Number); return H * 60 + M; };
function rangoMin(ev) {
  const ini = aMin(ev.horaInicio);
  const fin = ev.horaFin ? aMin(ev.horaFin) : ini + 30;
  return [ini, Math.max(fin, ini + 1)];
}
function conflictoDe(data, ignorarId = null) {
  if (data.todoDia || !data.horaInicio) return null;
  const [a0, a1] = rangoMin(data);
  return eventosDe(deKey(data.fecha)).find(e => {
    if (e.id === ignorarId || e.todoDia || !e.horaInicio) return false;
    const [b0, b1] = rangoMin(e);
    return a0 < b1 && b0 < a1;
  }) || null;
}
const eventosEntre = (a, b) => {
  const out = [];
  for (let d = new Date(a); d <= b; d = sumarDias(d, 1)) out.push(...eventosDe(d));
  return out;
};

// ── Render general ──────────────────────────────────────────
function render() {
  try { localStorage.setItem(VISTA_KEY, vista); } catch {}
  renderCabecera();
  if (vista === 'dia') renderDia();
  else if (vista === 'semana') renderSemana();
  else renderMes();
}

function renderCabecera() {
  const h = hoy();
  badgeHoy.textContent = `${DIAS_CORTO[diaSemana(h)]} ${h.getDate()} ${MESES_CORTO[h.getMonth()]}`;

  if (vista === 'dia') {
    navLabel.textContent = mismoDia(fechaSel, h) ? `Hoy · ${fechaSel.getDate()} ${MESES_CORTO[fechaSel.getMonth()]}` : fechaCorta(fechaSel);
  } else if (vista === 'semana') {
    const l = lunesDe(fechaSel), dmg = sumarDias(l, 6);
    const mismoMes = l.getMonth() === dmg.getMonth();
    navLabel.textContent = mismoMes
      ? `${l.getDate()} – ${dmg.getDate()} ${MESES_CORTO[l.getMonth()]} ${l.getFullYear()}`
      : `${l.getDate()} ${MESES_CORTO[l.getMonth()]} – ${dmg.getDate()} ${MESES_CORTO[dmg.getMonth()]}`;
  } else {
    navLabel.textContent = `${MESES[fechaSel.getMonth()]} ${fechaSel.getFullYear()}`;
  }

  document.querySelectorAll('.ag-tab').forEach(t => t.classList.toggle('active', t.dataset.vista === vista));

  // Stats
  const l = lunesDe(h);
  const semana = eventosEntre(l, sumarDias(l, 6));
  const pendientes = eventos.filter(e => e.tipo === 'tarea' && !e.hecho && (e.fecha >= key(h) || (e.repetir && e.repetir !== 'nunca' && (!e.repetirHasta || e.repetirHasta >= key(h)))));
  $('agStatHoy').textContent = eventosDe(h).length;
  $('agStatSemana').textContent = semana.length;
  $('agStatPend').textContent = pendientes.length;
}

// ── Item de evento ──────────────────────────────────────────
function evHTML(ev, conFecha = false) {
  const t = tipoInfo(ev.tipo);
  const nImg = (ev.imagenes || []).length;
  const hecho = ev.tipo === 'tarea' && ev.hecho;
  return `
  <div class="ag-ev${hecho ? ' hecho' : ''}" style="--c:${t.color}" data-id="${ev.id}">
    <div class="ag-ev-time">
      ${ev.todoDia ? '<span class="ag-ev-allday">Todo<br>el día</span>'
        : ev.horaInicio ? `<span>${hora12(ev.horaInicio)}</span>${ev.horaFin ? `<span class="ag-ev-fin">${hora12(ev.horaFin)}</span>` : ''}`
        : '<span class="ag-ev-allday">—</span>'}
    </div>
    <div class="ag-ev-card${ev.importancia === 'urgente' ? ' urgente' : ''}">
      <span class="ag-ev-ico"><i class="${t.icon}"></i></span>
      <div class="ag-ev-body">
        <div class="ag-ev-title">${esc(ev.titulo)}${ev.importancia && ev.importancia !== 'normal' ? `<span class="ag-ev-imp" style="--i:${importanciaInfo(ev.importancia).color}"><i class="${importanciaInfo(ev.importancia).icon}"></i>${importanciaInfo(ev.importancia).label}</span>` : ''}</div>
        <div class="ag-ev-meta">
          <span class="ag-ev-tipo">${t.label}</span>
          ${ev.repetir && ev.repetir !== 'nunca' ? `<span class="ag-ev-rep" title="${repetirInfo(ev.repetir).label}"><i class="fa-solid fa-repeat"></i>${repetirTexto(ev)}</span>` : ''}
          ${conFecha ? `<span class="ag-ev-dot">·</span><span>${fechaCorta(deKey(ev.fecha))}</span>` : ''}
        </div>
      </div>
      <div class="ag-ev-right">
        ${nImg ? `<span class="ag-ev-img"><i class="fa-regular fa-image"></i>${nImg}</span>` : ''}
        ${ev.tipo === 'tarea' ? `<button class="ag-ev-check${ev.hecho ? ' on' : ''}" data-check="${ev.id}" aria-label="Marcar hecha"><i class="fa-solid fa-check"></i></button>` : ''}
      </div>
    </div>
  </div>`;
}

function bindEventos(root) {
  root.querySelectorAll('.ag-ev').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-check]')) return;
      openDetalle(el.dataset.id);
    });
  });
  root.querySelectorAll('[data-check]').forEach(b => {
    b.addEventListener('click', async e => {
      e.stopPropagation();
      const ev = eventos.find(x => x.id === b.dataset.check);
      if (!ev) return;
      await updateDoc(doc(db, 'agenda', ev.id), { hecho: !ev.hecho });
      toast(ev.hecho ? 'Tarea pendiente' : 'Tarea completada');
    });
  });
}

const vacioHTML = () => `
  <div class="ag-empty glass">
    <span class="ag-empty-ico"><i class="fa-regular fa-calendar-check"></i></span>
    <p>Sin eventos</p>
    <span>Tu día está libre</span>
  </div>`;

// Encabezado de día: nombre y número grandes + mes/año + resumen
function cabeceraDiaHTML(d) {
  const evs = eventosDe(d);
  const esHoy = mismoDia(d, hoy());
  const resumen = evs.length ? `${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}` : 'libre';
  return `
  <div class="ag-day-head">
    <div class="ag-day-head-main">
      <span class="ag-day-head-name">${DIAS[diaSemana(d)]}${esHoy ? '<em>hoy</em>' : ''}</span>
      <span class="ag-day-head-date">${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} · ${d.getFullYear()}</span>
    </div>
    <span class="ag-day-head-count">${resumen}</span>
  </div>`;
}

// ── Vista DÍA ───────────────────────────────────────────────
function renderDia() {
  const evs = eventosDe(fechaSel);
  vistaEl.innerHTML = `
    ${cabeceraDiaHTML(fechaSel)}
    <div class="ag-list">${evs.length ? evs.map(e => evHTML(e)).join('') : vacioHTML()}</div>`;
  bindEventos(vistaEl);
}

// ── Vista SEMANA ────────────────────────────────────────────
// Tira con los 7 días; al tocar uno se selecciona (sin cambiar de vista)
// y abajo se muestra la agenda de ese día.
function renderSemana() {
  const l = lunesDe(fechaSel);
  const h = hoy();
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(l, i));

  const strip = dias.map(d => {
    const evs = eventosDe(d);
    const dots = evs.slice(0, 3).map(e => `<i style="background:${tipoInfo(e.tipo).color}"></i>`).join('');
    return `
      <button class="ag-chip${mismoDia(d, fechaSel) ? ' selected' : ''}${mismoDia(d, h) ? ' today' : ''}" data-key="${key(d)}">
        <span class="ag-chip-d">${DIAS_LETRA[diaSemana(d)]}</span>
        <span class="ag-chip-n">${d.getDate()}</span>
        <span class="ag-chip-dots">${dots}</span>
      </button>`;
  }).join('');

  const evs = eventosDe(fechaSel);
  vistaEl.innerHTML = `
    <div class="ag-strip">${strip}</div>
    ${cabeceraDiaHTML(fechaSel)}
    <div class="ag-list">${evs.length ? evs.map(e => evHTML(e)).join('') : vacioHTML()}</div>`;

  vistaEl.querySelectorAll('.ag-chip').forEach(c => c.addEventListener('click', () => {
    fechaSel = deKey(c.dataset.key); render();
  }));
  bindEventos(vistaEl);
}

// ── Vista MES ───────────────────────────────────────────────
function renderMes() {
  const y = fechaSel.getFullYear(), m = fechaSel.getMonth();
  const h = hoy();
  const primero = new Date(y, m, 1);
  const offset = diaSemana(primero);
  const nDias = new Date(y, m + 1, 0).getDate();
  const nPrev = new Date(y, m, 0).getDate();

  let cells = '';
  for (let i = offset - 1; i >= 0; i--) cells += `<span class="ag-cell other"><span class="ag-cell-num">${nPrev - i}</span></span>`;
  for (let d = 1; d <= nDias; d++) {
    const f = new Date(y, m, d);
    const evs = eventosDe(f);
    const dots = evs.slice(0, 3).map(e => `<i style="background:${tipoInfo(e.tipo).color}"></i>`).join('');
    cells += `
      <button class="ag-cell${mismoDia(f, h) ? ' today' : ''}${mismoDia(f, fechaSel) ? ' selected' : ''}${evs.length ? ' has' : ''}" data-key="${key(f)}">
        <span class="ag-cell-num">${d}</span>
        <span class="ag-cell-dots">${dots}</span>
        ${evs.length > 3 ? `<span class="ag-cell-more">+${evs.length - 3}</span>` : ''}
      </button>`;
  }
  const resto = (7 - ((offset + nDias) % 7)) % 7;
  for (let i = 1; i <= resto; i++) cells += `<span class="ag-cell other"><span class="ag-cell-num">${i}</span></span>`;

  const evs = eventosDe(fechaSel);
  vistaEl.innerHTML = `
    <div class="ag-month glass">
      <div class="ag-weekdays">${DIAS_LETRA.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="ag-grid">${cells}</div>
      <div class="ag-legend">${TIPOS.map(t => `<span><i style="background:${t.color}"></i>${t.label}</span>`).join('')}</div>
    </div>
    ${cabeceraDiaHTML(fechaSel)}
    <div class="ag-list">${evs.length ? evs.map(e => evHTML(e)).join('') : vacioHTML()}</div>`;

  vistaEl.querySelectorAll('.ag-cell[data-key]').forEach(c => c.addEventListener('click', () => {
    const f = deKey(c.dataset.key);
    if (mismoDia(f, fechaSel)) { vista = 'dia'; }
    fechaSel = f; render();
  }));
  bindEventos(vistaEl);
}

// ── Navegación ──────────────────────────────────────────────
document.querySelectorAll('.ag-tab').forEach(t => t.addEventListener('click', () => { vista = t.dataset.vista; render(); }));
$('agPrev').addEventListener('click', () => mover(-1));
$('agNext').addEventListener('click', () => mover(1));
$('agHoy').addEventListener('click', () => { fechaSel = hoy(); render(); });

function mover(dir) {
  if (vista === 'dia') fechaSel = sumarDias(fechaSel, dir);
  else if (vista === 'semana') fechaSel = sumarDias(fechaSel, 7 * dir);
  else fechaSel = new Date(fechaSel.getFullYear(), fechaSel.getMonth() + dir, Math.min(fechaSel.getDate(), 28));
  render();
}

// ── Detalle ─────────────────────────────────────────────────
function openDetalle(id) {
  const ev = eventos.find(e => e.id === id);
  if (!ev || document.getElementById('modalAgDetalle')) return;
  const t = tipoInfo(ev.tipo);
  const imgs = ev.imagenes || [];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAgDetalle';
  overlay.innerHTML = `
  <div class="modal-sheet glass mov-detail-sheet ag-detail-sheet" role="dialog" aria-modal="true" style="--accent:${t.color};--cat-color:${t.color}">
    <div class="modal-handle"></div>
    <div class="mov-detail-head">
      <div class="mov-detail-icon"><i class="${t.icon}"></i></div>
      <span class="ag-detail-tipo">${t.label}${ev.tipo === 'tarea' ? (ev.hecho ? ' · completada' : ' · pendiente') : ''}</span>
      ${ev.importancia && ev.importancia !== 'normal' ? `<span class="ag-detail-imp" style="--i:${importanciaInfo(ev.importancia).color}"><i class="${importanciaInfo(ev.importancia).icon}"></i> Importancia ${importanciaInfo(ev.importancia).label.toLowerCase()}</span>` : ''}
      <h2 class="ag-detail-title">${esc(ev.titulo)}</h2>
    </div>
    <div class="mov-detail-rows">
      <div class="mov-detail-row"><span class="mov-detail-k"><i class="fa-regular fa-calendar"></i> Fecha</span><span class="mov-detail-v">${esc(fechaLarga(deKey(ev.fecha)))}</span></div>
      <div class="mov-detail-row"><span class="mov-detail-k"><i class="fa-regular fa-clock"></i> Hora</span><span class="mov-detail-v">${rangoHora(ev)}</span></div>
      ${ev.repetir && ev.repetir !== 'nunca' ? `<div class="mov-detail-row"><span class="mov-detail-k"><i class="fa-solid fa-repeat"></i> Repite</span><span class="mov-detail-v">${ev.repetir === 'dias' ? repetirTexto(ev) : repetirInfo(ev.repetir).label}${ev.repetirHasta ? ` · hasta ${fechaCorta(deKey(ev.repetirHasta))}` : ''}</span></div>` : ''}
    </div>
    ${imgs.length ? `
      <p class="mov-detail-label">Imágenes</p>
      <div class="mov-detail-gallery">
        ${imgs.map((src, i) => `<button class="mov-detail-thumb" data-i="${i}"><img src="${src}" alt="imagen ${i + 1}" /><span class="mov-detail-thumb-zoom"><i class="fa-solid fa-magnifying-glass-plus"></i></span></button>`).join('')}
      </div>` : ''}
    <div class="options-btns">
      <button class="options-btn" id="agEditar"><i class="fa-solid fa-pen"></i><span>Editar</span></button>
      ${ev.tipo === 'tarea' ? `<button class="options-btn" id="agHecho"><i class="fa-solid ${ev.hecho ? 'fa-rotate-left' : 'fa-check'}"></i><span>${ev.hecho ? 'Pendiente' : 'Hecha'}</span></button>` : ''}
      <button class="options-btn danger" id="agEliminar"><i class="fa-solid fa-trash-can"></i><span>Eliminar</span></button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });

  const close = () => { overlay.classList.add('closing'); overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 320); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('.mov-detail-thumb').forEach(b => b.addEventListener('click', () => openVisor(imgs, parseInt(b.dataset.i))));
  overlay.querySelector('#agEditar').addEventListener('click', () => { close(); setTimeout(() => openForm(ev.id), 320); });
  overlay.querySelector('#agHecho')?.addEventListener('click', async () => {
    await updateDoc(doc(db, 'agenda', ev.id), { hecho: !ev.hecho }); close(); toast(ev.hecho ? 'Tarea pendiente' : 'Tarea completada');
  });
  overlay.querySelector('#agEliminar').addEventListener('click', () => { close(); setTimeout(() => confirmarEliminar(ev), 320); });
}

function confirmarEliminar(ev) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAgConfirm';
  overlay.innerHTML = `
  <div class="modal-sheet glass confirm-sheet" role="alertdialog" aria-modal="true">
    <div class="modal-handle"></div>
    <div class="confirm-icon"><i class="fa-solid fa-trash-can"></i></div>
    <h2 class="confirm-title">Eliminar evento</h2>
    <p class="confirm-desc">¿Seguro que quieres eliminar <strong>${esc(ev.titulo)}</strong>?${ev.repetir && ev.repetir !== 'nunca' ? ' Se eliminarán todas sus repeticiones.' : ''} Esta acción no se puede deshacer.</p>
    <div class="confirm-btns">
      <button class="options-btn" id="agNo">Cancelar</button>
      <button class="options-btn danger" id="agSi"><i class="fa-solid fa-trash-can"></i><span>Eliminar</span></button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });
  const close = () => { overlay.classList.add('closing'); overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 320); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#agNo').addEventListener('click', close);
  overlay.querySelector('#agSi').addEventListener('click', async () => {
    close(); await deleteDoc(doc(db, 'agenda', ev.id)); toast('Evento eliminado');
  });
}

// ── Aviso de horario ocupado ────────────────────────────────
function avisarConflicto(ev, onForzar) {
  if (document.getElementById('modalAgChoque')) return;
  const t = tipoInfo(ev.tipo);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAgChoque';
  overlay.innerHTML = `
  <div class="modal-sheet glass confirm-sheet" role="alertdialog" aria-modal="true" style="--accent:${ACCENT}">
    <div class="modal-handle"></div>
    <div class="confirm-icon ag-choque-icon"><i class="fa-regular fa-clock"></i></div>
    <h2 class="confirm-title">Horario ocupado</h2>
    <p class="confirm-desc">Ya tienes <strong>${esc(ev.titulo)}</strong> (${t.label.toLowerCase()}) de <strong>${rangoHora(ev)}</strong> ese día. Elige otra hora para no cruzar los eventos.</p>
    <div class="confirm-btns">
      <button class="options-btn" id="chForzar"><i class="fa-solid fa-layer-group"></i><span>Agendar igual</span></button>
      <button class="options-btn ag-choque-ok" id="chOk"><i class="fa-solid fa-clock-rotate-left"></i><span>Cambiar hora</span></button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });
  const close = () => { overlay.classList.add('closing'); overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 320); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#chOk').addEventListener('click', close);
  overlay.querySelector('#chForzar').addEventListener('click', () => { close(); onForzar(); });
}

// ── Formulario crear / editar ───────────────────────────────
function openForm(editId = null) {
  if (document.getElementById('modalAgForm')) return;
  const editing = editId ? eventos.find(e => e.id === editId) : null;

  let tipo     = editing ? editing.tipo : 'reunion';
  let fecha    = editing ? deKey(editing.fecha) : new Date(fechaSel);
  let imagenes = editing ? [...(editing.imagenes || [])] : [];
  let repetir  = editing?.repetir || 'nunca';
  let repetirHasta = editing?.repetirHasta ? deKey(editing.repetirHasta) : null;
  let repetirDias  = editing?.repetirDias ? [...editing.repetirDias] : [diaSemana(fecha)];
  let importancia  = editing?.importancia || 'normal';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAgForm';
  overlay.innerHTML = `
  <div class="modal-sheet glass modal-cuenta-sheet mov-form-sheet ag-form-sheet" role="dialog" aria-modal="true" style="--accent:${ACCENT}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">Agenda</p>
    <h2 class="modal-title">${editing ? 'Editar evento' : 'Nuevo evento'}</h2>
    <div class="form-scroll">

      <div class="form-group">
        <label class="form-label">Título</label>
        <input class="form-input" id="agTitulo" type="text" maxlength="80" placeholder="Ej. Reunión con cliente" value="${editing ? esc(editing.titulo) : ''}" />
      </div>

      <div class="form-group">
        <label class="form-label">Tipo</label>
        <button type="button" class="cat-select-btn" id="agTipoBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Importancia</label>
        <button type="button" class="cat-select-btn" id="agImpBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Fecha</label>
        <button type="button" class="cat-select-btn" id="agFechaBtn"></button>
      </div>

      <div class="form-group">
        <label class="form-label">Repetir</label>
        <button type="button" class="cat-select-btn" id="agRepetirBtn"></button>
        <div class="ag-dias" id="agDiasWrap" hidden>
          ${DIAS_LETRA.map((l, i) => `<button type="button" class="ag-dia-btn" data-i="${i}" aria-label="${DIAS[i]}">${l}</button>`).join('')}
        </div>
        <div class="ag-hasta" id="agHastaWrap" hidden>
          <button type="button" class="cat-select-btn" id="agHastaBtn"></button>
          <button type="button" class="ag-hasta-x" id="agHastaX" aria-label="Quitar fecha final" hidden><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>

      <div class="form-group">
        <div class="switch-row">
          <div class="switch-row-text">
            <span class="switch-row-title">Todo el día</span>
            <span class="switch-row-desc">Sin hora específica</span>
          </div>
          <label class="switch"><input type="checkbox" id="agTodoDia" ${editing?.todoDia ? 'checked' : ''} /><span class="switch-slider"></span></label>
        </div>
      </div>

      <div class="form-group ag-time-row" id="agTimeRow" ${editing?.todoDia ? 'hidden' : ''}>
        <div>
          <label class="form-label">Hora de inicio</label>
          <button type="button" class="cat-select-btn ag-hora-btn" id="agInicioBtn"></button>
        </div>
        <div>
          <label class="form-label">Hora de fin <span class="form-label-opt">(opcional)</span></label>
          <button type="button" class="cat-select-btn ag-hora-btn" id="agFinBtn"></button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Imágenes <span class="form-label-opt">(opcional · máx. ${MAX_IMAGENES})</span></label>
        <button class="foto-ia-btn" id="agFotoBtn" type="button">
          <span class="foto-ia-icon"><i class="fa-solid fa-camera"></i></span>
          <span class="foto-ia-text">
            <span class="foto-ia-title">Agregar imagen</span>
            <span class="foto-ia-desc">Toma una foto o súbela desde la galería</span>
          </span>
          <i class="fa-solid fa-chevron-right foto-ia-magic"></i>
        </button>
        <div class="foto-gallery" id="agGallery" hidden></div>
      </div>

      ${editing ? `<button class="btn-eliminar-cuenta" id="agBorrar" type="button"><i class="fa-solid fa-trash-can"></i> Eliminar evento</button>` : ''}
    </div>
    <div class="modal-actions">
      <button class="modal-cancel" id="agCancel">Cancelar</button>
      <button class="btn-primary" id="agGuardar">${editing ? 'Guardar cambios' : 'Agendar'}</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });

  const close = () => { overlay.classList.add('closing'); overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 320); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#agCancel').addEventListener('click', close);

  // Tipo
  initOpcionPicker({
    btn: overlay.querySelector('#agTipoBtn'),
    opciones: TIPOS.map(t => ({ id: t.id, label: t.label, icon: t.icon })),
    selected: tipo, accent: ACCENT,
    eyebrow: 'Tipo', titulo: 'Tipo de evento', placeholder: 'Elegir tipo',
    onSelect: id => { tipo = id; },
  });

  // Importancia
  initOpcionPicker({
    btn: overlay.querySelector('#agImpBtn'),
    opciones: IMPORTANCIA.map(i => ({ id: i.id, label: i.label, icon: i.icon })),
    selected: importancia, accent: ACCENT,
    eyebrow: 'Importancia', titulo: 'Nivel de importancia', placeholder: 'Normal',
    onSelect: id => { importancia = id; },
  });

  // Fecha
  const fechaBtn = overlay.querySelector('#agFechaBtn');
  const pintarFecha = () => {
    fechaBtn.innerHTML = `
      <span class="cat-select-icon" style="background:${ACCENT}22;color:${ACCENT};border-color:${ACCENT}45"><i class="fa-regular fa-calendar"></i></span>
      <span class="cat-select-name">${esc(fechaLarga(fecha))}</span>
      <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
  };
  pintarFecha();
  fechaBtn.addEventListener('click', () => pickFecha(fecha, f => { fecha = f; pintarFecha(); }));

  // Repetición
  const hastaWrap = overlay.querySelector('#agHastaWrap');
  const hastaBtn  = overlay.querySelector('#agHastaBtn');
  const hastaX    = overlay.querySelector('#agHastaX');
  const diasWrap = overlay.querySelector('#agDiasWrap');
  const pintarDias = () => {
    diasWrap.hidden = repetir !== 'dias';
    diasWrap.querySelectorAll('.ag-dia-btn').forEach(b => b.classList.toggle('on', repetirDias.includes(parseInt(b.dataset.i))));
  };
  diasWrap.querySelectorAll('.ag-dia-btn').forEach(b => b.addEventListener('click', () => {
    const i = parseInt(b.dataset.i);
    repetirDias = repetirDias.includes(i) ? repetirDias.filter(x => x !== i) : [...repetirDias, i];
    diasWrap.classList.remove('grid-error');
    pintarDias();
  }));
  const pintarHasta = () => {
    pintarDias();
    hastaWrap.hidden = repetir === 'nunca';
    hastaX.hidden = !repetirHasta;
    hastaBtn.innerHTML = repetirHasta
      ? `<span class="cat-select-icon" style="background:${ACCENT}22;color:${ACCENT};border-color:${ACCENT}45"><i class="fa-solid fa-flag-checkered"></i></span>
         <span class="cat-select-name">Hasta el ${esc(fechaCorta(repetirHasta))}</span>
         <i class="fa-solid fa-chevron-down cat-select-chev"></i>`
      : `<span class="cat-select-icon"><i class="fa-solid fa-infinity"></i></span>
         <span class="cat-select-name muted">Sin fecha final</span>
         <i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
  };
  initOpcionPicker({
    btn: overlay.querySelector('#agRepetirBtn'),
    opciones: REPETIR.map(r => ({ id: r.id, label: r.label, icon: r.icon })),
    selected: repetir, accent: ACCENT,
    eyebrow: 'Repetir', titulo: '¿Cada cuánto se repite?', placeholder: 'No se repite',
    onSelect: id => { repetir = id; pintarHasta(); },
  });
  hastaBtn.addEventListener('click', () => pickFecha(repetirHasta || sumarDias(fecha, 30), f => { repetirHasta = f; pintarHasta(); }));
  hastaX.addEventListener('click', () => { repetirHasta = null; pintarHasta(); });
  pintarHasta();

  // Todo el día
  const todoDia = overlay.querySelector('#agTodoDia');
  const timeRow = overlay.querySelector('#agTimeRow');
  todoDia.addEventListener('change', () => { timeRow.hidden = todoDia.checked; });

  // Horas (botones + ventana propia)
  let horaInicio = editing?.horaInicio || '';
  let horaFin    = editing?.horaFin || '';
  const inicioBtn = overlay.querySelector('#agInicioBtn');
  const finBtn    = overlay.querySelector('#agFinBtn');
  const pintarHoras = () => {
    inicioBtn.innerHTML = horaInicio
      ? `<span class="ag-hora-ico"><i class="fa-regular fa-clock"></i></span><span class="ag-hora-val">${hora12(horaInicio)}</span><i class="fa-solid fa-chevron-down cat-select-chev"></i>`
      : `<span class="ag-hora-ico muted"><i class="fa-regular fa-clock"></i></span><span class="ag-hora-val muted">Elegir</span><i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
    inicioBtn.classList.toggle('empty', !horaInicio);
    finBtn.innerHTML = horaFin
      ? `<span class="ag-hora-ico"><i class="fa-solid fa-flag-checkered"></i></span><span class="ag-hora-val">${hora12(horaFin)}</span><i class="fa-solid fa-chevron-down cat-select-chev"></i>`
      : `<span class="ag-hora-ico muted"><i class="fa-solid fa-flag-checkered"></i></span><span class="ag-hora-val muted">Sin fin</span><i class="fa-solid fa-chevron-down cat-select-chev"></i>`;
    finBtn.classList.toggle('empty', !horaFin);
  };
  pintarHoras();
  inicioBtn.addEventListener('click', () => pickHora(horaInicio || '09:00', {
    titulo: 'Hora de inicio',
    onPick: h => { horaInicio = h; inicioBtn.classList.remove('input-error'); if (horaFin && horaFin <= horaInicio) horaFin = ''; pintarHoras(); },
  }));
  finBtn.addEventListener('click', () => pickHora(horaFin || sumarHora(horaInicio || '09:00', 60), {
    titulo: 'Hora de fin', opcional: true, minimo: horaInicio,
    onPick: h => { horaFin = h; pintarHoras(); },
    onClear: () => { horaFin = ''; pintarHoras(); },
  }));

  // Imágenes
  const gallery = overlay.querySelector('#agGallery');
  const fotoBtn = overlay.querySelector('#agFotoBtn');
  function renderGallery() {
    if (!imagenes.length) { gallery.hidden = true; gallery.innerHTML = ''; fotoBtn.hidden = false; return; }
    gallery.hidden = false;
    fotoBtn.hidden = true;
    gallery.innerHTML = imagenes.map((src, i) => `
      <div class="foto-thumb">
        <img src="${src}" alt="imagen ${i + 1}" />
        <button class="foto-thumb-x" type="button" data-i="${i}" aria-label="Quitar"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join('') +
      (imagenes.length < MAX_IMAGENES ? `<button class="foto-thumb-add" type="button" id="agAddMore" aria-label="Agregar otra"><i class="fa-solid fa-plus"></i></button>` : '');
    gallery.querySelectorAll('.foto-thumb-x').forEach(b => b.addEventListener('click', () => {
      confirmarQuitarFoto(() => { imagenes.splice(parseInt(b.dataset.i), 1); renderGallery(); });
    }));
    gallery.querySelector('#agAddMore')?.addEventListener('click', abrirCaptura);
  }
  function abrirCaptura() {
    if (imagenes.length >= MAX_IMAGENES) { toast(`Máximo ${MAX_IMAGENES} imágenes`); return; }
    openCapturaModal(ACCENT, async (dataUrl) => {
      imagenes.push(await reducirDataUrl(dataUrl));
      renderGallery();
    }, { permitirIA: false, eyebrow: 'Imagen', icono: 'fa-solid fa-image', titulo: 'Agregar imagen', subtitulo: 'Toma una foto o elige una de tu galería.' });
  }
  fotoBtn.addEventListener('click', abrirCaptura);
  renderGallery();

  // Eliminar desde el form
  overlay.querySelector('#agBorrar')?.addEventListener('click', () => { close(); setTimeout(() => confirmarEliminar(editing), 320); });

  // Guardar
  overlay.querySelector('#agGuardar').addEventListener('click', async () => {
    const tituloEl = overlay.querySelector('#agTitulo');
    const titulo = tituloEl.value.trim();
    if (!titulo) { tituloEl.focus(); tituloEl.classList.add('input-error'); return; }
    if (repetir === 'dias' && !repetirDias.length) {
      diasWrap.classList.add('grid-error');
      diasWrap.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('Elige al menos un día de la semana');
      return;
    }
    if (!todoDia.checked && !horaInicio) {
      inicioBtn.classList.add('input-error');
      inicioBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast('Elige la hora de inicio o marca "Todo el día"');
      return;
    }

    const data = {
      titulo,
      tipo,
      fecha: key(fecha),
      todoDia: todoDia.checked,
      horaInicio: todoDia.checked ? '' : horaInicio,
      horaFin:    todoDia.checked ? '' : horaFin,
      imagenes,
      repetir,
      repetirHasta: repetir !== 'nunca' && repetirHasta ? key(repetirHasta) : '',
      repetirDias: repetir === 'dias' ? repetirDias.slice().sort((a, b) => a - b) : [],
      importancia,
      hecho: editing ? !!editing.hecho : false,
      creado: editing ? (editing.creado || Date.now()) : Date.now(),
    };
    if (JSON.stringify(data).length > MAX_BYTES_DOC) { toast('Las imágenes pesan demasiado, quita alguna'); return; }

    const choque = conflictoDe(data, editing?.id || null);
    if (choque && !overlay.dataset.forzar) {
      avisarConflicto(choque, () => { overlay.dataset.forzar = '1'; overlay.querySelector('#agGuardar').click(); });
      return;
    }

    const btn = overlay.querySelector('#agGuardar');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      if (editing) await updateDoc(doc(db, 'agenda', editing.id), data);
      else await addDoc(COL, data);
      fechaSel = new Date(fecha);
      close();
      toast(editing ? 'Evento actualizado' : 'Evento agendado');
    } catch (e) {
      console.error(e);
      btn.disabled = false; btn.textContent = editing ? 'Guardar cambios' : 'Agendar';
      toast('No se pudo guardar');
    }
  });

  setTimeout(() => overlay.querySelector('#agTitulo').focus(), 350);
}

// ── Selector de fecha (calendario) ──────────────────────────
function pickFecha(inicial, onPick) {
  if (document.getElementById('modalAgCal')) return;
  const h = hoy();
  let sel = new Date(inicial);
  let y = sel.getFullYear(), m = sel.getMonth();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAgCal';
  overlay.innerHTML = `
  <div class="modal-sheet glass cal-sheet" role="dialog" aria-modal="true" style="--accent:${ACCENT}">
    <div class="modal-handle"></div>
    <div class="cal-head">
      <div>
        <p class="modal-eyebrow">Fecha</p>
        <h2 class="cal-title" id="agCalTitle"></h2>
      </div>
      <button class="ag-hoy" id="agCalHoy" type="button">Hoy</button>
    </div>
    <div class="cal-nav">
      <button class="cal-nav-btn" id="agCalPrev" aria-label="Mes anterior"><i class="fa-solid fa-chevron-left"></i></button>
      <span class="cal-month" id="agCalMonth"></span>
      <button class="cal-nav-btn" id="agCalNext" aria-label="Mes siguiente"><i class="fa-solid fa-chevron-right"></i></button>
    </div>
    <div class="cal-weekdays">${DIAS_LETRA.map(d => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid" id="agCalGrid"></div>
    <div class="ag-quick" id="agCalQuick">
      <button type="button" data-d="0"><i class="fa-solid fa-sun"></i> Hoy</button>
      <button type="button" data-d="1"><i class="fa-solid fa-arrow-right"></i> Mañana</button>
      <button type="button" data-d="7"><i class="fa-solid fa-forward"></i> En 1 semana</button>
    </div>
    <div class="modal-actions cal-actions">
      <button class="modal-cancel" id="agCalCancel">Cancelar</button>
      <button class="btn-primary" id="agCalOk">Confirmar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const grid = overlay.querySelector('#agCalGrid');
  const month = overlay.querySelector('#agCalMonth');
  const title = overlay.querySelector('#agCalTitle');

  function render() {
    month.textContent = `${MESES[m]} ${y}`;
    title.textContent = fechaCorta(sel);
    const offset = diaSemana(new Date(y, m, 1));
    const n = new Date(y, m + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < offset; i++) html += '<span class="cal-day empty"></span>';
    for (let d = 1; d <= n; d++) {
      const f = new Date(y, m, d);
      const tiene = eventosDe(f).length > 0;
      html += `<button class="cal-day${mismoDia(f, sel) ? ' selected' : ''}${mismoDia(f, h) ? ' today' : ''}${tiene ? ' has' : ''}" data-d="${d}">${d}</button>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll('.cal-day:not(.empty)').forEach(b => b.addEventListener('click', () => { sel = new Date(y, m, parseInt(b.dataset.d)); render(); }));
  }
  overlay.querySelector('#agCalPrev').addEventListener('click', () => { m--; if (m < 0) { m = 11; y--; } render(); });
  overlay.querySelector('#agCalNext').addEventListener('click', () => { m++; if (m > 11) { m = 0; y++; } render(); });
  overlay.querySelector('#agCalHoy').addEventListener('click', () => { sel = hoy(); y = sel.getFullYear(); m = sel.getMonth(); render(); });
  overlay.querySelectorAll('#agCalQuick button').forEach(b => b.addEventListener('click', () => {
    sel = sumarDias(hoy(), parseInt(b.dataset.d)); y = sel.getFullYear(); m = sel.getMonth(); render();
  }));

  const close = () => { overlay.classList.add('closing'); overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 320); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#agCalCancel').addEventListener('click', close);
  overlay.querySelector('#agCalOk').addEventListener('click', () => { onPick(sel); close(); });

  render();
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });
}

// ── Selector de hora ────────────────────────────────────────
function sumarHora(h, min) {
  const [H, M] = h.split(':').map(Number);
  const t = Math.min(23 * 60 + 55, H * 60 + M + min);
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

function pickHora(inicial, { titulo = 'Hora', opcional = false, minimo = '', onPick, onClear } = {}) {
  if (document.getElementById('modalAgHora')) return;
  let [H, M] = (inicial || '09:00').split(':').map(Number);
  M = Math.round(M / 5) * 5; if (M === 60) { M = 0; H = (H + 1) % 24; }
  let pm = H >= 12;
  let h12 = H % 12 === 0 ? 12 : H % 12;
  const HORAS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const MINS  = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalAgHora';
  overlay.innerHTML = `
  <div class="modal-sheet glass hora-sheet" role="dialog" aria-modal="true" style="--accent:${ACCENT}">
    <div class="modal-handle"></div>
    <p class="modal-eyebrow">Hora</p>
    <h2 class="modal-title">${titulo}</h2>

    <div class="hora-display">
      <span class="hora-big" id="horaBig">--:--</span>
      <div class="hora-ampm" id="horaAmPm">
        <button type="button" data-pm="0">AM</button>
        <button type="button" data-pm="1">PM</button>
      </div>
    </div>

    <p class="hora-label">Hora</p>
    <div class="hora-grid" id="horaHoras">${HORAS.map(h => `<button type="button" data-h="${h}">${h}</button>`).join('')}</div>
    <p class="hora-label">Minutos</p>
    <div class="hora-grid" id="horaMins">${MINS.map(m => `<button type="button" data-m="${m}">:${pad(m)}</button>`).join('')}</div>
    <p class="hora-hint" id="horaHint"></p>

    <div class="modal-actions">
      <button class="modal-cancel" id="horaCancel">Cancelar</button>
      ${opcional ? `<button class="modal-cancel hora-clear" id="horaClear"><i class="fa-solid fa-xmark"></i> Sin hora de fin</button>` : ''}
      <button class="btn-primary" id="horaOk"><i class="fa-solid fa-check"></i> Confirmar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const big = overlay.querySelector('#horaBig');
  const hint = overlay.querySelector('#horaHint');
  const valor = () => `${pad(pm ? (h12 % 12) + 12 : h12 % 12)}:${pad(M)}`;

  function render() {
    big.textContent = `${h12}:${pad(M)}`;
    overlay.querySelectorAll('#horaAmPm button').forEach(b => b.classList.toggle('active', (b.dataset.pm === '1') === pm));
    overlay.querySelectorAll('#horaHoras button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.h) === h12));
    overlay.querySelectorAll('#horaMins button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.m) === M));
    const v = valor();
    if (minimo && v <= minimo) { hint.textContent = `Debe ser después de ${hora12(minimo)}`; hint.classList.add('error'); }
    else { hint.textContent = hora12(v); hint.classList.remove('error'); }
  }
  overlay.querySelectorAll('#horaAmPm button').forEach(b => b.addEventListener('click', () => { pm = b.dataset.pm === '1'; render(); }));
  overlay.querySelectorAll('#horaHoras button').forEach(b => b.addEventListener('click', () => { h12 = parseInt(b.dataset.h); render(); }));
  overlay.querySelectorAll('#horaMins button').forEach(b => b.addEventListener('click', () => { M = parseInt(b.dataset.m); render(); }));

  const close = () => { overlay.classList.add('closing'); overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 320); };
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#horaCancel').addEventListener('click', close);
  overlay.querySelector('#horaClear')?.addEventListener('click', () => { onClear?.(); close(); });
  overlay.querySelector('#horaOk').addEventListener('click', () => {
    const v = valor();
    if (minimo && v <= minimo) { hint.classList.add('shake'); setTimeout(() => hint.classList.remove('shake'), 400); return; }
    onPick(v); close();
  });

  render();
  requestAnimationFrame(() => { overlay.setAttribute('aria-hidden', 'false'); overlay.classList.add('active'); });
}

// ── Visor de imágenes ───────────────────────────────────────
function openVisor(imagenes, indice = 0) {
  let idx = indice;
  const overlay = document.createElement('div');
  overlay.className = 'visor-overlay';
  overlay.innerHTML = `
    <div class="visor-topbar">
      <span class="visor-count"></span>
      <div class="visor-actions">
        <a class="visor-btn" id="vDescargar" download title="Descargar"><i class="fa-solid fa-download"></i></a>
        <button class="visor-btn" id="vCerrar" title="Cerrar"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </div>
    <div class="visor-stage" id="vStage"><img class="visor-img" id="vImg" src="" alt="imagen" /></div>
    ${imagenes.length > 1 ? `
      <button class="visor-nav visor-prev" id="vPrev"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="visor-nav visor-next" id="vNext"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
    <p class="visor-hint">Toca la imagen para acercar · doble toque para restablecer</p>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));

  const img = overlay.querySelector('#vImg'), stage = overlay.querySelector('#vStage');
  const count = overlay.querySelector('.visor-count'), desc = overlay.querySelector('#vDescargar');
  let zoom = 1;
  const mostrar = () => {
    zoom = 1; img.style.transform = 'scale(1)';
    img.src = imagenes[idx]; desc.href = imagenes[idx]; desc.setAttribute('download', `agenda-${idx + 1}.jpg`);
    count.textContent = imagenes.length > 1 ? `${idx + 1} / ${imagenes.length}` : '';
  };
  mostrar();
  img.addEventListener('click', e => { e.stopPropagation(); zoom = zoom > 1 ? 1 : 2.4; img.style.transform = `scale(${zoom})`; });
  img.addEventListener('dblclick', e => { e.stopPropagation(); zoom = 1; img.style.transform = 'scale(1)'; });
  overlay.querySelector('#vPrev')?.addEventListener('click', e => { e.stopPropagation(); idx = (idx - 1 + imagenes.length) % imagenes.length; mostrar(); });
  overlay.querySelector('#vNext')?.addEventListener('click', e => { e.stopPropagation(); idx = (idx + 1) % imagenes.length; mostrar(); });
  const cerrar = () => { overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 260); };
  overlay.querySelector('#vCerrar').addEventListener('click', cerrar);
  stage.addEventListener('click', e => { if (e.target === stage) cerrar(); });
}

// ── Utilidades ──────────────────────────────────────────────
function reducirDataUrl(dataUrl, maxLado = 1000, calidad = 0.65) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxLado && height <= maxLado && dataUrl.length < 200_000) return resolve(dataUrl);
      if (width > height && width > maxLado) { height = height * maxLado / width; width = maxLado; }
      else if (height > maxLado) { width = width * maxLado / height; height = maxLado; }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

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

// ── Init ────────────────────────────────────────────────────
window.abrirNuevoEvento = () => openForm();

// Enlaces profundos: ?vista=mes|semana|dia  ·  ?nueva=1 abre el formulario
const qp = new URLSearchParams(location.search);
if (VISTAS.includes(qp.get('vista'))) vista = qp.get('vista');
if (qp.get('nueva') === '1') {
  history.replaceState(null, '', location.pathname);
  setTimeout(() => openForm(), 300);
}
render();
