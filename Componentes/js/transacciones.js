import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
const searchInput = document.getElementById('searchInput');
const totalTransactions = document.getElementById('totalTransactions');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');

// Sidebar toggle
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    loadAccounts();
    loadTransactions();
    populateMonthFilter();
    setTodayDate();
});

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
        updateTotal();
    } catch (error) {
        console.error('Error al cargar transacciones:', error);
    }
}

// Renderizar transacciones
function renderTransactions() {
    const filterMonth = monthFilter.value;
    const searchTerm = searchInput.value.toLowerCase();
    
    let filtered = transactions.filter(transaction => {
        const matchesMonth = !filterMonth || transaction.fecha.startsWith(filterMonth);
        const matchesSearch = !searchTerm || 
            transaction.descripcion?.toLowerCase().includes(searchTerm) ||
            transaction.cuentaOrigenNombre.toLowerCase().includes(searchTerm) ||
            transaction.cuentaDestinoNombre.toLowerCase().includes(searchTerm);
        return matchesMonth && matchesSearch;
    });
    
    if (filtered.length === 0) {
        transactionsList.innerHTML = '<p class="no-data">No hay transacciones registradas</p>';
        return;
    }
    
    transactionsList.innerHTML = filtered.map(transaction => `
        <div class="transaction-item">
            <div class="transaction-icon">
                <i class="fas fa-exchange-alt"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-accounts">
                    <span class="account-badge account-origin">
                        <i class="fas fa-arrow-up"></i>
                        ${transaction.cuentaOrigenNombre}
                    </span>
                    <i class="fas fa-arrow-right" style="color: #a0aec0;"></i>
                    <span class="account-badge account-destination">
                        <i class="fas fa-arrow-down"></i>
                        ${transaction.cuentaDestinoNombre}
                    </span>
                </div>
                ${transaction.descripcion ? `<div class="transaction-description">${transaction.descripcion}</div>` : ''}
                <div class="transaction-date">
                    <i class="fas fa-calendar"></i>
                    ${formatDate(transaction.fecha)}
                </div>
            </div>
            <div class="transaction-details">
                <div class="transaction-amount">$${formatCurrency(transaction.monto)}</div>
                <div class="transaction-actions">
                    <button class="btn-icon btn-edit" onclick="editTransaction('${transaction.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteTransaction('${transaction.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Actualizar total
function updateTotal() {
    totalTransactions.textContent = transactions.length;
}

// Poblar filtro de meses
function populateMonthFilter() {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthText = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        months.push({ value: monthValue, text: monthText.charAt(0).toUpperCase() + monthText.slice(1) });
    }
    
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month.value;
        option.textContent = month.text;
        monthFilter.appendChild(option);
    });
}

// Establecer fecha de hoy
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').value = today;
}

// Formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { 
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

monthFilter.addEventListener('change', renderTransactions);
searchInput.addEventListener('input', renderTransactions);

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
        const transactionData = {
            monto: monto,
            cuentaOrigen: cuentaOrigenId,
            cuentaDestino: cuentaDestinoId,
            descripcion: descripcion,
            fecha: fecha,
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
    document.getElementById('fecha').value = transaction.fecha;
    
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


