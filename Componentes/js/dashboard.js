import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Menu Toggle
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');

menuToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('active');
});

// Close sidebar on mobile when clicking outside
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

// Load Dashboard Data
async function loadDashboard() {
    try {
        await Promise.all([
            loadSummary(),
            loadRecentTransactions(),
            loadAccounts()
        ]);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadSummary() {
    try {
        const [incomesSnap, expensesSnap, accountsSnap] = await Promise.all([
            getDocs(collection(db, 'ingresos')),
            getDocs(collection(db, 'gastos')),
            getDocs(collection(db, 'cuentas'))
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        let totalBalance = 0;

        console.log('Ingresos encontrados:', incomesSnap.size);
        console.log('Gastos encontrados:', expensesSnap.size);
        console.log('Cuentas encontradas:', accountsSnap.size);

        incomesSnap.forEach(doc => {
            const monto = parseInt(doc.data().monto || 0);
            totalIncome += monto;
        });

        expensesSnap.forEach(doc => {
            const monto = parseInt(doc.data().monto || 0);
            totalExpense += monto;
        });

        accountsSnap.forEach(doc => {
            const saldo = parseInt(doc.data().saldo || 0);
            totalBalance += saldo;
        });

        console.log('Total Ingresos:', totalIncome);
        console.log('Total Gastos:', totalExpense);
        console.log('Balance Total (suma de cuentas):', totalBalance);

        document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
        document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
        document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

async function loadRecentTransactions() {
    try {
        const container = document.getElementById('recentTransactions');
        const transactions = [];

        const [incomesSnap, expensesSnap] = await Promise.all([
            getDocs(collection(db, 'ingresos')),
            getDocs(collection(db, 'gastos'))
        ]);

        incomesSnap.forEach(doc => {
            transactions.push({
                ...doc.data(),
                id: doc.id,
                type: 'income'
            });
        });

        expensesSnap.forEach(doc => {
            transactions.push({
                ...doc.data(),
                id: doc.id,
                type: 'expense'
            });
        });

        transactions.sort((a, b) => {
            const dateA = a.fecha?.toDate?.() || new Date(a.fecha);
            const dateB = b.fecha?.toDate?.() || new Date(b.fecha);
            return dateB - dateA;
        });

        const recent = transactions.slice(0, 5);

        if (recent.length === 0) {
            container.innerHTML = '<p class="no-data">No hay transacciones recientes</p>';
            return;
        }

        container.innerHTML = recent.map(t => `
            <div class="transaction-item">
                <div class="transaction-icon ${t.type}">
                    <i class="fas fa-arrow-${t.type === 'income' ? 'up' : 'down'}"></i>
                </div>
                <div class="transaction-details">
                    <h4>${t.descripcion || 'Sin descripción'}</h4>
                    <p>${formatDate(t.fecha)} • ${t.cuenta || 'Sin cuenta'}</p>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.monto)}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

async function loadAccounts() {
    try {
        const container = document.getElementById('accountsGrid');
        const accountsSnap = await getDocs(collection(db, 'cuentas'));

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
            card.style.background = `linear-gradient(135deg, ${account.color || '#000000'} 0%, ${adjustColor(account.color || '#000000', -20)} 100%)`;
            
            // Determine icon class (brands or solid)
            const brandIcons = ['paypal', 'bitcoin', 'ethereum', 'cc-visa', 'cc-mastercard', 'cc-amex', 'google-pay', 'apple-pay', 'stripe', 'amazon-pay', 'google-wallet', 'cc-discover', 'cc-diners-club', 'cc-jcb'];
            const iconClass = brandIcons.includes(account.icono) ? 'fab' : 'fas';
            
            card.innerHTML = `
                <div class="account-icon-dash">
                    <i class="${iconClass} fa-${account.icono || 'wallet'}"></i>
                </div>
                <h4>${account.nombre}</h4>
                <div class="account-balance">${formatCurrency(account.saldo || 0)}</div>
                <div class="account-type">${account.tipo || 'Cuenta'}</div>
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
        month: 'short', 
        day: 'numeric' 
    });
}

// Initialize
loadDashboard();
