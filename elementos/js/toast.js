// ── NOTIFICACIONES ──────────────────────────────────────────
// Sistema compartido de avisos. Muestra una tarjeta discreta que
// baja desde arriba, con icono e intención (éxito / error / info).
//
// Uso:
//   import { notify } from "./toast.js";
//   notify('Gasto registrado');                 // éxito por defecto
//   notify('No se pudo subir', 'error');
//   notify('Analizando…', 'info');

const ICONOS = {
  success: 'fa-solid fa-circle-check',
  error:   'fa-solid fa-circle-exclamation',
  info:    'fa-solid fa-circle-info',
};

const TITULOS = {
  success: 'Listo',
  error:   'Ups',
  info:    'Info',
};

// Detecta la intención por palabras clave si no se especifica el tipo.
function inferirTipo(msg) {
  const m = String(msg).toLowerCase();
  if (/no se pudo|no se pudieron|error|falló|fallo|no permite|primero crea/.test(m)) return 'error';
  return 'success';
}

function contenedor() {
  let c = document.getElementById('notifStack');
  if (!c) {
    c = document.createElement('div');
    c.id = 'notifStack';
    c.className = 'notif-stack';
    document.body.appendChild(c);
  }
  return c;
}

export function notify(msg, tipo) {
  const t = tipo || inferirTipo(msg);
  const cont = contenedor();

  const el = document.createElement('div');
  el.className = `notif notif-${t}`;
  el.setAttribute('role', t === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <span class="notif-icon"><i class="${ICONOS[t] || ICONOS.info}"></i></span>
    <div class="notif-body">
      <span class="notif-title">${TITULOS[t] || TITULOS.info}</span>
      <span class="notif-msg">${msg}</span>
    </div>
    <button class="notif-close" type="button" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>`;

  cont.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visible'));

  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    el.classList.remove('visible');
    el.classList.add('closing');
    setTimeout(() => el.remove(), 320);
  };

  el.querySelector('.notif-close').addEventListener('click', cerrar);
  setTimeout(cerrar, t === 'error' ? 4200 : 2800);

  return cerrar;
}
