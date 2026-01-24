import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showConfirm } from './confirm-modal.js';

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebarClose');
const btnNewAccount = document.getElementById('btnNewAccount');
const accountModal = document.getElementById('accountModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const accountForm = document.getElementById('accountForm');
const saldoInput = document.getElementById('saldo');
const iconSelector = document.getElementById('iconSelector');
const colorSelector = document.getElementById('colorSelector');
const iconInput = document.getElementById('icono');
const colorInput = document.getElementById('color');

let editingId = null;

// Sidebar toggle
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

// Format number with thousands separator
function formatNumber(value) {
    const number = value.replace(/\D/g, '');
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function unformatNumber(value) {
    return value.replace(/,/g, '');
}

// Format saldo input in real-time
saldoInput.addEventListener('input', (e) => {
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

// Color selector
colorSelector.addEventListener('click', (e) => {
    const option = e.target.closest('.color-option');
    if (option) {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        colorInput.value = option.dataset.color;
    }
});

btnNewAccount.addEventListener('click', () => {
    openModal();
});

closeModal.addEventListener('click', () => {
    closeModalHandler();
});

cancelBtn.addEventListener('click', () => {
    closeModalHandler();
});

accountModal.addEventListener('click', (e) => {
    if (e.target === accountModal) {
        closeModalHandler();
    }
});

function openModal(account = null) {
    editingId = account?.id || null;
    document.getElementById('modalTitle').textContent = account ? 'Editar Cuenta' : 'Nueva Cuenta';
    
    // Reset selections
    document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
    
    if (account) {
        document.getElementById('nombre').value = account.nombre;
        document.getElementById('tipo').value = account.tipo;
        document.getElementById('saldo').value = formatNumber(String(Math.round(account.saldo)));
        document.getElementById('descripcion').value = account.descripcion || '';
        
        // Select icon
        const iconOption = document.querySelector(`.icon-option[data-icon="${account.icono || 'wallet'}"]`);
        if (iconOption) {
            iconOption.classList.add('selected');
            iconInput.value = account.icono || 'wallet';
        }
        
        // Select color
        const colorOption = document.querySelector(`.color-option[data-color="${account.color || '#000000'}"]`);
        if (colorOption) {
            colorOption.classList.add('selected');
            colorInput.value = account.color || '#000000';
        }
    } else {
        accountForm.reset();
        // Select default icon and color
        const defaultIcon = document.querySelector('.icon-option[data-icon="wallet"]');
        const defaultColor = document.querySelector('.color-option[data-color="#000000"]');
        if (defaultIcon) {
            defaultIcon.classList.add('selected');
            iconInput.value = 'wallet';
        }
        if (defaultColor) {
            defaultColor.classList.add('selected');
            colorInput.value = '#000000';
        }
    }
    
    accountModal.classList.add('active');
}

function closeModalHandler() {
    accountModal.classList.remove('active');
    accountForm.reset();
    editingId = null;
}

accountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const accountData = {
            nombre: document.getElementById('nombre').value,
            tipo: document.getElementById('tipo').value,
            saldo: parseInt(unformatNumber(document.getElementById('saldo').value)),
            descripcion: document.getElementById('descripcion').value,
            icono: document.getElementById('icono').value || 'wallet',
            color: document.getElementById('color').value || '#000000'
        };
        
        if (editingId) {
            await updateDoc(doc(db, 'cuentas', editingId), accountData);
        } else {
            await addDoc(collection(db, 'cuentas'), accountData);
        }
        
        closeModalHandler();
        await loadAccounts();
    } catch (error) {
        console.error('Error saving account:', error);
        alert('Error al guardar la cuenta');
    }
});

async function loadAccounts() {
    try {
        const accountsSnap = await getDocs(collection(db, 'cuentas'));
        const container = document.getElementById('accountsGrid');
        
        if (accountsSnap.empty) {
            container.innerHTML = '<p class="no-data">No hay cuentas registradas</p>';
            return;
        }
        
        // Convert to array and sort by balance (highest first)
        const accounts = [];
        accountsSnap.forEach(doc => {
            accounts.push({ id: doc.id, ...doc.data() });
        });
        
        accounts.sort((a, b) => (b.saldo || 0) - (a.saldo || 0));
        
        container.innerHTML = '';
        accounts.forEach(account => {
            const card = document.createElement('div');
            card.className = 'account-card';
            
            // Convert hex color to rgba for glassmorphism effect
            const hexToRgba = (hex, alpha) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };
            
            const color = account.color || '#000000';
            const rgba1 = hexToRgba(color, 0.25);
            const rgba2 = hexToRgba(color, 0.15);
            
            card.style.background = `linear-gradient(135deg, ${rgba1} 0%, ${rgba2} 100%)`;
            card.style.borderColor = hexToRgba(color, 0.4);
            card.style.boxShadow = `0 8px 32px ${hexToRgba(color, 0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`;
            
            // Determine icon class (brands or solid)
            const brandIcons = ['paypal', 'bitcoin', 'ethereum', 'cc-visa', 'cc-mastercard', 'cc-amex', 'google-pay', 'apple-pay', 'stripe', 'amazon-pay', 'google-wallet', 'cc-discover', 'cc-diners-club', 'cc-jcb'];
            const iconClass = brandIcons.includes(account.icono) ? 'fab' : 'fas';
            
            card.innerHTML = `
                <div class="account-header">
                    <div class="account-icon">
                        <i class="${iconClass} fa-${account.icono || 'wallet'}"></i>
                    </div>
                    <div class="account-actions">
                        <button class="btn-icon-white" onclick="editAccount('${account.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon-white" onclick="deleteAccount('${account.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="account-info">
                    <div class="account-type">${account.tipo}</div>
                    <div class="account-name">${account.nombre}</div>
                    <div class="account-balance">${formatCurrency(account.saldo)}</div>
                    ${account.descripcion ? `<div class="account-description">${account.descripcion}</div>` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading accounts:', error);
    }
}

function adjustColor(color, amount) {
    const clamp = (val) => Math.min(Math.max(val, 0), 255);
    const num = parseInt(color.replace('#', ''), 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00FF) + amount);
    const b = clamp((num & 0x0000FF) + amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

window.editAccount = async (id) => {
    try {
        const accountsSnap = await getDocs(collection(db, 'cuentas'));
        let account = null;
        accountsSnap.forEach(doc => {
            if (doc.id === id) {
                account = { id: doc.id, ...doc.data() };
            }
        });
        if (account) {
            openModal(account);
        }
    } catch (error) {
        console.error('Error loading account:', error);
    }
};

window.deleteAccount = async (id) => {
    const confirmed = await showConfirm(
        '¿Eliminar cuenta?',
        'Esta acción no se puede deshacer. La cuenta será eliminada permanentemente.',
        'Eliminar'
    );
    
    if (confirmed) {
        try {
            await deleteDoc(doc(db, 'cuentas', id));
            await loadAccounts();
        } catch (error) {
            console.error('Error deleting account:', error);
        }
    }
};

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

loadAccounts();


