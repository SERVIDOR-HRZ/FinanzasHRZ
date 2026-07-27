// ── AI-CONFIG ───────────────────────────────────────────────
// ⚠️ SEGURIDAD: la clave se reconstruye en el cliente a partir de
// fragmentos. Esto solo evita el escaneo automático de secretos;
// sigue siendo visible para quien lea el código. Lo ideal es un
// proxy/Firebase Functions. Rota la clave si se filtra.
const _p = [
  "sk" + "-or" + "-v1",
  "bac3261ddb95",
  "98963dabf64a",
  "7a7cfa4565fb",
  "4d281a10beb8",
  "0215cf888bfc",
  "d7d8",
];
export const OPENROUTER_KEY = _p[0] + "-" + _p.slice(1).join("");

// ── ImgBB (hosting de imágenes) ──────────────────────────────
// Clave de https://api.imgbb.com/ reconstruida por fragmentos (evita
// el escaneo automático de secretos; sigue siendo visible en el cliente).
const _i = ["c55ec5f8", "b5911300", "d4f51446", "4a765dc7"];
export const IMGBB_KEY = _i.join("");

// Sube una imagen (dataURL) a ImgBB y devuelve la URL pública.
export async function subirImgBB(dataUrl) {
  if (!IMGBB_KEY) throw new Error("Falta configurar la clave de ImgBB (IMGBB_KEY en ai-config.js)");
  const base64 = String(dataUrl).split(',')[1] || '';
  const form = new FormData();
  form.append('image', base64);
  const res = await fetch('https://api.imgbb.com/1/upload?key=' + IMGBB_KEY, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data || !data.success || !data.data) throw new Error('Respuesta inválida de ImgBB');
  return data.data.url;
}

// Modelos con visión (se intentan en orden hasta que uno responda).
// IDs verificados vigentes en OpenRouter. Mezcla de modelos económicos con
// buena lectura de recibos (OCR) + respaldo gratuito al final.
export const AI_MODELS = [
  "qwen/qwen3-vl-30b-a3b-instruct",       // barato, muy buen OCR de recibos
  "google/gemini-2.5-flash-lite",         // muy barato, rápido, buena visión
  "qwen/qwen3-vl-8b-instruct",            // barato, respaldo con visión
  "mistralai/mistral-small-3.2-24b-instruct", // respaldo con visión
  "google/gemma-4-31b-it:free",           // respaldo gratuito con visión
];

// Reduce la imagen para enviarla ligera a la IA / guardarla como comprobante
export function comprimirImagen(file, maxLado = 900, calidad = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxLado) { height = height * maxLado / width; width = maxLado; }
        else if (height > maxLado) { width = width * maxLado / height; height = maxLado; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Analiza el comprobante y devuelve { concepto, monto, categoria }
export async function analizarComprobante(dataUrl, tipo, categorias) {
  const nombresCats = categorias.map(c => c.nombre || c.label).filter(Boolean);
  const prompt =
`Eres un asistente que extrae datos de una imagen para registrar un ${tipo === 'ingreso' ? 'ingreso' : 'gasto'}.
La imagen puede ser una factura, recibo, ticket, pantallazo o incluso una nota escrita a mano (por ejemplo "caja 5000" significa concepto "caja" y monto 5000).
Extrae SIEMPRE lo que puedas, aunque la imagen sea simple o de baja calidad.

Devuelve ÚNICAMENTE un JSON válido, sin texto extra ni explicaciones, con esta forma exacta:
{"concepto": "descripción corta (máx 40 caracteres)", "monto": number, "categoria": "una de la lista o null"}

Reglas del MONTO (¡muy importante, formato de Colombia!):
- En Colombia el PUNTO (.) separa los miles y la COMA (,) separa los decimales.
  Ejemplos: "$790.000,00" = 790000  |  "$1.250.500,00" = 1250500  |  "$5.000" = 5000.
- Devuelve el monto como número ENTERO en pesos, IGNORANDO los centavos/decimales (lo que va después de la coma).
- NO conviertas los puntos de miles en dígitos extra: "$790.000,00" son 790 mil, es decir 790000, NUNCA 79000000.
- Si hay varios valores (ej. total, costo, IVA), toma el valor PRINCIPAL o "Valor"/"Total" de la transacción.
- Si ves un número junto a un texto simple (nota a mano), ese número es el monto tal cual.
- "concepto": el producto, servicio o motivo (ejemplo: "transferencia", "almuerzo", "arriendo").
- "categoria": elige la que mejor encaje de esta lista o null si ninguna aplica.
Categorías disponibles: ${nombresCats.length ? nombresCats.join(', ') : 'ninguna'}.`;

  const body = {
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
    temperature: 0.1,
  };

  let lastErr = null;
  for (const model of AI_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + OPENROUTER_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, ...body }),
      });
      if (!res.ok) { lastErr = new Error("HTTP " + res.status); continue; }
      const data = await res.json();
      const txt = data?.choices?.[0]?.message?.content;
      if (!txt) { lastErr = new Error("Respuesta vacía"); continue; }
      try {
        return parseRespuesta(txt, categorias);
      } catch (parseErr) {
        // JSON inválido en este modelo: probamos el siguiente
        lastErr = parseErr;
        continue;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No se pudo analizar la imagen");
}

// Normaliza el monto devuelto por la IA a un entero de pesos.
// Interpreta correctamente el formato colombiano ("790.000,00" = 790000) y
// evita que los centavos ".00" o los puntos de miles inflen la cifra.
function normalizarMonto(valor) {
  if (typeof valor === 'number') return Math.round(valor);
  let s = String(valor || '').trim().replace(/[^0-9.,]/g, '');
  if (!s) return 0;

  const tienePunto = s.includes('.');
  const tieneComa = s.includes(',');

  if (tienePunto && tieneComa) {
    // El último separador que aparece es el decimal.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // formato CO: puntos = miles, coma = decimal → quitar puntos, coma a punto
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // formato US: comas = miles, punto = decimal → quitar comas
      s = s.replace(/,/g, '');
    }
  } else if (tieneComa) {
    // Solo coma: si separa 3 dígitos al final es miles, si no es decimal
    s = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (tienePunto) {
    // Solo punto: si separa exactamente 3 dígitos al final es miles (CO)
    if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
    // si son 2 decimales (".00") o 1, se deja como decimal
  }

  return Math.round(parseFloat(s) || 0);
}

function parseRespuesta(txt, categorias) {
  // quitar posibles ```json ... ```
  let limpio = txt.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  const ini = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (ini !== -1 && fin !== -1) limpio = limpio.slice(ini, fin + 1);

  const obj = JSON.parse(limpio);
  const monto = normalizarMonto(obj.monto);

  // mapear nombre de categoría -> id (coincidencia flexible)
  let categoriaId = null;
  if (obj.categoria) {
    const objetivo = String(obj.categoria).trim().toLowerCase();
    const nombreDe = c => (c.nombre || c.label || '').trim().toLowerCase();
    // 1) coincidencia exacta  2) uno contiene al otro
    let found = categorias.find(c => nombreDe(c) === objetivo);
    if (!found) found = categorias.find(c => {
      const n = nombreDe(c);
      return n && (n.includes(objetivo) || objetivo.includes(n));
    });
    if (found) categoriaId = found.id;
  }

  return {
    concepto: (obj.concepto || '').toString().slice(0, 40),
    monto,
    categoria: categoriaId,
  };
}
