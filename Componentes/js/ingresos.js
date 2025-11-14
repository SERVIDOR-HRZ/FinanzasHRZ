import { db, IMGBB_API_KEY } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showConfirm } from './confirm-modal.js';

// Elements
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const btnNewIncome = document.getElementById('btnNewIncome');
const incomeModal = document.getElementById('incomeModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const incomeForm = document.getElementById('incomeForm');
const searchInput = document.getElementById('searchInput');
const imageInput = document.getElementById('imagen');
const imagePreview = document.getElementById('imagePreview');
const montoInput = document.getElementById('monto');

let allIncomes = [];
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
    filterAndRenderIncomes();
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

// Menu Toggle
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

// Modal
btnNewIncome.addEventListener('click', () => {
    openModal();
});

closeModal.addEventListener('click', () => {
    closeModalHandler();
});

cancelBtn.addEventListener('click', () => {
    closeModalHandler();
});

incomeModal.addEventListener('click', (e) => {
    if (e.target === incomeModal) {
        closeModalHandler();
    }
});

function openModal(income = null) {
    editingId = income?.id || null;
    document.getElementById('modalTitle').textContent = income ? 'Editar Ingreso' : 'Nuevo Ingreso';
    
    if (income) {
        document.getElementById('monto').value = formatNumber(String(Math.round(income.monto)));
        document.getElementById('descripcion').value = income.descripcion;
        document.getElementById('cuenta').value = income.cuenta;
        document.getElementById('categoria').value = income.categoria || '';
        document.getElementById('fecha').value = income.fecha?.toDate?.().toISOString().split('T')[0] || income.fecha;
        
        if (income.imagen) {
            imagePreview.innerHTML = `<img src="${income.imagen}" alt="Preview">`;
        }
    } else {
        incomeForm.reset();
        imagePreview.innerHTML = '';
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('fecha').value = `${year}-${month}-${day}`;
    }
    
    incomeModal.classList.add('active');
}

function closeModalHandler() {
    incomeModal.classList.remove('active');
    incomeForm.reset();
    imagePreview.innerHTML = '';
    editingId = null;
}

// Image Preview
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

// Form Submit
incomeForm.addEventListener('submit', async (e) => {
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
            const existingIncome = allIncomes.find(i => i.id === editingId);
            imageUrl = existingIncome?.imagen || '';
        }
        
        const incomeData = {
            monto: parseInt(unformatNumber(document.getElementById('monto').value)),
            descripcion: document.getElementById('descripcion').value,
            cuenta: document.getElementById('cuenta').value,
            categoria: document.getElementById('categoria').value,
            fecha: Timestamp.fromDate(new Date(document.getElementById('fecha').value)),
            imagen: imageUrl
        };
        
        if (editingId) {
            await updateDoc(doc(db, 'ingresos', editingId), incomeData);
        } else {
            await addDoc(collection(db, 'ingresos'), incomeData);
            // Actualizar saldo de la cuenta
            await updateAccountBalance(incomeData.cuenta, incomeData.monto, 'add');
        }
        
        closeModalHandler();
        await loadIncomes();
    } catch (error) {
        console.error('Error saving income:', error);
        alert('Error al guardar el ingreso');
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        submitBtn.disabled = false;
    }
});

// Upload Image to ImgBB
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

// Load Incomes
async function loadIncomes() {
    try {
        const incomesSnap = await getDocs(collection(db, 'ingresos'));
        allIncomes = [];
        
        incomesSnap.forEach(doc => {
            const data = doc.data();
            allIncomes.push({ id: doc.id, ...data });
        });
        
        filterAndRenderIncomes();
    } catch (error) {
        console.error('Error loading incomes:', error);
    }
}

function renderIncomes(incomes) {
    const container = document.getElementById('incomesList');
    
    if (incomes.length === 0) {
        container.innerHTML = '<p class="no-data">No hay ingresos registrados</p>';
        return;
    }
    
    container.innerHTML = incomes.map(income => `
        <div class="income-item">
            <div class="item-header">
                <div class="item-amount">${formatCurrency(income.monto)}</div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="editIncome('${income.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteIncome('${income.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="item-description">${income.descripcion}</div>
            <div class="item-details">
                <div class="item-detail">
                    <i class="fas fa-credit-card"></i>
                    <span>${income.cuenta}</span>
                </div>
                ${income.categoria ? `
                <div class="item-detail">
                    <i class="fas fa-tag"></i>
                    <span>${income.categoria}</span>
                </div>
                ` : ''}
                <div class="item-detail">
                    <i class="fas fa-calendar"></i>
                    <span>${formatDate(income.fecha)}</span>
                </div>
            </div>
            ${income.imagen ? `
            <div class="item-image">
                <img src="${income.imagen}" alt="Comprobante" onclick="openImageModal('${income.imagen}')">
            </div>
            ` : ''}
        </div>
    `).join('');
}

// Filter and render
function filterAndRenderIncomes() {
    let filtered = allIncomes;
    
    // Filter by month
    if (selectedMonth) {
        filtered = filtered.filter(income => {
            const incomeDate = income.fecha?.toDate?.() || new Date(income.fecha);
            const incomeMonth = `${incomeDate.getFullYear()}-${String(incomeDate.getMonth() + 1).padStart(2, '0')}`;
            return incomeMonth === selectedMonth;
        });
    }
    
    // Filter by search
    const search = searchInput.value.toLowerCase();
    if (search) {
        filtered = filtered.filter(income => 
            income.descripcion.toLowerCase().includes(search) ||
            income.cuenta.toLowerCase().includes(search) ||
            (income.categoria && income.categoria.toLowerCase().includes(search))
        );
    }
    
    // Update total
    const total = filtered.reduce((sum, income) => sum + parseInt(income.monto || 0), 0);
    document.getElementById('totalIncome').textContent = formatCurrency(total);
    
    renderIncomes(filtered);
}

// Search
searchInput.addEventListener('input', () => {
    filterAndRenderIncomes();
});

// Edit Income
window.editIncome = (id) => {
    const income = allIncomes.find(i => i.id === id);
    if (income) {
        openModal(income);
    }
};

// Delete Income
window.deleteIncome = async (id) => {
    const confirmed = await showConfirm(
        '¿Eliminar ingreso?',
        'Esta acción no se puede deshacer. El ingreso será eliminado permanentemente.',
        'Eliminar'
    );
    
    if (confirmed) {
        try {
            await deleteDoc(doc(db, 'ingresos', id));
            await loadIncomes();
        } catch (error) {
            console.error('Error deleting income:', error);
        }
    }
};

// Load Accounts and Categories
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
            if (data.tipo === 'ingreso') {
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
                const newBalance = operation === 'add' 
                    ? currentBalance + amount 
                    : currentBalance - amount;
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

// Initialize
populateMonthFilter();
loadIncomes();
loadSelects();
