// ── CATS-STORE ──────────────────────────────────────────────
// Almacén compartido de categorías (defaults + personalizadas de Firestore)
import { db } from "./firebase.js";
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Paletas para el creador ──────────────────────────────────
export const CAT_ICONS = [
  'fa-solid fa-briefcase','fa-solid fa-tag','fa-solid fa-store','fa-solid fa-chart-line',
  'fa-solid fa-gift','fa-solid fa-hand-holding-dollar','fa-solid fa-utensils','fa-solid fa-car',
  'fa-solid fa-house','fa-solid fa-bolt','fa-solid fa-bag-shopping','fa-solid fa-heart-pulse',
  'fa-solid fa-gamepad','fa-solid fa-graduation-cap','fa-solid fa-repeat','fa-solid fa-plane',
  'fa-solid fa-dumbbell','fa-solid fa-mug-hot','fa-solid fa-shirt','fa-solid fa-gas-pump',
  'fa-solid fa-wifi','fa-solid fa-mobile-screen','fa-solid fa-piggy-bank','fa-solid fa-ellipsis',
];

export const CAT_COLORS = [
  '#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE','#34d399',
  '#22d3ee','#38bdf8','#007AFF','#5856D6','#a78bfa','#AF52DE',
  '#f472b6','#FF00AA','#fb923c','#facc15','#e879f9','#94a3b8',
];

// ── Firestore ────────────────────────────────────────────────
const COL = collection(db, 'categorias');

export function subscribeCategorias(tipo, cb) {
  // Devuelve unsubscribe. Solo categorías creadas por el usuario.
  return onSnapshot(query(COL, where('tipo', '==', tipo)), snap => {
    const custom = snap.docs.map(d => ({ id: d.id, custom: true, ...d.data() }));
    custom.sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0));
    cb(custom);
  });
}

export function subscribeTodas(cb) {
  return onSnapshot(COL, snap => {
    const custom = snap.docs.map(d => ({ id: d.id, custom: true, ...d.data() }));
    custom.sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0));
    cb(custom);
  });
}

export async function crearCategoria(data) {
  await addDoc(COL, { ...data, creadoEn: Date.now() });
}

export async function actualizarCategoria(id, data) {
  await updateDoc(doc(db, 'categorias', id), data);
}

export async function eliminarCategoria(id) {
  await deleteDoc(doc(db, 'categorias', id));
}

// Busca en una lista combinada
export function findCat(lista, id) {
  return lista.find(c => c.id === id) || lista.at(-1);
}
