import { db, IMGBB_API_KEY } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showConfirm } from './confirm-modal.js';

const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarClose = document.getElementById('sidebarClose');
const btnNewIncome = document.getElementById('btnNewIncome');
const incomeModal = document.getElementById('incomeModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const incomeForm = document.getElementById('incomeForm');
const searchInput = document.getElementById('searchInput');
const imageInput = document.getElementById('imagen');
const imagePreview = document.getElementById('imagePreview');
const montoInput = document.getElementById('monto');
const monthFilter = document.getElementById('monthFilter');
const yearFilter = document.getElementById('yearFilter');
const btnConfigDistribution = null;
const distributionConfigModal = null;
const closeDistConfigModal = null;
const cancelDistConfigBtn = null;
const saveDistConfigBtn = null;
const distributionPreviewModal = document.getElementById('distributionPreviewModal');
const closeDistPreviewModal = document.getElementById('closeDistPreviewModal');
const cancelDistPreviewBtn = document.getElementById('cancelDistPreviewBtn');
const confirmDistBtn = document.getElementById('confirmDistBtn');

let allIncomes = [];
let editingId = null;
let selectedMonth = '';
let selectedYear = new Date().getFullYear();
let pendingIncomeData = null;

const DISTRIBUTION_CONFIG_KEY = 'distributionConfig';
const DIST = { supervivencia: 0.40, empresa: 0.35, ahorro: 0.15, libre: 0.10 };

function getDistConfig() {
    const c = localStorage.getItem(DISTRIBUTION_CONFIG_KEY);
    return c ? JSON.parse(c) : { supervivencia: '', empresa: '', ahorro: '', libre: '' };
}
function saveDistConfig(config) { localStorage.setItem(DISTRIBUTION_CONFIG_KEY, JSON.stringify(config)); }

// Sidebar
if (menuToggle && sidebar) { menuToggle.addEventListener('click', () => sidebar.classList.toggle('active')); }
if (sidebarClose && sidebar) { sidebarClose.addEventListener('click', () => sidebar.classList.remove('active')); }
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar && !sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

// Year/Month filters
function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 2020; year--) {
        const opt = document.createElement('option');
        opt.value = year; opt.textContent = year;
        yearFilter.appendChild(opt);
    }
    yearFilter.value = currentYear; selectedYear = currentYear;
}

function populateMonthFilter() {
    const now = new Date();
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    monthFilter.innerHTML = '<option value="">Todos los meses</option>';
    const year = parseInt(selectedYear);
    const maxMonth = (year === now.getFullYear()) ? now.getMonth() : 11;
    for (let i = 0; i <= maxMonth; i++) {
        const val = `${year}-${String(i+1).padStart(2,'0')}`;
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = `${months[i]} ${year}`;
        monthFilter.appendChild(opt);
    }
    if (year === now.getFullYear()) {
        selectedMonth = `${year}-${String(now.getMonth()+1).padStart(2,'0')}`;
        monthFilter.value = selectedMonth;
    }
}

yearFilter.addEventListener('change', (e) => { selectedYear = e.target.value || new Date().getFullYear(); populateMonthFilter(); filterAndRenderIncomes(); });
monthFilter.addEventListener('change', (e) => { selectedMonth = e.target.value; filterAndRenderIncomes(); });

// Format
function formatNumber(value) { const n = value.replace(/\D/g, ''); return n.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function unformatNumber(value) { return value.replace(/,/g, ''); }

montoInput.addEventListener('input', (e) => {
    const pos = e.target.selectionStart;
    const oldLen = e.target.value.length;
    e.target.value = formatNumber(unformatNumber(e.target.value));
    const diff = e.target.value.length - oldLen;
    e.target.setSelectionRange(pos + diff, pos + diff);
});

// Modal
btnNewIncome.addEventListener('click', () => openModal());
closeModal.addEventListener('click', () => closeModalHandler());
cancelBtn.addEventListener('click', () => closeModalHandler());
incomeModal.addEventListener('click', (e) => { if (e.target === incomeModal) closeModalHandler(); });

function openModal(income = null) {
    editingId = income?.id || null;
    document.getElementById('modalTitle').textContent = income ? 'Editar Ingreso' : 'Nuevo Ingreso';
    const distToggle = document.getElementById('distToggleContainer');
    if (income) {
        document.getElementById('monto').value = formatNumber(String(Math.round(income.monto)));
        document.getElementById('descripcion').value = income.descripcion;
        document.getElementById('categoria').value = income.categoria || '';
        document.getElementById('fecha').value = income.fecha?.toDate?.().toISOString().split('T')[0] || income.fecha;
        if (income.imagen) imagePreview.innerHTML = `<img src="${income.imagen}" alt="Preview">`;
        distToggle.style.display = 'none';
    } else {
        incomeForm.reset(); imagePreview.innerHTML = '';
        const t = new Date();
        document.getElementById('fecha').value = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
        const config = getDistConfig();
        const hasConfig = config.supervivencia || config.empresa || config.ahorro || config.libre;
        distToggle.style.display = hasConfig ? 'flex' : 'none';
        document.getElementById('distributeToggle').checked = true;
    }
    incomeModal.classList.add('active');
}

function closeModalHandler() { incomeModal.classList.remove('active'); incomeForm.reset(); imagePreview.innerHTML = ''; editingId = null; capturedImageData = null; stopCamera(); }

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) { const r = new FileReader(); r.onload = (ev) => { imagePreview.innerHTML = `<div class="preview-wrapper"><img src="${ev.target.result}" alt="Preview"><button type="button" class="btn-remove-image" onclick="removeImagePreview()"><i class="fas fa-times"></i></button></div>`; }; r.readAsDataURL(file); }
});

// Camera functionality
const btnTakePhoto = document.getElementById('btnTakePhoto');
const btnSelectGallery = document.getElementById('btnSelectGallery');
const cameraContainer = document.getElementById('cameraContainer');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');
const btnCameraCapture = document.getElementById('btnCameraCapture');
const btnCameraCancel = document.getElementById('btnCameraCancel');
const btnCameraSwitch = document.getElementById('btnCameraSwitch');

let cameraStream = null;
let facingMode = 'environment';
let capturedImageData = null;

btnSelectGallery.addEventListener('click', () => imageInput.click());

btnTakePhoto.addEventListener('click', async () => {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        cameraVideo.srcObject = cameraStream;
        cameraContainer.style.display = 'block';
    } catch (err) {
        // Fallback to file input with capture
        imageInput.setAttribute('capture', 'environment');
        imageInput.click();
        imageInput.removeAttribute('capture');
    }
});

btnCameraCapture.addEventListener('click', () => {
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    const ctx = cameraCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0);
    capturedImageData = cameraCanvas.toDataURL('image/jpeg', 0.85);
    imagePreview.innerHTML = `<div class="preview-wrapper"><img src="${capturedImageData}" alt="Preview"><button type="button" class="btn-remove-image" onclick="removeImagePreview()"><i class="fas fa-times"></i></button></div>`;
    stopCamera();
});

btnCameraCancel.addEventListener('click', () => stopCamera());

btnCameraSwitch.addEventListener('click', async () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    stopCamera();
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        cameraVideo.srcObject = cameraStream;
        cameraContainer.style.display = 'block';
    } catch (err) { console.error('Error switching camera:', err); }
});

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    cameraContainer.style.display = 'none';
}

window.removeImagePreview = () => {
    imagePreview.innerHTML = '';
    imageInput.value = '';
    capturedImageData = null;
};

// Form Submit
incomeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    const submitBtn = document.getElementById('submitBtn');
    btnText.style.display = 'none'; btnLoader.style.display = 'inline-block'; submitBtn.disabled = true;

    try {
        let imageUrl = '';
        if (capturedImageData) {
            // Convert base64 to blob for upload
            const blob = await fetch(capturedImageData).then(r => r.blob());
            const file = new File([blob], 'camera_photo.jpg', { type: 'image/jpeg' });
            imageUrl = await uploadImage(file);
        } else if (imageInput.files[0]) { imageUrl = await uploadImage(imageInput.files[0]); }
        else if (editingId) { imageUrl = allIncomes.find(i => i.id === editingId)?.imagen || ''; }

        const fechaInput = document.getElementById('fecha').value;
        const [año, mes, dia] = fechaInput.split('-').map(Number);
        const fechaLocal = new Date(año, mes - 1, dia, 12, 0, 0);

        const incomeData = {
            monto: parseInt(unformatNumber(document.getElementById('monto').value)),
            descripcion: document.getElementById('descripcion').value,
            cuenta: '',
            categoria: document.getElementById('categoria').value,
            fecha: Timestamp.fromDate(fechaLocal),
            imagen: imageUrl
        };

        if (editingId) {
            await updateDoc(doc(db, 'ingresos', editingId), incomeData);
            closeModalHandler(); await loadIncomes();
        } else {
            const config = getDistConfig();
            const hasConfig = config.supervivencia || config.empresa || config.ahorro || config.libre;
            const shouldDistribute = document.getElementById('distributeToggle').checked;
            if (hasConfig && shouldDistribute) {
                pendingIncomeData = incomeData;
                closeModalHandler();
                showDistributionPreview(incomeData.monto);
            } else {
                // If not distributing, add to first configured account or just save
                const config = getDistConfig();
                const firstAccount = config.supervivencia || config.empresa || config.ahorro || config.libre || '';
                incomeData.cuenta = firstAccount;
                await addDoc(collection(db, 'ingresos'), incomeData);
                if (firstAccount) await updateAccountBalance(firstAccount, incomeData.monto, 'add');
                closeModalHandler(); await loadIncomes();
            }
        }
    } catch (error) { console.error('Error saving income:', error); alert('Error al guardar el ingreso'); }
    finally { btnText.style.display = 'inline'; btnLoader.style.display = 'none'; submitBtn.disabled = false; }
});

// Upload Image
async function uploadImage(file) {
    const formData = new FormData(); formData.append('image', file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) return data.data.url;
    throw new Error('Error uploading image');
}

// Distribution Preview
function showDistributionPreview(monto) {
    const config = getDistConfig();
    const previewList = document.getElementById('distPreviewList');
    document.getElementById('distPreviewTotal').textContent = formatCurrency(monto);

    const items = [
        { key: 'supervivencia', label: 'Supervivencia', icon: 'fa-shield-alt', color: '#3b82f6', pct: DIST.supervivencia },
        { key: 'empresa', label: 'Empresa', icon: 'fa-briefcase', color: '#f59e0b', pct: DIST.empresa },
        { key: 'ahorro', label: 'Ahorro', icon: 'fa-piggy-bank', color: '#10b981', pct: DIST.ahorro },
        { key: 'libre', label: 'Libre', icon: 'fa-star', color: '#a855f7', pct: DIST.libre }
    ];

    previewList.innerHTML = items.map(item => {
        const amount = Math.round(monto * item.pct);
        const account = config[item.key] || 'No asignada';
        return `
            <div class="dist-preview-item">
                <div class="dist-preview-item-left">
                    <div class="dist-preview-item-icon" style="background: ${item.color}20; color: ${item.color};">
                        <i class="fas ${item.icon}"></i>
                    </div>
                    <div class="dist-preview-item-info">
                        <h5>${item.label} (${item.pct * 100}%)</h5>
                        <span><i class="fas fa-credit-card"></i> ${account}</span>
                    </div>
                </div>
                <div class="dist-preview-item-amount" style="color: ${item.color};">${formatCurrency(amount)}</div>
            </div>
        `;
    }).join('');

    distributionPreviewModal.classList.add('active');
}

// Confirm distribution
confirmDistBtn.addEventListener('click', async () => {
    if (!pendingIncomeData) return;
    confirmDistBtn.disabled = true;
    confirmDistBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

    try {
        const config = getDistConfig();
        const monto = pendingIncomeData.monto;

        // Save the main income record
        await addDoc(collection(db, 'ingresos'), pendingIncomeData);

        // Distribute to accounts
        const distributions = [
            { key: 'supervivencia', pct: DIST.supervivencia },
            { key: 'empresa', pct: DIST.empresa },
            { key: 'ahorro', pct: DIST.ahorro },
            { key: 'libre', pct: DIST.libre }
        ];

        for (const dist of distributions) {
            const accountName = config[dist.key];
            if (accountName) {
                const amount = Math.round(monto * dist.pct);
                await updateAccountBalance(accountName, amount, 'add');
            }
        }

        distributionPreviewModal.classList.remove('active');
        pendingIncomeData = null;
        await loadIncomes();
    } catch (error) {
        console.error('Error distributing income:', error);
        alert('Error al distribuir el ingreso');
    } finally {
        confirmDistBtn.disabled = false;
        confirmDistBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar y Distribuir';
    }
});

closeDistPreviewModal.addEventListener('click', () => { distributionPreviewModal.classList.remove('active'); pendingIncomeData = null; });
cancelDistPreviewBtn.addEventListener('click', () => { distributionPreviewModal.classList.remove('active'); pendingIncomeData = null; });
distributionPreviewModal.addEventListener('click', (e) => { if (e.target === distributionPreviewModal) { distributionPreviewModal.classList.remove('active'); pendingIncomeData = null; } });

// Distribution display (config is managed from Cuentas page)
function updateDistributionDisplay() {
    // No-op in ingresos, config is in cuentas
}

// Load Incomes
async function loadIncomes() {
    try {
        const incomesSnap = await getDocs(collection(db, 'ingresos'));
        allIncomes = [];
        incomesSnap.forEach(d => allIncomes.push({ id: d.id, ...d.data() }));
        filterAndRenderIncomes();
    } catch (error) { console.error('Error loading incomes:', error); }
}

function renderIncomes(incomes) {
    const container = document.getElementById('incomesList');
    if (incomes.length === 0) { container.innerHTML = '<p class="no-data">No hay ingresos registrados</p>'; return; }

    container.innerHTML = incomes.map(income => `
        <div class="income-item">
            <div class="item-top">
                <div class="item-amount">${formatCurrency(income.monto)}</div>
                <div class="item-actions">
                    <button class="btn-icon" onclick="editIncome('${income.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete" onclick="deleteIncome('${income.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <div class="item-date-line"><i class="fas fa-calendar"></i> ${formatDate(income.fecha)}</div>
            <div class="item-description">${income.descripcion}</div>
            <div class="item-details">
                ${income.categoria ? `<div class="item-badge"><i class="fas fa-tag"></i> ${income.categoria}</div>` : ''}
            </div>
            <div class="item-footer">
                <button class="btn-action btn-detail" onclick="showIncomeDetail('${income.id}')"><i class="fas fa-chart-pie"></i> Distribución</button>
                ${income.imagen ? `<button class="btn-action btn-comprobante" onclick="openImageModal('${income.imagen}')"><i class="fas fa-image"></i> Comprobante</button>` : ''}
            </div>
        </div>
    `).join('');
}

function filterAndRenderIncomes() {
    let filtered = allIncomes;
    if (selectedMonth) {
        filtered = filtered.filter(income => {
            const d = income.fecha?.toDate?.() || new Date(income.fecha);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` === selectedMonth;
        });
    }
    const search = searchInput.value.toLowerCase();
    if (search) {
        filtered = filtered.filter(i => i.descripcion.toLowerCase().includes(search) || (i.categoria && i.categoria.toLowerCase().includes(search)));
    }
    const total = filtered.reduce((sum, i) => sum + parseInt(i.monto || 0), 0);
    document.getElementById('totalIncome').textContent = formatCurrency(total);
    renderIncomes(filtered);
}

searchInput.addEventListener('input', () => filterAndRenderIncomes());

window.editIncome = (id) => { const income = allIncomes.find(i => i.id === id); if (income) openModal(income); };

window.deleteIncome = async (id) => {
    const confirmed = await showConfirm('¿Eliminar ingreso?', 'Esta acción no se puede deshacer.', 'Eliminar');
    if (confirmed) {
        try {
            const income = allIncomes.find(i => i.id === id);
            if (income) {
                // Reverse distribution from all configured accounts
                const config = getDistConfig();
                const distributions = [
                    { key: 'supervivencia', pct: DIST.supervivencia },
                    { key: 'empresa', pct: DIST.empresa },
                    { key: 'ahorro', pct: DIST.ahorro },
                    { key: 'libre', pct: DIST.libre }
                ];
                for (const dist of distributions) {
                    const accountName = config[dist.key];
                    if (accountName) {
                        const amount = Math.round(income.monto * dist.pct);
                        await updateAccountBalance(accountName, amount, 'subtract');
                    }
                }
            }
            await deleteDoc(doc(db, 'ingresos', id));
            await loadIncomes();
        } catch (error) { console.error('Error deleting income:', error); }
    }
};

// Load Categories
let categoriesData = [];
async function loadSelects() {
    try {
        const categoriesSnap = await getDocs(collection(db, 'categorias'));
        const categoriaSelect = document.getElementById('categoria');
        categoriaSelect.innerHTML = '<option value="">Seleccionar categoría</option>';
        categoriesData = [];
        categoriesSnap.forEach(d => {
            const data = d.data();
            if (data.tipo === 'ingreso') {
                categoriesData.push(data);
                const opt = document.createElement('option');
                opt.value = data.nombre; opt.textContent = data.nombre + (data.montoPredefinido ? ` - ${formatCurrency(data.montoPredefinido)}` : '');
                categoriaSelect.appendChild(opt);
            }
        });
    } catch (error) { console.error('Error loading selects:', error); }
}

document.getElementById('categoria').addEventListener('change', (e) => {
    const cat = categoriesData.find(c => c.nombre === e.target.value);
    if (cat && cat.montoPredefinido) document.getElementById('monto').value = formatNumber(String(cat.montoPredefinido));
});

function formatCurrency(amount) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date) {
    if (!date) return '';
    const d = date?.toDate?.() || new Date(date);
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function updateAccountBalance(accountName, amount, operation) {
    try {
        const accountsSnap = await getDocs(collection(db, 'cuentas'));
        accountsSnap.forEach(async (docSnap) => {
            const account = docSnap.data();
            if (account.nombre === accountName) {
                const current = parseInt(account.saldo || 0);
                const newBalance = operation === 'add' ? current + amount : current - amount;
                await updateDoc(doc(db, 'cuentas', docSnap.id), { saldo: newBalance });
            }
        });
    } catch (error) { console.error('Error updating account balance:', error); }
}

// Image Modal
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeImageModal = document.getElementById('closeImageModal');
const downloadImageBtn = document.getElementById('downloadImageBtn');

window.openImageModal = (imageUrl) => { modalImage.src = imageUrl; imageModal.classList.add('active'); };
closeImageModal.addEventListener('click', () => imageModal.classList.remove('active'));

downloadImageBtn.addEventListener('click', async () => {
    const imageUrl = modalImage.src;
    if (!imageUrl) return;
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ingreso_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.jpg`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) { console.error('Error downloading image:', error); alert('Error al descargar la imagen'); }
});

imageModal.addEventListener('click', (e) => { if (e.target === imageModal) imageModal.classList.remove('active'); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && imageModal.classList.contains('active')) imageModal.classList.remove('active'); });

// Income Detail Modal
const incomeDetailModal = document.getElementById('incomeDetailModal');
const closeIncomeDetailModal = document.getElementById('closeIncomeDetailModal');
const closeIncomeDetailBtn = document.getElementById('closeIncomeDetailBtn');

window.showIncomeDetail = (id) => {
    const income = allIncomes.find(i => i.id === id);
    if (!income) return;

    const config = getDistConfig();
    const monto = income.monto;
    document.getElementById('incomeDetailTotal').textContent = formatCurrency(monto);

    const items = [
        { key: 'supervivencia', label: 'Supervivencia', icon: 'fa-shield-alt', color: '#3b82f6', pct: DIST.supervivencia },
        { key: 'empresa', label: 'Empresa', icon: 'fa-briefcase', color: '#f59e0b', pct: DIST.empresa },
        { key: 'ahorro', label: 'Ahorro', icon: 'fa-piggy-bank', color: '#10b981', pct: DIST.ahorro },
        { key: 'libre', label: 'Libre', icon: 'fa-star', color: '#a855f7', pct: DIST.libre }
    ];

    document.getElementById('incomeDetailList').innerHTML = items.map(item => {
        const amount = Math.round(monto * item.pct);
        const account = config[item.key] || 'No asignada';
        return `
            <div class="dist-preview-item">
                <div class="dist-preview-item-left">
                    <div class="dist-preview-item-icon" style="background: ${item.color}20; color: ${item.color};">
                        <i class="fas ${item.icon}"></i>
                    </div>
                    <div class="dist-preview-item-info">
                        <h5>${item.label} (${item.pct * 100}%)</h5>
                        <span><i class="fas fa-credit-card"></i> ${account}</span>
                    </div>
                </div>
                <div class="dist-preview-item-amount" style="color: ${item.color};">${formatCurrency(amount)}</div>
            </div>
        `;
    }).join('');

    incomeDetailModal.classList.add('active');
};

closeIncomeDetailModal.addEventListener('click', () => incomeDetailModal.classList.remove('active'));
closeIncomeDetailBtn.addEventListener('click', () => incomeDetailModal.classList.remove('active'));
incomeDetailModal.addEventListener('click', (e) => { if (e.target === incomeDetailModal) incomeDetailModal.classList.remove('active'); });

// Initialize
populateYearFilter();
populateMonthFilter();
loadIncomes();
loadSelects();
updateDistributionDisplay();
