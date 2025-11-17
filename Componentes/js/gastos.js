import { db, IMGBB_API_KEY } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showConfirm } from './confirm-modal.js';
import { showToast } from './toast-notification.js';

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const btnNewExpense = document.getElementById('btnNewExpense');
const expenseModal = document.getElementById('expenseModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const expenseForm = document.getElementById('expenseForm');
const searchInput = document.getElementById('searchInput');
const imageInput = document.getElementById('imagen');
const imagePreview = document.getElementById('imagePreview');
const montoInput = document.getElementById('monto');

let allExpenses = [];
let editingId = null;
let selectedMonth = '';

// Generate month options
function populateMonthFilter() {
    const monthFilter = document.getElementById('monthFilter');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    // Add all months of current year up to current month
    for (let i = 0; i <= currentMonth; i++) {
        const value = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = `${months[i]} ${currentYear}`;
        monthFilter.appendChild(option);
    }
    
    // Set current month as default
    selectedMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    monthFilter.value = selectedMonth;
}

// Month filter change
document.getElementById('monthFilter').addEventListener('change', (e) => {
    selectedMonth = e.target.value;
    filterAndRenderExpenses();
});

// Format number with thousands separator
function formatNumber(value) {
    const number = value.replace(/\D/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function unformatNumber(value) {
    return value.replace(/,/g, '');
}

// Format monto input in real-time
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

menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

btnNewExpense.addEventListener('click', () => {
    openModal();
});

closeModal.addEventListener('click', () => {
    closeModalHandler();
});

cancelBtn.addEventListener('click', () => {
    closeModalHandler();
});

expenseModal.addEventListener('click', (e) => {
    if (e.target === expenseModal) {
        closeModalHandler();
    }
});

function openModal(expense = null) {
    editingId = expense?.id || null;
    document.getElementById('modalTitle').textContent = expense ? 'Editar Gasto' : 'Nuevo Gasto';
    
    if (expense) {
        document.getElementById('monto').value = formatNumber(String(Math.round(expense.monto)));
        document.getElementById('descripcion').value = expense.descripcion;
        document.getElementById('cuenta').value = expense.cuenta;
        document.getElementById('categoria').value = expense.categoria || '';
        document.getElementById('fecha').value = expense.fecha?.toDate?.().toISOString().split('T')[0] || expense.fecha;
        
        if (expense.imagen) {
            imagePreview.innerHTML = `<img src="${expense.imagen}" alt="Preview">`;
        }
    } else {
        expenseForm.reset();
        imagePreview.innerHTML = '';
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('fecha').value = `${year}-${month}-${day}`;
    }
    
    expenseModal.classList.add('active');
}

function closeModalHandler() {
    expenseModal.classList.remove('active');
    expenseForm.reset();
    imagePreview.innerHTML = '';
    editingId = null;
}

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    }
});

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const submitBtn = document.getElementById('submitBtn');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    submitBtn.disabled = true;
    
    try {
        let imageUrl = '';
        
        if (imageInput.files[0]) {
            imageUrl = await uploadImage(imageInput.files[0]);
        } else if (editingId) {
            const existingExpense = allExpenses.find(e => e.id === editingId);
            imageUrl = existingExpense?.imagen || '';
        }
        
        // Crear fecha en hora local para evitar problemas de zona horaria
        const fechaInput = document.getElementById('fecha').value;
        const [año, mes, dia] = fechaInput.split('-').map(Number);
        const fechaLocal = new Date(año, mes - 1, dia, 12, 0, 0); // Usar mediodía para evitar cambios de fecha
        
        const expenseData = {
            monto: parseInt(unformatNumber(document.getElementById('monto').value)),
            descripcion: document.getElementById('descripcion').value,
            cuenta: document.getElementById('cuenta').value,
            categoria: document.getElementById('categoria').value,
            fecha: Timestamp.fromDate(fechaLocal),
            imagen: imageUrl
        };
        
        if (editingId) {
            await updateDoc(doc(db, 'gastos', editingId), expenseData);
        } else {
            await addDoc(collection(db, 'gastos'), expenseData);
            // Actualizar saldo de la cuenta (restar)
            await updateAccountBalance(expenseData.cuenta, expenseData.monto, 'subtract');
        }
        
        closeModalHandler();
        await loadExpenses();
        showToast('Gasto guardado exitosamente', 'success');
    } catch (error) {
        console.error('Error saving expense:', error);
        showToast('Error al guardar el gasto', 'error');
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
});

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    if (data.success) {
        return data.data.url;
    }
    throw new Error('Error uploading image');
}

async function loadExpenses() {
    try {
        const expensesSnap = await getDocs(collection(db, 'gastos'));
        allExpenses = [];
        
        expensesSnap.forEach(doc => {
            const data = doc.data();
            allExpenses.push({ id: doc.id, ...data });
        });
        
        filterAndRenderExpenses();
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

function renderExpenses(expenses) {
    const container = document.getElementById('expensesList');
    
    if (expenses.length === 0) {
        container.innerHTML = '<p class="no-data">No hay gastos registrados</p>';
        return;
    }
    
    container.innerHTML = expenses.map(expense => `
        <div class="expense-item">
            <div class="item-header">
                <div class="item-amount">${formatCurrency(expense.monto)}</div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="editExpense('${expense.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteExpense('${expense.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="item-description">${expense.descripcion}</div>
            <div class="item-details">
                <div class="item-detail">
                    <i class="fas fa-credit-card"></i>
                    <span>${expense.cuenta}</span>
                </div>
                ${expense.categoria ? `
                <div class="item-detail">
                    <i class="fas fa-tag"></i>
                    <span>${expense.categoria}</span>
                </div>
                ` : ''}
                <div class="item-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(expense.fecha)}</span>
                </div>
            </div>
            ${expense.imagen ? `
            <div class="item-image">
                <img src="${expense.imagen}" alt="Comprobante" onclick="openImageModal('${expense.imagen}')">
            </div>
            ` : ''}
        </div>
    `).join('');
}

// Filter and render
function filterAndRenderExpenses() {
    let filtered = allExpenses;
    
    // Filter by month
    if (selectedMonth) {
        filtered = filtered.filter(expense => {
            const expenseDate = expense.fecha?.toDate?.() || new Date(expense.fecha);
            const expenseMonth = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
            return expenseMonth === selectedMonth;
        });
    }
    
    // Filter by search
    const search = searchInput.value.toLowerCase();
    if (search) {
        filtered = filtered.filter(expense => 
            expense.descripcion.toLowerCase().includes(search) ||
            expense.cuenta.toLowerCase().includes(search) ||
            (expense.categoria && expense.categoria.toLowerCase().includes(search))
        );
    }
    
    // Update total
    const total = filtered.reduce((sum, expense) => sum + parseInt(expense.monto || 0), 0);
    document.getElementById('totalExpense').textContent = formatCurrency(total);
    
    renderExpenses(filtered);
}

searchInput.addEventListener('input', () => {
    filterAndRenderExpenses();
});

window.editExpense = (id) => {
    const expense = allExpenses.find(e => e.id === id);
    if (expense) {
        openModal(expense);
    }
};

window.deleteExpense = async (id) => {
    const confirmed = await showConfirm(
        '¿Eliminar gasto?',
        'Esta acción no se puede deshacer. El gasto será eliminado permanentemente.',
        'Eliminar'
    );
    
    if (confirmed) {
        try {
            // Obtener el gasto antes de eliminarlo para actualizar el saldo
            const expense = allExpenses.find(e => e.id === id);
            if (expense) {
                // Devolver el dinero a la cuenta (sumar)
                await updateAccountBalance(expense.cuenta, expense.monto, 'add');
            }
            
            await deleteDoc(doc(db, 'gastos', id));
            await loadExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    }
};

let categoriesData = [];

async function loadSelects() {
    try {
        const [accountsSnap, categoriesSnap] = await Promise.all([
            getDocs(collection(db, 'cuentas')),
            getDocs(collection(db, 'categorias'))
        ]);
        
        const cuentaSelect = document.getElementById('cuenta');
        const categoriaSelect = document.getElementById('categoria');
        
        cuentaSelect.innerHTML = '<option value="">Seleccionar cuenta</option>';
        accountsSnap.forEach(doc => {
            const option = document.createElement('option');
            option.value = doc.data().nombre;
            option.textContent = doc.data().nombre;
            cuentaSelect.appendChild(option);
        });
        
        categoriaSelect.innerHTML = '<option value="">Seleccionar categoría</option>';
        categoriesData = [];
        categoriesSnap.forEach(doc => {
            const data = doc.data();
            if (data.tipo === 'gasto') {
                categoriesData.push(data);
                const option = document.createElement('option');
                option.value = data.nombre;
                option.textContent = data.nombre + (data.montoPredefinido ? ` - ${formatCurrency(data.montoPredefinido)}` : '');
                categoriaSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error loading selects:', error);
    }
}

// Auto-fill amount when category is selected
document.getElementById('categoria').addEventListener('change', (e) => {
    const selectedCategory = categoriesData.find(cat => cat.nombre === e.target.value);
    if (selectedCategory && selectedCategory.montoPredefinido) {
        document.getElementById('monto').value = formatNumber(String(selectedCategory.montoPredefinido));
    }
});

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(date) {
    if (!date) return '';
    const d = date?.toDate?.() || new Date(date);
    return d.toLocaleDateString('es-MX', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

// Update account balance
async function updateAccountBalance(accountName, amount, operation) {
    try {
        const accountsSnap = await getDocs(collection(db, 'cuentas'));
        accountsSnap.forEach(async (docSnap) => {
            const account = docSnap.data();
            if (account.nombre === accountName) {
                const currentBalance = parseInt(account.saldo || 0);
                const newBalance = operation === 'subtract' 
                    ? currentBalance - amount 
                    : currentBalance + amount;
                await updateDoc(doc(db, 'cuentas', docSnap.id), {
                    saldo: newBalance
                });
            }
        });
    } catch (error) {
        console.error('Error updating account balance:', error);
    }
}

// Image Modal
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeImageModal = document.getElementById('closeImageModal');

window.openImageModal = (imageUrl) => {
    modalImage.src = imageUrl;
    imageModal.classList.add('active');
};

closeImageModal.addEventListener('click', () => {
    imageModal.classList.remove('active');
});

imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        imageModal.classList.remove('active');
    }
});

// Close with ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageModal.classList.contains('active')) {
        imageModal.classList.remove('active');
    }
});

populateMonthFilter();
loadExpenses();
loadSelects();


