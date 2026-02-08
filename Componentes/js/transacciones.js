import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showConfirm } from './confirm-modal.js';

// Variables globales
let transactions = [];
let accounts = [];
let editingId = null;

// Elementos del DOM
const transactionsList = document.getElementById('transactionsList');
const transactionModal = document.getElementById('transactionModal');
const transactionForm = document.getElementById('transactionForm');
const btnNewTransaction = document.getElementById('btnNewTransaction');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const modalTitle = document.getElementById('modalTitle');
const monthFilter = document.getElementById('monthFilter');
const yearFilter = document.getElementById('yearFilter');
const searchInput = document.getElementById('searchInput');
const totalTransactions = document.getElementById('totalTransactions');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');

let selectedYear = new Date().getFullYear();

// Sidebar toggle
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebarClose');

if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}

if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', () => {
        sidebar.classList.remove('active');
    });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar) {
        if (!sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

// Inicializar
document.addEventListener('DOMContentLoaded', async () => {
    await loadAccounts();
    populateYearFilter();
    populateMonthFilter();
    setTodayDate();
    await loadTransactions();
});

// Poblar filtro de años
function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    const startYear = 2020; // Año inicial
    
    for (let year = currentYear; year >= startYear; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    }
    
    // Establecer año actual por defecto
    yearFilter.value = currentYear;
    selectedYear = currentYear;
}

// Poblar filtro de meses según el año seleccionado
function populateMonthFilter() {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    // Limpiar opciones existentes excepto "Todos los meses"
    monthFilter.innerHTML = '<option value="">Todos los meses</option>';
    
    const year = parseInt(selectedYear);
    const maxMonth = (year === currentYear) ? currentMonth : 11;
    
    // Agregar meses disponibles
    for (let i = 0; i <= maxMonth; i++) {
        const value = `${year}-${String(i + 1).padStart(2, '0')}`;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${months[i]} ${year}`;
        monthFilter.appendChild(option);
    }
    
    // Seleccionar el mes actual por defecto
    const currentMonthValue = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    monthFilter.value = currentMonthValue;
}

// Event listener para cambio de año
yearFilter.addEventListener('change', (e) => {
    selectedYear = e.target.value || new Date().getFullYear();
    populateMonthFilter();
    renderTransactions();
});

monthFilter.addEventListener('change', renderTransactions);
searchInput.addEventListener('input', renderTransactions);

// Cargar cuentas
async function loadAccounts() {
    try {
        const querySnapshot = await getDocs(collection(db, 'cuentas'));
        accounts = [];
        querySnapshot.forEach((doc) => {
            accounts.push({
                id: doc.id,
                ...doc.data()
            });
        });
        populateAccountSelects();
    } catch (error) {
        console.error('Error al cargar cuentas:', error);
    }
}

// Poblar selectores de cuentas
function populateAccountSelects() {
    const cuentaOrigen = document.getElementById('cuentaOrigen');
    const cuentaDestino = document.getElementById('cuentaDestino');
    
    cuentaOrigen.innerHTML = '<option value="">Seleccionar cuenta origen</option>';
    cuentaDestino.innerHTML = '<option value="">Seleccionar cuenta destino</option>';
    
    accounts.forEach(account => {
        const optionOrigen = document.createElement('option');
        optionOrigen.value = account.id;
        optionOrigen.textContent = `${account.nombre} - $${parseFloat(account.saldo || 0).toFixed(2)}`;
        cuentaOrigen.appendChild(optionOrigen);
        
        const optionDestino = document.createElement('option');
        optionDestino.value = account.id;
        optionDestino.textContent = `${account.nombre} - $${parseFloat(account.saldo || 0).toFixed(2)}`;
        cuentaDestino.appendChild(optionDestino);
    });
}

// Cargar transacciones
async function loadTransactions() {
    try {
        const q = query(collection(db, 'transacciones'), orderBy('fecha', 'desc'));
        const querySnapshot = await getDocs(q);
        transactions = [];
        
        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            
            // Obtener información de las cuentas
            const cuentaOrigenDoc = await getDoc(doc(db, 'cuentas', data.cuentaOrigen));
            const cuentaDestinoDoc = await getDoc(doc(db, 'cuentas', data.cuentaDestino));
            
            transactions.push({
                id: docSnap.id,
                ...data,
                cuentaOrigenNombre: cuentaOrigenDoc.exists() ? cuentaOrigenDoc.data().nombre : 'Cuenta eliminada',
                cuentaDestinoNombre: cuentaDestinoDoc.exists() ? cuentaDestinoDoc.data().nombre : 'Cuenta eliminada'
            });
        }
        
        renderTransactions();
    } catch (error) {
        console.error('Error al cargar transacciones:', error);
    }
}

// Renderizar transacciones
function renderTransactions() {
    const filterMonth = monthFilter.value;
    const searchTerm = searchInput.value.toLowerCase();
    
    let filtered = transactions.filter(transaction => {
        // Manejar tanto fechas Timestamp como strings para compatibilidad
        let transactionDate;
        if (transaction.fecha?.toDate) {
            transactionDate = transaction.fecha.toDate();
        } else if (typeof transaction.fecha === 'string') {
            transactionDate = new Date(transaction.fecha + 'T12:00:00');
        } else {
            transactionDate = new Date(transaction.fecha);
        }
        
        const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
        const matchesMonth = !filterMonth || transactionMonth === filterMonth;
        const matchesSearch = !searchTerm || 
            transaction.descripcion?.toLowerCase().includes(searchTerm) ||
            transaction.cuentaOrigenNombre.toLowerCase().includes(searchTerm) ||
            transaction.cuentaDestinoNombre.toLowerCase().includes(searchTerm);
        return matchesMonth && matchesSearch;
    });
    
    // Actualizar el total con las transacciones filtradas
    totalTransactions.textContent = filtered.length;
    
    if (filtered.length === 0) {
        transactionsList.innerHTML = '<p class="no-data">No hay transacciones registradas</p>';
        return;
    }
    
    transactionsList.innerHTML = filtered.map(transaction => `
        <div class="transaction-item">
            <div class="item-header">
                <div class="transaction-amount">$${formatCurrency(transaction.monto)}</div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="editTransaction('${transaction.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteTransaction('${transaction.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="transaction-accounts">
                <span class="account-badge account-origin">
                    <i class="fas fa-minus-circle"></i>
                    ${transaction.cuentaOrigenNombre}
                </span>
                <i class="fas fa-arrow-right arrow-icon"></i>
                <span class="account-badge account-destination">
                    <i class="fas fa-plus-circle"></i>
                    ${transaction.cuentaDestinoNombre}
                </span>
            </div>
            ${transaction.descripcion ? `<div class="transaction-description">${transaction.descripcion}</div>` : ''}
            <div class="transaction-date">
                <i class="fas fa-calendar"></i>
                ${formatDate(transaction.fecha)}
            </div>
        </div>
    `).join('');
}

// Establecer fecha de hoy
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').value = today;
}

// Formatear fecha
function formatDate(date) {
    if (!date) return '';
    const d = date?.toDate?.() || new Date(date);
    return d.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Formatear moneda con separadores de miles
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Format number with thousands separator
function formatNumber(value) {
    const number = value.replace(/\D/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function unformatNumber(value) {
    return value.replace(/\./g, '');
}

// Event listeners
btnNewTransaction.addEventListener('click', () => {
    editingId = null;
    modalTitle.textContent = 'Nueva Transacción';
    transactionForm.reset();
    setTodayDate();
    transactionModal.classList.add('active');
});

closeModal.addEventListener('click', () => {
    transactionModal.classList.remove('active');
});

cancelBtn.addEventListener('click', () => {
    transactionModal.classList.remove('active');
});

transactionModal.addEventListener('click', (e) => {
    if (e.target === transactionModal) {
        transactionModal.classList.remove('active');
    }
});

// Format monto input in real-time
const montoInput = document.getElementById('monto');
montoInput.addEventListener('input', (e) => {
    const cursorPosition = e.target.selectionStart;
    const oldLength = e.target.value.length;
    const unformatted = unformatNumber(e.target.value);
    const formatted = formatNumber(unformatted);
    e.target.value = formatted;
    
    const newLength = formatted.length;
    const diff = newLength - oldLength;
    e.target.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
});

// Validar que las cuentas sean diferentes
document.getElementById('cuentaOrigen').addEventListener('change', validateAccounts);
document.getElementById('cuentaDestino').addEventListener('change', validateAccounts);

function validateAccounts() {
    const cuentaOrigen = document.getElementById('cuentaOrigen').value;
    const cuentaDestino = document.getElementById('cuentaDestino').value;
    
    if (cuentaOrigen && cuentaDestino && cuentaOrigen === cuentaDestino) {
        alert('Las cuentas origen y destino deben ser diferentes');
        document.getElementById('cuentaDestino').value = '';
    }
}

// Guardar transacción
transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const monto = parseFloat(unformatNumber(document.getElementById('monto').value));
    const cuentaOrigenId = document.getElementById('cuentaOrigen').value;
    const cuentaDestinoId = document.getElementById('cuentaDestino').value;
    const descripcion = document.getElementById('descripcion').value;
    const fecha = document.getElementById('fecha').value;
    
    if (cuentaOrigenId === cuentaDestinoId) {
        alert('Las cuentas origen y destino deben ser diferentes');
        return;
    }
    
    // Verificar que la cuenta origen tenga saldo suficiente
    const cuentaOrigen = accounts.find(acc => acc.id === cuentaOrigenId);
    if (!cuentaOrigen) {
        alert('Cuenta origen no encontrada');
        return;
    }
    
    if (parseFloat(cuentaOrigen.saldo) < monto) {
        alert('Saldo insuficiente en la cuenta origen');
        return;
    }
    
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    
    try {
        // Crear fecha en hora local para evitar problemas de zona horaria
        const [año, mes, dia] = fecha.split('-').map(Number);
        const fechaLocal = new Date(año, mes - 1, dia, 12, 0, 0); // Usar mediodía para evitar cambios de fecha
        
        const transactionData = {
            monto: monto,
            cuentaOrigen: cuentaOrigenId,
            cuentaDestino: cuentaDestinoId,
            descripcion: descripcion,
            fecha: Timestamp.fromDate(fechaLocal),
            fechaCreacion: new Date().toISOString()
        };
        
        if (editingId) {
            // Editar transacción existente
            const oldTransaction = transactions.find(t => t.id === editingId);
            
            // Revertir la transacción anterior
            const oldCuentaOrigen = doc(db, 'cuentas', oldTransaction.cuentaOrigen);
            const oldCuentaDestino = doc(db, 'cuentas', oldTransaction.cuentaDestino);
            const oldCuentaOrigenData = await getDoc(oldCuentaOrigen);
            const oldCuentaDestinoData = await getDoc(oldCuentaDestino);
            
            if (oldCuentaOrigenData.exists()) {
                await updateDoc(oldCuentaOrigen, {
                    saldo: parseFloat(oldCuentaOrigenData.data().saldo) + parseFloat(oldTransaction.monto)
                });
            }
            
            if (oldCuentaDestinoData.exists()) {
                await updateDoc(oldCuentaDestino, {
                    saldo: parseFloat(oldCuentaDestinoData.data().saldo) - parseFloat(oldTransaction.monto)
                });
            }
            
            // Aplicar nueva transacción
            await updateDoc(doc(db, 'transacciones', editingId), transactionData);
            
            // Actualizar saldos
            const newCuentaOrigen = doc(db, 'cuentas', cuentaOrigenId);
            const newCuentaDestino = doc(db, 'cuentas', cuentaDestinoId);
            const newCuentaOrigenData = await getDoc(newCuentaOrigen);
            const newCuentaDestinoData = await getDoc(newCuentaDestino);
            
            await updateDoc(newCuentaOrigen, {
                saldo: parseFloat(newCuentaOrigenData.data().saldo) - monto
            });
            
            await updateDoc(newCuentaDestino, {
                saldo: parseFloat(newCuentaDestinoData.data().saldo) + monto
            });
            
        } else {
            // Nueva transacción
            await addDoc(collection(db, 'transacciones'), transactionData);
            
            // Actualizar saldos de las cuentas
            const cuentaOrigenRef = doc(db, 'cuentas', cuentaOrigenId);
            const cuentaDestinoRef = doc(db, 'cuentas', cuentaDestinoId);
            
            const cuentaOrigenData = await getDoc(cuentaOrigenRef);
            const cuentaDestinoData = await getDoc(cuentaDestinoRef);
            
            await updateDoc(cuentaOrigenRef, {
                saldo: parseFloat(cuentaOrigenData.data().saldo) - monto
            });
            
            await updateDoc(cuentaDestinoRef, {
                saldo: parseFloat(cuentaDestinoData.data().saldo) + monto
            });
        }
        
        transactionModal.classList.remove('active');
        transactionForm.reset();
        await loadAccounts();
        await loadTransactions();
    } catch (error) {
        console.error('Error al guardar transacción:', error);
        alert('Error al guardar la transacción');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
});

// Editar transacción
window.editTransaction = async (id) => {
    editingId = id;
    const transaction = transactions.find(t => t.id === id);
    
    if (!transaction) return;
    
    modalTitle.textContent = 'Editar Transacción';
    document.getElementById('monto').value = formatNumber(String(Math.round(transaction.monto)));
    document.getElementById('cuentaOrigen').value = transaction.cuentaOrigen;
    document.getElementById('cuentaDestino').value = transaction.cuentaDestino;
    document.getElementById('descripcion').value = transaction.descripcion || '';
    
    // Manejar tanto fechas Timestamp como strings
    let fechaValue;
    if (transaction.fecha?.toDate) {
        fechaValue = transaction.fecha.toDate().toISOString().split('T')[0];
    } else if (typeof transaction.fecha === 'string') {
        fechaValue = transaction.fecha;
    } else {
        fechaValue = new Date(transaction.fecha).toISOString().split('T')[0];
    }
    document.getElementById('fecha').value = fechaValue;
    
    transactionModal.classList.add('active');
};

// Eliminar transacción
window.deleteTransaction = async (id) => {
    const confirmed = await showConfirm(
        '¿Eliminar transacción?',
        'Esta acción no se puede deshacer. La transacción será eliminada permanentemente.',
        'Eliminar'
    );
    
    if (!confirmed) return;
    
    try {
        const transaction = transactions.find(t => t.id === id);
        
        // Revertir los cambios en las cuentas
        const cuentaOrigenRef = doc(db, 'cuentas', transaction.cuentaOrigen);
        const cuentaDestinoRef = doc(db, 'cuentas', transaction.cuentaDestino);
        
        const cuentaOrigenData = await getDoc(cuentaOrigenRef);
        const cuentaDestinoData = await getDoc(cuentaDestinoRef);
        
        if (cuentaOrigenData.exists()) {
            await updateDoc(cuentaOrigenRef, {
                saldo: parseFloat(cuentaOrigenData.data().saldo) + parseFloat(transaction.monto)
            });
        }
        
        if (cuentaDestinoData.exists()) {
            await updateDoc(cuentaDestinoRef, {
                saldo: parseFloat(cuentaDestinoData.data().saldo) - parseFloat(transaction.monto)
            });
        }
        
        await deleteDoc(doc(db, 'transacciones', id));
        await loadAccounts();
        await loadTransactions();
    } catch (error) {
        console.error('Error al eliminar transacción:', error);
        alert('Error al eliminar la transacción');
    }
};


