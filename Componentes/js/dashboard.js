import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Menu Toggle
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

// Close sidebar on mobile when clicking outside
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar) {
        if (!sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

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
    loadDashboard();
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
        const [incomesSnap, expensesSnap, accountsSnap, investmentsSnap] = await Promise.all([
            getDocs(collection(db, 'ingresos')),
            getDocs(collection(db, 'gastos')),
            getDocs(collection(db, 'cuentas')),
            getDocs(collection(db, 'inversiones'))
        ]);

        let totalIncome = 0;
        let totalExpense = 0;
        let totalBalance = 0;
        let totalInvestments = 0;

        incomesSnap.forEach(doc => {
            const data = doc.data();
            // Filter by month if selected
            if (selectedMonth) {
                const incomeDate = data.fecha?.toDate?.() || new Date(data.fecha);
                const incomeMonth = `${incomeDate.getFullYear()}-${String(incomeDate.getMonth() + 1).padStart(2, '0')}`;
                if (incomeMonth === selectedMonth) {
                    totalIncome += parseInt(data.monto || 0);
                }
            } else {
                totalIncome += parseInt(data.monto || 0);
            }
        });

        expensesSnap.forEach(doc => {
            const data = doc.data();
            // Filter by month if selected
            if (selectedMonth) {
                const expenseDate = data.fecha?.toDate?.() || new Date(data.fecha);
                const expenseMonth = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}`;
                if (expenseMonth === selectedMonth) {
                    totalExpense += parseInt(data.monto || 0);
                }
            } else {
                totalExpense += parseInt(data.monto || 0);
            }
        });

        accountsSnap.forEach(doc => {
            const saldo = parseInt(doc.data().saldo || 0);
            totalBalance += saldo;
        });

        // Calculate total investments
        investmentsSnap.forEach(doc => {
            const data = doc.data();
            // Filter by month if selected
            if (selectedMonth) {
                const investmentDate = data.fecha?.toDate?.() || new Date(data.fecha);
                const investmentMonth = `${investmentDate.getFullYear()}-${String(investmentDate.getMonth() + 1).padStart(2, '0')}`;
                if (investmentMonth === selectedMonth) {
                    totalInvestments += parseInt(data.monto || 0);
                }
            } else {
                totalInvestments += parseInt(data.monto || 0);
            }
        });

        document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
        document.getElementById('totalIncome').textContent = formatCurrency(totalIncome);
        document.getElementById('totalExpense').textContent = formatCurrency(totalExpense);
        
        // Update investments if element exists
        const investmentsElement = document.getElementById('totalInvestments');
        if (investmentsElement) {
            investmentsElement.textContent = formatCurrency(totalInvestments);
        }
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

async function loadRecentTransactions() {
    try {
        const container = document.getElementById('recentTransactions');
        const transactions = [];

        const [incomesSnap, expensesSnap, investmentsSnap] = await Promise.all([
            getDocs(collection(db, 'ingresos')),
            getDocs(collection(db, 'gastos')),
            getDocs(collection(db, 'inversiones'))
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

        // Add investments to transactions
        investmentsSnap.forEach(doc => {
            const data = doc.data();
            transactions.push({
                ...data,
                id: doc.id,
                type: 'investment'
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
                    <i class="fas fa-${t.type === 'income' ? 'arrow-up' : t.type === 'expense' ? 'arrow-down' : 'chart-line'}"></i>
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
populateMonthFilter();
loadDashboard();
