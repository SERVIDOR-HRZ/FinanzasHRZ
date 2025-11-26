import { db, IMGBB_API_KEY } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// DOM Elements
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const btnNewActivity = document.getElementById('btnNewActivity');
const activityModal = document.getElementById('activityModal');
const closeModal = document.getElementById('closeModal');
const cancelBtn = document.getElementById('cancelBtn');
const activityForm = document.getElementById('activityForm');
const activitiesTimeline = document.getElementById('activitiesTimeline');
const dayButtons = document.querySelectorAll('.day-btn');
const imageInput = document.getElementById('imagen');
const imagePreview = document.getElementById('imagePreview');
const imageModal = document.getElementById('imageModal');
const closeImageModal = document.getElementById('closeImageModal');
const modalImage = document.getElementById('modalImage');
const currentDayName = document.getElementById('currentDayName');
const currentDate = document.getElementById('currentDate');
const selectedDayName = document.getElementById('selectedDayName');

// State
let editingId = null;
let currentImageUrl = null;
let selectedDay = '';
let activities = [];

// Days mapping
const daysMap = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado'
};

const daysNameMap = {
    'lunes': 'Lunes',
    'martes': 'Martes',
    'miercoles': 'Miércoles',
    'jueves': 'Jueves',
    'viernes': 'Viernes'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    setupEventListeners();
    setCurrentDay();
    loadActivities();
    
    // Update current activity and stats every minute
    setInterval(() => {
        displayActivities();
        updateSelectedDayStats();
    }, 60000); // 60 seconds
}

// Event Listeners
function setupEventListeners() {
    menuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    btnNewActivity.addEventListener('click', openNewActivityModal);
    closeModal.addEventListener('click', closeActivityModal);
    cancelBtn.addEventListener('click', closeActivityModal);
    activityForm.addEventListener('submit', handleSubmit);
    imageInput.addEventListener('change', handleImagePreview);
    closeImageModal.addEventListener('click', () => {
        imageModal.classList.remove('active');
    });

    dayButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const day = btn.dataset.day;
            selectDay(day);
        });
    });

    // Icon selector
    document.getElementById('iconSelector').addEventListener('click', (e) => {
        const iconOption = e.target.closest('.icon-option');
        if (iconOption) {
            document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            iconOption.classList.add('selected');
            document.getElementById('icono').value = iconOption.dataset.icon;
        }
    });

    // Close modal on outside click
    activityModal.addEventListener('click', (e) => {
        if (e.target === activityModal) {
            closeActivityModal();
        }
    });

    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.classList.remove('active');
        }
    });
}

// Convert 12-hour time to 24-hour format
function convertTo24Hour(time12, period) {
    let [hours, minutes] = time12.split(':').map(str => str.trim());
    hours = parseInt(hours);
    
    if (period === 'AM') {
        if (hours === 12) hours = 0;
    } else { // PM
        if (hours !== 12) hours += 12;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

// Convert 24-hour time to 12-hour format with period
function convertTo12Hour(time24) {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    let hours12 = hours % 12;
    if (hours12 === 0) hours12 = 12;
    
    return {
        time: `${hours12}:${minutes.toString().padStart(2, '0')}`,
        period: period
    };
}

// Convert 24-hour format to 12-hour format with AM/PM
function formatTo12Hour(time24) {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Set current day
function setCurrentDay() {
    const today = new Date();
    const dayIndex = today.getDay();
    const dayName = daysMap[dayIndex];
    
    // Format date
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = today.toLocaleDateString('es-ES', options);
    
    currentDayName.textContent = daysNameMap[dayName] || 'Fin de Semana';
    currentDate.textContent = formattedDate;
    
    // Select current day if it's a weekday
    if (dayName !== 'sabado' && dayName !== 'domingo') {
        selectDay(dayName);
    } else {
        selectDay('lunes');
    }
}

// Select day
function selectDay(day) {
    selectedDay = day;
    
    // Update UI
    dayButtons.forEach(btn => {
        if (btn.dataset.day === day) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    selectedDayName.textContent = daysNameMap[day];
    
    // Update the top card title and date with selected day
    currentDayName.textContent = daysNameMap[day];
    updateDateForSelectedDay(day);
    
    // Filter and display activities
    displayActivities();
    
    // Update stats for selected day
    updateSelectedDayStats();
}

// Update date based on selected day
function updateDateForSelectedDay(day) {
    const today = new Date();
    const currentDayIndex = today.getDay();
    
    // Find the day index for the selected day
    let targetDayIndex = -1;
    for (let key in daysMap) {
        if (daysMap[key] === day) {
            targetDayIndex = parseInt(key);
            break;
        }
    }
    
    if (targetDayIndex === -1) return;
    
    // Calculate the difference in days
    let daysDifference = targetDayIndex - currentDayIndex;
    
    // Create a new date with the difference
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysDifference);
    
    // Format date
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = targetDate.toLocaleDateString('es-ES', options);
    
    currentDate.textContent = formattedDate;
}

// Modal functions
function openNewActivityModal() {
    editingId = null;
    currentImageUrl = null;
    activityForm.reset();
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('active');
    document.getElementById('modalTitle').textContent = 'Nueva Actividad';
    
    // Clear icon selection
    document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
    document.getElementById('icono').value = '';
    
    // Pre-select current day
    const dayCheckboxes = document.querySelectorAll('input[name="dias"]');
    dayCheckboxes.forEach(checkbox => {
        checkbox.checked = checkbox.value === selectedDay;
    });
    
    activityModal.classList.add('active');
}

function openEditActivityModal(activity) {
    editingId = activity.id;
    currentImageUrl = activity.imagenUrl || null;
    
    document.getElementById('modalTitle').textContent = 'Editar Actividad';
    document.getElementById('titulo').value = activity.titulo;
    document.getElementById('descripcion').value = activity.descripcion || '';
    
    // Convert 24-hour time to 12-hour format
    const timeData = convertTo12Hour(activity.hora);
    document.getElementById('hora').value = timeData.time;
    document.getElementById('periodo').value = timeData.period;
    
    // Select icon
    document.querySelectorAll('.icon-option').forEach(opt => {
        if (opt.dataset.icon === activity.icono) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
    document.getElementById('icono').value = activity.icono || '';
    
    // Check only the day of this activity
    const dayCheckboxes = document.querySelectorAll('input[name="dias"]');
    dayCheckboxes.forEach(checkbox => {
        checkbox.checked = checkbox.value === activity.dia;
    });
    
    // Show existing image
    if (activity.imagenUrl) {
        imagePreview.innerHTML = `
            <div class="preview-container">
                <img src="${activity.imagenUrl}" alt="Preview">
                <button type="button" class="remove-preview" onclick="window.removeImagePreview()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        imagePreview.classList.add('active');
    } else {
        imagePreview.innerHTML = '';
        imagePreview.classList.remove('active');
    }
    
    activityModal.classList.add('active');
}

function closeActivityModal() {
    activityModal.classList.remove('active');
    activityForm.reset();
    editingId = null;
    currentImageUrl = null;
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('active');
}

// Image handling
function handleImagePreview(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.innerHTML = `
                <div class="preview-container">
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="remove-preview" onclick="window.removeImagePreview()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            imagePreview.classList.add('active');
        };
        reader.readAsDataURL(file);
    }
}

window.removeImagePreview = function() {
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('active');
    imageInput.value = '';
    currentImageUrl = null;
};

async function uploadImageToImgBB(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.data.url;
        } else {
            throw new Error('Error al subir la imagen');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

// Form submission
async function handleSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoader = document.getElementById('btnLoader');
    
    // Disable button
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    
    try {
        const titulo = document.getElementById('titulo').value.trim();
        const descripcion = document.getElementById('descripcion').value.trim();
        const hora12 = document.getElementById('hora').value;
        const periodo = document.getElementById('periodo').value;
        const icono = document.getElementById('icono').value;
        const imageFile = imageInput.files[0];
        
        // Convert to 24-hour format
        const hora = convertTo24Hour(hora12, periodo);
        
        // Get selected days
        const selectedDays = Array.from(document.querySelectorAll('input[name="dias"]:checked'))
            .map(checkbox => checkbox.value);
        
        if (selectedDays.length === 0) {
            alert('Por favor selecciona al menos un día');
            return;
        }
        
        if (!icono) {
            alert('Por favor selecciona un icono');
            return;
        }
        
        let imagenUrl = currentImageUrl;
        
        // Upload new image if selected
        if (imageFile) {
            imagenUrl = await uploadImageToImgBB(imageFile);
        }
        
        if (editingId) {
            // Update existing activity (only one day)
            const activityData = {
                titulo,
                descripcion,
                dia: selectedDays[0], // When editing, use first selected day
                hora,
                icono,
                imagenUrl: imagenUrl || null,
                completada: activities.find(a => a.id === editingId)?.completada || false,
                fechaCreacion: activities.find(a => a.id === editingId)?.fechaCreacion || new Date().toISOString()
            };
            
            const activityRef = doc(db, 'rutinas', editingId);
            await updateDoc(activityRef, activityData);
        } else {
            // Add new activity for each selected day
            const promises = selectedDays.map(dia => {
                const activityData = {
                    titulo,
                    descripcion,
                    dia,
                    hora,
                    icono,
                    imagenUrl: imagenUrl || null,
                    completada: false,
                    fechaCreacion: new Date().toISOString()
                };
                return addDoc(collection(db, 'rutinas'), activityData);
            });
            
            await Promise.all(promises);
        }
        
        closeActivityModal();
        await loadActivities();
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Load activities
async function loadActivities() {
    try {
        const q = query(collection(db, 'rutinas'), orderBy('hora', 'asc'));
        const querySnapshot = await getDocs(q);
        
        activities = [];
        querySnapshot.forEach((doc) => {
            activities.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        displayActivities();
        updateTodayStats();
        
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Display activities
function displayActivities() {
    const dayActivities = activities.filter(a => a.dia === selectedDay);
    
    if (dayActivities.length === 0) {
        activitiesTimeline.innerHTML = '<p class="no-data">No hay actividades para este día</p>';
        return;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const today = new Date();
    const dayIndex = today.getDay();
    const todayName = daysMap[dayIndex];
    const isToday = selectedDay === todayName;
    
    activitiesTimeline.innerHTML = dayActivities.map(activity => {
        const displayTime = formatTo12Hour(activity.hora);
        
        // Check if this is the current or next activity
        const isCurrent = isToday && isCurrentActivity(activity.hora, currentTime);
        const isNext = isToday && isNextActivity(activity.hora, currentTime, dayActivities);
        const isPast = isToday && isPastActivity(activity.hora, currentTime);
        const isMissed = isPast && !activity.completada;
        const isCompleted = activity.completada;
        
        return `
        <div class="activity-item ${isCurrent ? 'current' : ''} ${isNext ? 'next' : ''} ${isCompleted ? 'completed' : ''} ${isMissed ? 'missed' : ''}">
            <div class="activity-time ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${isMissed ? 'missed' : ''}">
                <i class="fas fa-${activity.icono || 'clock'}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-header">
                    <div class="activity-main">
                        <label class="checkbox-container">
                            <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.toggleComplete('${activity.id}', this.checked)">
                            <span class="checkmark"></span>
                        </label>
                        <div>
                            <div class="activity-title ${isCompleted ? 'completed' : ''}">
                                <i class="fas fa-${activity.icono || 'clock'}" style="margin-right: 8px; color: var(--color-gray);"></i>
                                ${activity.titulo}
                                ${isCompleted ? '<span class="badge-completed">Completada</span>' : ''}
                                ${isCurrent && !isCompleted ? '<span class="badge-current">Ahora</span>' : ''}
                                ${isNext && !isCompleted ? '<span class="badge-next">Próxima</span>' : ''}
                                ${isMissed ? '<span class="badge-missed">Perdida</span>' : ''}
                            </div>
                            <div class="activity-hour">
                                <i class="fas fa-clock"></i>
                                ${displayTime}
                            </div>
                        </div>
                    </div>
                    <div class="activity-actions">
                        <button class="activity-btn" onclick="window.editActivity('${activity.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="activity-btn delete" onclick="window.deleteActivity('${activity.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${activity.descripcion ? `<div class="activity-description ${isCompleted ? 'completed' : ''}">${activity.descripcion}</div>` : ''}
                ${activity.imagenUrl ? `
                    <div class="activity-image" onclick="window.viewImage('${activity.imagenUrl}')">
                        <img src="${activity.imagenUrl}" alt="${activity.titulo}">
                    </div>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
}

// Check if activity is in the past
function isPastActivity(activityTime, currentTime) {
    const [actHour, actMin] = activityTime.split(':').map(Number);
    const [curHour, curMin] = currentTime.split(':').map(Number);
    
    const actMinutes = actHour * 60 + actMin;
    const curMinutes = curHour * 60 + curMin;
    
    // Activity is past if current time is more than 30 minutes after it
    return curMinutes >= actMinutes + 30;
}

// Check if activity is happening now
function isCurrentActivity(activityTime, currentTime) {
    const [actHour, actMin] = activityTime.split(':').map(Number);
    const [curHour, curMin] = currentTime.split(':').map(Number);
    
    const actMinutes = actHour * 60 + actMin;
    const curMinutes = curHour * 60 + curMin;
    
    // Activity is current if we're within 30 minutes of it
    return curMinutes >= actMinutes && curMinutes < actMinutes + 30;
}

// Check if activity is the next one
function isNextActivity(activityTime, currentTime, allActivities) {
    const [curHour, curMin] = currentTime.split(':').map(Number);
    const curMinutes = curHour * 60 + curMin;
    
    // Find all future activities
    const futureActivities = allActivities.filter(a => {
        const [actHour, actMin] = a.hora.split(':').map(Number);
        const actMinutes = actHour * 60 + actMin;
        return actMinutes > curMinutes;
    });
    
    if (futureActivities.length === 0) return false;
    
    // Sort by time and check if this is the first one
    futureActivities.sort((a, b) => {
        const [aHour, aMin] = a.hora.split(':').map(Number);
        const [bHour, bMin] = b.hora.split(':').map(Number);
        return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
    
    return futureActivities[0].hora === activityTime;
}

// Update today stats (for current day info card)
function updateTodayStats() {
    const today = new Date();
    const dayIndex = today.getDay();
    const dayName = daysMap[dayIndex];
    
    // This is just for display, actual stats are in updateSelectedDayStats
    if (dayName !== 'sabado' && dayName !== 'domingo') {
        updateSelectedDayStats();
    }
}

// Update stats for selected day
function updateSelectedDayStats() {
    const completedCountEl = document.getElementById('completedCount');
    const missedCountEl = document.getElementById('missedCount');
    const pendingCountEl = document.getElementById('pendingCount');
    
    const dayActivities = activities.filter(a => a.dia === selectedDay);
    
    if (dayActivities.length === 0) {
        completedCountEl.textContent = '0';
        missedCountEl.textContent = '0';
        pendingCountEl.textContent = '0';
        return;
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    // Check if selected day is today
    const today = new Date();
    const dayIndex = today.getDay();
    const todayName = daysMap[dayIndex];
    const isToday = selectedDay === todayName;
    
    let completed = 0;
    let missed = 0;
    let pending = 0;
    
    dayActivities.forEach(activity => {
        if (activity.completada) {
            completed++;
        } else if (isToday && isPastActivity(activity.hora, currentTime)) {
            missed++;
        } else {
            pending++;
        }
    });
    
    completedCountEl.textContent = completed;
    missedCountEl.textContent = missed;
    pendingCountEl.textContent = pending;
}

// Edit activity
window.editActivity = function(id) {
    const activity = activities.find(a => a.id === id);
    if (activity) {
        openEditActivityModal(activity);
    }
};

// Toggle complete
window.toggleComplete = async function(id, completed) {
    try {
        const activityRef = doc(db, 'rutinas', id);
        await updateDoc(activityRef, { completada: completed });
        
        // Update local state
        const activity = activities.find(a => a.id === id);
        if (activity) {
            activity.completada = completed;
        }
        
        displayActivities();
        updateSelectedDayStats();
    } catch (error) {
        console.error('Error updating activity:', error);
    }
};

// Delete activity
window.deleteActivity = async function(id) {
    const confirmed = await showConfirm(
        '¿Eliminar actividad?',
        'Esta acción no se puede deshacer. La actividad será eliminada permanentemente.',
        'Eliminar'
    );
    
    if (confirmed) {
        try {
            await deleteDoc(doc(db, 'rutinas', id));
            await loadActivities();
        } catch (error) {
            console.error('Error deleting activity:', error);
        }
    }
};

// View image
window.viewImage = function(url) {
    modalImage.src = url;
    imageModal.classList.add('active');
};

// Confirm Modal
let confirmResolve = null;
const confirmModalElement = document.getElementById('confirmModal');

function showConfirm(title = '¿Estás seguro?', message = 'Esta acción no se puede deshacer.', okText = 'Eliminar') {
    return new Promise((resolve) => {
        confirmResolve = resolve;
        
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmOk').textContent = okText;
        
        confirmModalElement.classList.add('active');
    });
}

function closeConfirmModal(result) {
    confirmModalElement.classList.remove('active');
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

// Confirm modal event listeners
document.addEventListener('click', (e) => {
    if (e.target.id === 'confirmOk') {
        closeConfirmModal(true);
    } else if (e.target.id === 'confirmCancel') {
        closeConfirmModal(false);
    } else if (e.target.id === 'confirmModal') {
        closeConfirmModal(false);
    }
});

// ESC key for confirm modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmModalElement?.classList.contains('active')) {
        closeConfirmModal(false);
    }
});
