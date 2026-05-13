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
let valuesVisible = localStorage.getItem('valuesVisible') !== 'false'; // Default true

// Toggle visibility button
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
if (toggleVisibilityBtn) {
    updateVisibilityIcon();
    toggleVisibilityBtn.addEventListener('click', () => {
        valuesVisible = !valuesVisible;
        localStorage.setItem('valuesVisible', valuesVisible);
        updateVisibilityIcon();
        loadAccounts();
    });
}

function updateVisibilityIcon() {
    const icon = toggleVisibilityBtn?.querySelector('i');
    if (icon) {
        icon.className = valuesVisible ? 'fas fa-eye' : 'fas fa-eye-slash';
    }
}

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
        document.getElementById('llave').value = account.llave || '';
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
            llave: document.getElementById('llave').value,
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
            
            // Check if this account is hidden individually
            const isHidden = localStorage.getItem(`account_hidden_${account.id}`) === 'true';
            const displayValue = isHidden ? '••••••' : formatCurrency(account.saldo);
            const eyeIcon = isHidden ? 'fa-eye-slash' : 'fa-eye';
            
            card.innerHTML = `
                <div class="account-header">
                    <div class="account-icon">
                        <i class="${iconClass} fa-${account.icono || 'wallet'}"></i>
                    </div>
                    <div class="account-actions">
                        <button class="btn-icon-white" onclick="toggleAccountVisibility('${account.id}')" title="Ocultar/Mostrar saldo">
                            <i class="fas ${eyeIcon}" id="eye-${account.id}"></i>
                        </button>
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
                    ${account.descripcion ? `<div class="account-description">${account.descripcion}</div>` : ''}
                    <div class="account-balance" id="balance-${account.id}">${displayValue}</div>
                    ${account.llave ? `<div class="account-key-wrapper">
                        <span class="account-key-text">${account.llave}</span>
                        <button class="btn-copy-key" onclick="copyKey('${account.llave}', '${account.id}')" title="Copiar llave" id="copy-btn-${account.id}">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>` : ''}
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
    if (!valuesVisible) {
        return '••••••';
    }
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Toggle individual account visibility
window.toggleAccountVisibility = async (accountId) => {
    const isHidden = localStorage.getItem(`account_hidden_${accountId}`) === 'true';
    localStorage.setItem(`account_hidden_${accountId}`, !isHidden);
    
    // Update the UI
    const balanceElement = document.getElementById(`balance-${accountId}`);
    const eyeIcon = document.getElementById(`eye-${accountId}`);
    
    if (balanceElement && eyeIcon) {
        // Get the account data
        const accountsSnap = await getDocs(collection(db, 'cuentas'));
        let accountData = null;
        accountsSnap.forEach(doc => {
            if (doc.id === accountId) {
                accountData = doc.data();
            }
        });
        
        if (accountData) {
            if (!isHidden) {
                // Hide it
                balanceElement.textContent = '••••••';
                eyeIcon.className = 'fas fa-eye-slash';
            } else {
                // Show it
                balanceElement.textContent = formatCurrency(accountData.saldo);
                eyeIcon.className = 'fas fa-eye';
            }
        }
    }
};

// Copy key to clipboard
window.copyKey = async (key, accountId) => {
    try {
        await navigator.clipboard.writeText(key);
        
        // Show visual feedback on button
        const copyBtn = document.getElementById(`copy-btn-${accountId}`);
        if (copyBtn) {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.style.background = 'rgba(34, 197, 94, 0.3)';
            copyBtn.style.borderColor = 'rgba(34, 197, 94, 0.5)';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.background = '';
                copyBtn.style.borderColor = '';
            }, 1500);
        }
    } catch (error) {
        console.error('Error copying key:', error);
        alert('No se pudo copiar la llave');
    }
};

loadAccounts();



// Distribution Config
const DISTRIBUTION_CONFIG_KEY = 'distributionConfig';
const btnConfigDistribution = document.getElementById('btnConfigDistribution');
const distributionConfigModal = document.getElementById('distributionConfigModal');
const closeDistConfigModal = document.getElementById('closeDistConfigModal');
const cancelDistConfigBtn = document.getElementById('cancelDistConfigBtn');
const saveDistConfigBtn = document.getElementById('saveDistConfigBtn');

function getDistConfig() {
    const c = localStorage.getItem(DISTRIBUTION_CONFIG_KEY);
    return c ? JSON.parse(c) : { supervivencia: '', empresa: '', ahorro: '', libre: '' };
}

function saveDistConfigFn(config) { localStorage.setItem(DISTRIBUTION_CONFIG_KEY, JSON.stringify(config)); }

function updateDistributionDisplay() {
    const config = getDistConfig();
    document.getElementById('distAccountSupervivencia').textContent = config.supervivencia || 'Sin asignar';
    document.getElementById('distAccountEmpresa').textContent = config.empresa || 'Sin asignar';
    document.getElementById('distAccountAhorro').textContent = config.ahorro || 'Sin asignar';
    document.getElementById('distAccountLibre').textContent = config.libre || 'Sin asignar';
}

btnConfigDistribution.addEventListener('click', async () => {
    try {
        const accountsSnap = await getDocs(collection(db, 'cuentas'));
        const accounts = [];
        accountsSnap.forEach(d => accounts.push(d.data().nombre));

        const selects = ['distCuentaSupervivencia', 'distCuentaEmpresa', 'distCuentaAhorro', 'distCuentaLibre'];
        selects.forEach(id => {
            const sel = document.getElementById(id);
            sel.innerHTML = '<option value="">Seleccionar cuenta</option>';
            accounts.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name; opt.textContent = name;
                sel.appendChild(opt);
            });
        });

        const config = getDistConfig();
        document.getElementById('distCuentaSupervivencia').value = config.supervivencia || '';
        document.getElementById('distCuentaEmpresa').value = config.empresa || '';
        document.getElementById('distCuentaAhorro').value = config.ahorro || '';
        document.getElementById('distCuentaLibre').value = config.libre || '';
    } catch (error) { console.error('Error loading dist config:', error); }
    distributionConfigModal.classList.add('active');
});

closeDistConfigModal.addEventListener('click', () => distributionConfigModal.classList.remove('active'));
cancelDistConfigBtn.addEventListener('click', () => distributionConfigModal.classList.remove('active'));
distributionConfigModal.addEventListener('click', (e) => { if (e.target === distributionConfigModal) distributionConfigModal.classList.remove('active'); });

saveDistConfigBtn.addEventListener('click', () => {
    const config = {
        supervivencia: document.getElementById('distCuentaSupervivencia').value,
        empresa: document.getElementById('distCuentaEmpresa').value,
        ahorro: document.getElementById('distCuentaAhorro').value,
        libre: document.getElementById('distCuentaLibre').value
    };
    saveDistConfigFn(config);
    updateDistributionDisplay();
    distributionConfigModal.classList.remove('active');
});

updateDistributionDisplay();
