import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showConfirm } from './confirm-modal.js';
import { showToast } from './toast-notification.js';

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const btnNewCategory = document.getElementById('btnNewCategory');
const categoryModal = document.getElementById('categoryModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const categoryForm = document.getElementById('categoryForm');
const iconSelector = document.getElementById('iconSelector');
const iconInput = document.getElementById('icono');
const montoPredefinidoInput = document.getElementById('montoPredefinido');

let editingId = null;

// Format number with thousands separator
function formatNumber(value) {
    const number = value.replace(/\D/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function unformatNumber(value) {
    return value.replace(/,/g, '');
}

// Format monto predefinido input in real-time
montoPredefinidoInput.addEventListener('input', (e) => {
    const cursorPosition = e.target.selectionStart;
    const oldLength = e.target.value.length;
    const unformatted = unformatNumber(e.target.value);
    const formatted = formatNumber(unformatted);
    e.target.value = formatted;
    
    const newLength = formatted.length;
    const diff = newLength - oldLength;
    e.target.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
});

// Icon selector
iconSelector.addEventListener('click', (e) => {
    const option = e.target.closest('.icon-option');
    if (option) {
        document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        iconInput.value = option.dataset.icon;
    }
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

btnNewCategory.addEventListener('click', () => {
    openModal();
});

closeModal.addEventListener('click', () => {
    closeModalHandler();
});

cancelBtn.addEventListener('click', () => {
    closeModalHandler();
});

categoryModal.addEventListener('click', (e) => {
    if (e.target === categoryModal) {
        closeModalHandler();
    }
});

function openModal(category = null) {
    editingId = category?.id || null;
    document.getElementById('modalTitle').textContent = category ? 'Editar Categoría' : 'Nueva Categoría';
    
    // Reset icon selection
    document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
    
    if (category) {
        document.getElementById('nombre').value = category.nombre;
        document.getElementById('tipo').value = category.tipo;
        document.getElementById('descripcion').value = category.descripcion || '';
        
        if (category.montoPredefinido) {
            document.getElementById('montoPredefinido').value = formatNumber(String(category.montoPredefinido));
        }
        
        // Select icon
        const iconOption = document.querySelector(`.icon-option[data-icon="${category.icono || 'tag'}"]`);
        if (iconOption) {
            iconOption.classList.add('selected');
            iconInput.value = category.icono || 'tag';
        }
    } else {
        categoryForm.reset();
        // Select default icon
        const defaultIcon = document.querySelector('.icon-option[data-icon="tag"]');
        if (defaultIcon) {
            defaultIcon.classList.add('selected');
            iconInput.value = 'tag';
        }
    }
    
    categoryModal.classList.add('active');
}

function closeModalHandler() {
    categoryModal.classList.remove('active');
    categoryForm.reset();
    editingId = null;
}

categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const montoPredefinidoValue = unformatNumber(document.getElementById('montoPredefinido').value);
        
        const categoryData = {
            nombre: document.getElementById('nombre').value,
            tipo: document.getElementById('tipo').value,
            icono: document.getElementById('icono').value || 'tag',
            descripcion: document.getElementById('descripcion').value,
            montoPredefinido: montoPredefinidoValue ? parseInt(montoPredefinidoValue) : 0
        };
        
        if (editingId) {
            await updateDoc(doc(db, 'categorias', editingId), categoryData);
        } else {
            await addDoc(collection(db, 'categorias'), categoryData);
        }
        
        closeModalHandler();
        await loadCategories();
        showToast('Categoría guardada exitosamente', 'success');
    } catch (error) {
        console.error('Error saving category:', error);
        showToast('Error al guardar la categoría', 'error');
    }
});

async function loadCategories() {
    try {
        const categoriesSnap = await getDocs(collection(db, 'categorias'));
        const incomeContainer = document.getElementById('incomeCategories');
        const expenseContainer = document.getElementById('expenseCategories');
        
        const incomeCategories = [];
        const expenseCategories = [];
        
        categoriesSnap.forEach(doc => {
            const category = { id: doc.id, ...doc.data() };
            if (category.tipo === 'ingreso') {
                incomeCategories.push(category);
            } else {
                expenseCategories.push(category);
            }
        });
        
        renderCategories(incomeCategories, incomeContainer, 'income');
        renderCategories(expenseCategories, expenseContainer, 'expense');
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

function renderCategories(categories, container, type) {
    if (categories.length === 0) {
        container.innerHTML = `<p class="no-data">No hay categorías de ${type === 'income' ? 'ingresos' : 'gastos'}</p>`;
        return;
    }
    
    container.innerHTML = categories.map(category => `
        <div class="category-card ${type}">
            <div class="category-header">
                <div class="category-icon">
                    <i class="fas fa-${category.icono || 'tag'}"></i>
                </div>
                <div class="category-actions">
                    <button class="btn-icon-small" onclick="editCategory('${category.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon-small delete" onclick="deleteCategory('${category.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="category-name">${category.nombre}</div>
            ${category.montoPredefinido ? `<div class="category-amount">${formatCurrency(category.montoPredefinido)}</div>` : ''}
            ${category.descripcion ? `<div class="category-description">${category.descripcion}</div>` : ''}
            <div class="category-type ${type}">${type === 'income' ? 'Ingreso' : 'Gasto'}</div>
        </div>
    `).join('');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

window.editCategory = async (id) => {
    try {
        const categoriesSnap = await getDocs(collection(db, 'categorias'));
        let category = null;
        categoriesSnap.forEach(doc => {
            if (doc.id === id) {
                category = { id: doc.id, ...doc.data() };
            }
        });
        if (category) {
            openModal(category);
        }
    } catch (error) {
        console.error('Error loading category:', error);
    }
};

window.deleteCategory = async (id) => {
    const confirmed = await showConfirm(
        '¿Eliminar categoría?',
        'Esta acción no se puede deshacer. La categoría será eliminada permanentemente.',
        'Eliminar'
    );
    
    if (confirmed) {
        try {
            await deleteDoc(doc(db, 'categorias', id));
            await loadCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
        }
    }
};

loadCategories();


