import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy, Timestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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

document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar) {
        if (!sidebar.contains(e.target) && !menuToggle?.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    }
});

// Global Variables
let currentView = 'day';
let selectedDate = new Date();
let currentMonth = new Date();
let editingTaskId = null;
let timerInterval = null;
let timerStartTime = null;
let timerDuration = 0;
let timerPaused = false;
let timerElapsed = 0;
let currentTimerTaskId = null;
let selectedIcon = 'tasks';
let selectedColor = '#6b7280';

// Elements
const dayView = document.getElementById('dayView');
const calendarView = document.getElementById('calendarView');
const taskModal = document.getElementById('taskModal');
const timerOverlay = document.getElementById('timerOverlay');
const taskForm = document.getElementById('taskForm');
const selectedDateInput = document.getElementById('selectedDate');
const tasksTimeline = document.getElementById('tasksTimeline');
const calendarGrid = document.getElementById('calendarGrid');
const currentMonthDisplay = document.getElementById('currentMonth');

// Icon Selector
const iconOptions = document.querySelectorAll('.icon-option-task');
iconOptions.forEach(option => {
    option.addEventListener('click', () => {
        iconOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedIcon = option.dataset.icon;
    });
});

// Color Selector
const colorOptions = document.querySelectorAll('.color-option-task');
colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        selectedColor = option.dataset.color;
    });
});

// Set default selections
document.querySelector('.icon-option-task[data-icon="tasks"]')?.classList.add('selected');
document.querySelector('.color-option-task[data-color="#6b7280"]')?.classList.add('selected');

// View Toggle
document.querySelectorAll('.toggle-btn-task').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn-task').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentView = btn.dataset.view;
        
        if (currentView === 'day') {
            dayView.classList.add('active');
            calendarView.classList.remove('active');
            loadDayTasks();
        } else {
            dayView.classList.remove('active');
            calendarView.classList.add('active');
            loadCalendar();
        }
    });
});

// Date Navigation
updateDateDisplay();

function updateDateDisplay() {
    const day = selectedDate.getDate();
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const month = monthNames[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    
    document.querySelector('.date-day-number-task').textContent = day;
    document.querySelector('.date-month-year-task').textContent = `${month} ${year}`;
    
    updateCurrentDayDisplay();
}

document.getElementById('prevDay').addEventListener('click', () => {
    selectedDate.setDate(selectedDate.getDate() - 1);
    updateDateDisplay();
    loadDayTasks();
});

document.getElementById('nextDay').addEventListener('click', () => {
    selectedDate.setDate(selectedDate.getDate() + 1);
    updateDateDisplay();
    loadDayTasks();
});

document.getElementById('btnToday').addEventListener('click', () => {
    selectedDate = new Date();
    updateDateDisplay();
    loadDayTasks();
});

// Update Current Day Display
function updateCurrentDayDisplay() {
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const today = new Date();
    const isToday = formatDateForInput(selectedDate) === formatDateForInput(today);
    
    const dayName = dayNames[selectedDate.getDay()];
    const day = selectedDate.getDate();
    const month = monthNames[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    
    document.getElementById('currentDayName').textContent = isToday ? `Hoy - ${dayName}` : dayName;
    document.getElementById('currentDayDate').textContent = `${day} de ${month} de ${year}`;
}

// Calendar Navigation
document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    loadCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    loadCalendar();
});

// Modal Controls
document.getElementById('btnAddTask').addEventListener('click', () => {
    editingTaskId = null;
    taskForm.reset();
    document.getElementById('modalTitle').textContent = 'Nueva Tarea';
    
    // Set default date to selected date
    selectedTaskDate = formatDateForInput(selectedDate);
    const date = new Date(selectedTaskDate + 'T00:00:00');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    document.getElementById('taskDate').value = `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
    
    // Set default times
    document.getElementById('taskStartTime').value = '09:00 AM';
    document.getElementById('taskEndTime').value = '09:30 AM';
    
    // Reset selections
    selectedIcon = 'tasks';
    selectedColor = '#6b7280';
    selectedWeekDays = [];
    selectedMonthDays = [];
    selectedEndDate = null;
    
    document.querySelectorAll('.icon-option-task').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.icon-option-task[data-icon="tasks"]')?.classList.add('selected');
    document.querySelectorAll('.color-option-task').forEach(opt => opt.classList.remove('selected'));
    document.querySelector('.color-option-task[data-color="#6b7280"]')?.classList.add('selected');
    
    // Reset recurring options
    document.getElementById('recurringOptions').style.display = 'none';
    document.getElementById('weekDaysSelector').style.display = 'none';
    document.getElementById('monthDaysSelector').style.display = 'none';
    document.querySelectorAll('.week-day-option-task').forEach(opt => opt.classList.remove('selected'));
    document.getElementById('recurringEndDate').value = '';
    
    taskModal.classList.add('active');
});

document.getElementById('closeModal').addEventListener('click', () => {
    taskModal.classList.remove('active');
});

document.getElementById('cancelBtn').addEventListener('click', () => {
    taskModal.classList.remove('active');
});

taskModal.addEventListener('click', (e) => {
    if (e.target === taskModal) {
        taskModal.classList.remove('active');
    }
});

// Recurring Options Toggle
let selectedWeekDays = [];
let selectedMonthDays = [];
let datePickerMonth = new Date();
let selectedEndDate = null;
let taskDatePickerMonth = new Date();
let selectedTaskDate = null;
let currentTimePickerInput = null;
let selectedHour = 9;
let selectedMinute = 0;
let selectedPeriod = 'AM';

document.getElementById('taskRecurring').addEventListener('change', (e) => {
    const recurringOptions = document.getElementById('recurringOptions');
    recurringOptions.style.display = e.target.checked ? 'block' : 'none';
    
    if (e.target.checked) {
        updateRecurringOptions();
    }
});

// Recurring Frequency Change
document.getElementById('recurringFrequency').addEventListener('change', (e) => {
    updateRecurringOptions();
});

function updateRecurringOptions(keepSelections = false) {
    const frequency = document.getElementById('recurringFrequency').value;
    const weekDaysSelector = document.getElementById('weekDaysSelector');
    const monthDaysSelector = document.getElementById('monthDaysSelector');
    
    // Reset selections only if not editing
    if (!keepSelections) {
        selectedWeekDays = [];
        selectedMonthDays = [];
        
        // Clear visual selections
        document.querySelectorAll('.week-day-option-task').forEach(opt => opt.classList.remove('selected'));
    }
    
    if (frequency === 'weekly' || frequency === 'biweekly') {
        weekDaysSelector.style.display = 'block';
        monthDaysSelector.style.display = 'none';
    } else if (frequency === 'monthly') {
        weekDaysSelector.style.display = 'none';
        monthDaysSelector.style.display = 'block';
        generateMonthDaysSelector();
    } else {
        weekDaysSelector.style.display = 'none';
        monthDaysSelector.style.display = 'none';
    }
}

// Week Days Selector
document.querySelectorAll('.week-day-option-task').forEach(option => {
    option.addEventListener('click', () => {
        const day = parseInt(option.dataset.day);
        
        console.log('Click en día:', day);
        console.log('selectedWeekDays antes:', [...selectedWeekDays]);
        
        if (selectedWeekDays.includes(day)) {
            selectedWeekDays = selectedWeekDays.filter(d => d !== day);
            option.classList.remove('selected');
        } else {
            selectedWeekDays.push(day);
            option.classList.add('selected');
        }
        
        console.log('selectedWeekDays después:', [...selectedWeekDays]);
    });
});

// Generate Month Days Selector
function generateMonthDaysSelector() {
    const grid = document.getElementById('monthDaysGrid');
    let html = '';
    
    for (let day = 1; day <= 31; day++) {
        html += `<div class="month-day-option-task" data-day="${day}">${day}</div>`;
    }
    
    grid.innerHTML = html;
    
    // Add event listeners
    grid.querySelectorAll('.month-day-option-task').forEach(option => {
        option.addEventListener('click', () => {
            const day = parseInt(option.dataset.day);
            
            if (selectedMonthDays.includes(day)) {
                selectedMonthDays = selectedMonthDays.filter(d => d !== day);
                option.classList.remove('selected');
            } else {
                selectedMonthDays.push(day);
                option.classList.add('selected');
            }
        });
    });
}

// Custom Date Picker
const datePickerInput = document.getElementById('recurringEndDate');
const customDatePicker = document.getElementById('customDatePicker');
const datePickerMonthDisplay = document.getElementById('datePickerMonth');
const datePickerDays = document.getElementById('datePickerDays');

// Task Date Picker
const taskDateInput = document.getElementById('taskDate');
const taskDatePicker = document.getElementById('taskDatePicker');
const taskDatePickerMonthDisplay = document.getElementById('taskDatePickerMonth');
const taskDatePickerDays = document.getElementById('taskDatePickerDays');

taskDateInput.addEventListener('click', () => {
    taskDatePicker.style.display = taskDatePicker.style.display === 'none' ? 'block' : 'none';
    if (taskDatePicker.style.display === 'block') {
        renderTaskDatePicker();
    }
});

document.getElementById('prevMonthTaskDate').addEventListener('click', (e) => {
    e.stopPropagation();
    taskDatePickerMonth.setMonth(taskDatePickerMonth.getMonth() - 1);
    renderTaskDatePicker();
});

document.getElementById('nextMonthTaskDate').addEventListener('click', (e) => {
    e.stopPropagation();
    taskDatePickerMonth.setMonth(taskDatePickerMonth.getMonth() + 1);
    renderTaskDatePicker();
});

function renderTaskDatePicker() {
    const year = taskDatePickerMonth.getFullYear();
    const month = taskDatePickerMonth.getMonth();
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    taskDatePickerMonthDisplay.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const lastDateOfMonth = lastDay.getDate();
    
    let html = '';
    
    // Empty cells
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += `<div class="date-picker-day-task empty-day"></div>`;
    }
    
    // Current month days
    const today = new Date();
    const todayStr = formatDateForInput(today);
    
    for (let day = 1; day <= lastDateOfMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateForInput(date);
        const isToday = dateStr === todayStr;
        const isSelected = selectedTaskDate && dateStr === selectedTaskDate;
        
        const classes = ['date-picker-day-task'];
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');
        
        html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${day}</div>`;
    }
    
    taskDatePickerDays.innerHTML = html;
    
    // Add click events
    taskDatePickerDays.querySelectorAll('.date-picker-day-task:not(.empty-day)').forEach(dayEl => {
        dayEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateStr = dayEl.dataset.date;
            selectedTaskDate = dateStr;
            
            const date = new Date(dateStr + 'T00:00:00');
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            
            taskDateInput.value = `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
            taskDatePicker.style.display = 'none';
            
            renderTaskDatePicker();
        });
    });
}

// Time Picker
const timePickerModal = document.getElementById('timePickerModal');
const taskStartTimeInput = document.getElementById('taskStartTime');
const taskEndTimeInput = document.getElementById('taskEndTime');
const hourInput = document.getElementById('hourInput');
const minuteInput = document.getElementById('minuteInput');

function openTimePicker(inputElement) {
    currentTimePickerInput = inputElement;
    
    // Parse current value if exists
    const currentValue = inputElement.value;
    if (currentValue) {
        const match = currentValue.match(/(\d+):(\d+)\s*(AM|PM)/);
        if (match) {
            selectedHour = parseInt(match[1]);
            selectedMinute = parseInt(match[2]);
            selectedPeriod = match[3];
        }
    }
    
    // Set input values
    hourInput.value = String(selectedHour).padStart(2, '0');
    minuteInput.value = String(selectedMinute).padStart(2, '0');
    
    // Set period buttons
    document.querySelectorAll('.time-period-btn-simple-task').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === selectedPeriod);
    });
    
    timePickerModal.classList.add('active');
}

taskStartTimeInput.addEventListener('click', () => openTimePicker(taskStartTimeInput));
taskEndTimeInput.addEventListener('click', () => openTimePicker(taskEndTimeInput));

document.getElementById('closeTimePicker').addEventListener('click', () => {
    timePickerModal.classList.remove('active');
});

document.querySelector('.btn-time-cancel-task').addEventListener('click', () => {
    timePickerModal.classList.remove('active');
});

document.querySelector('.btn-time-ok-task').addEventListener('click', () => {
    if (currentTimePickerInput) {
        // Get values from inputs
        let hour = parseInt(hourInput.value) || 1;
        let minute = parseInt(minuteInput.value) || 0;
        
        // Validate and constrain values
        if (hour < 1) hour = 1;
        if (hour > 12) hour = 12;
        if (minute < 0) minute = 0;
        if (minute > 59) minute = 59;
        
        const hourStr = String(hour).padStart(2, '0');
        const minuteStr = String(minute).padStart(2, '0');
        currentTimePickerInput.value = `${hourStr}:${minuteStr} ${selectedPeriod}`;
        
        // Update selected values
        selectedHour = hour;
        selectedMinute = minute;
    }
    timePickerModal.classList.remove('active');
});

// Hour input validation
hourInput.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    if (value > 12) e.target.value = '12';
    if (value < 1 && e.target.value !== '') e.target.value = '01';
});

hourInput.addEventListener('blur', (e) => {
    let value = parseInt(e.target.value) || 1;
    if (value < 1) value = 1;
    if (value > 12) value = 12;
    e.target.value = String(value).padStart(2, '0');
});

// Minute input validation
minuteInput.addEventListener('input', (e) => {
    let value = parseInt(e.target.value);
    if (value > 59) e.target.value = '59';
    if (value < 0 && e.target.value !== '') e.target.value = '00';
});

minuteInput.addEventListener('blur', (e) => {
    let value = parseInt(e.target.value) || 0;
    if (value < 0) value = 0;
    if (value > 59) value = 59;
    e.target.value = String(value).padStart(2, '0');
});

// Period buttons
document.querySelectorAll('.time-period-btn-simple-task').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.time-period-btn-simple-task').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPeriod = btn.dataset.period;
    });
});

// Recurring End Date Picker
datePickerInput.addEventListener('click', () => {
    customDatePicker.style.display = customDatePicker.style.display === 'none' ? 'block' : 'none';
    if (customDatePicker.style.display === 'block') {
        renderDatePicker();
    }
});

// Close date picker when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.date-picker-wrapper-task')) {
        customDatePicker.style.display = 'none';
        taskDatePicker.style.display = 'none';
    }
});

document.getElementById('prevMonthPicker').addEventListener('click', (e) => {
    e.stopPropagation();
    datePickerMonth.setMonth(datePickerMonth.getMonth() - 1);
    renderDatePicker();
});

document.getElementById('nextMonthPicker').addEventListener('click', (e) => {
    e.stopPropagation();
    datePickerMonth.setMonth(datePickerMonth.getMonth() + 1);
    renderDatePicker();
});

function renderDatePicker() {
    const year = datePickerMonth.getFullYear();
    const month = datePickerMonth.getMonth();
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    datePickerMonthDisplay.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const lastDateOfMonth = lastDay.getDate();
    
    let html = '';
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += `<div class="date-picker-day-task empty-day"></div>`;
    }
    
    // Current month days
    const today = new Date();
    const todayStr = formatDateForInput(today);
    
    for (let day = 1; day <= lastDateOfMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = formatDateForInput(date);
        const isToday = dateStr === todayStr;
        const isSelected = selectedEndDate && dateStr === selectedEndDate;
        
        const classes = ['date-picker-day-task'];
        if (isToday) classes.push('today');
        if (isSelected) classes.push('selected');
        
        html += `<div class="${classes.join(' ')}" data-date="${dateStr}">${day}</div>`;
    }
    
    datePickerDays.innerHTML = html;
    
    // Add click events to current month days
    datePickerDays.querySelectorAll('.date-picker-day-task:not(.empty-day)').forEach(dayEl => {
        dayEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateStr = dayEl.dataset.date;
            selectedEndDate = dateStr;
            
            const date = new Date(dateStr + 'T00:00:00');
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            
            datePickerInput.value = `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
            customDatePicker.style.display = 'none';
            
            renderDatePicker();
        });
    });
}

// Task Form Submit
let isSubmitting = false;

taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    isSubmitting = true;
    
    // Disable submit button with appropriate text
    const submitBtn = taskForm.querySelector('button[type="submit"]');
    let originalText = 'Guardar Tarea';
    if (submitBtn) {
        originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        
        // Show different text based on whether we're creating or editing
        if (editingTaskId) {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        } else {
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';
        }
    }
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        date: selectedTaskDate,
        startTime: document.getElementById('taskStartTime').value,
        endTime: document.getElementById('taskEndTime').value,
        icon: selectedIcon,
        color: selectedColor,
        recurring: document.getElementById('taskRecurring').checked,
        status: 'pending',
        createdAt: Timestamp.now()
    };

    if (taskData.recurring) {
        taskData.recurringFrequency = document.getElementById('recurringFrequency').value;
        taskData.recurringEndDate = selectedEndDate || null;
        
        // Add selected days based on frequency
        if (taskData.recurringFrequency === 'weekly' || taskData.recurringFrequency === 'biweekly') {
            taskData.selectedWeekDays = selectedWeekDays;
            console.log('Guardando selectedWeekDays:', selectedWeekDays);
        } else if (taskData.recurringFrequency === 'monthly') {
            taskData.selectedMonthDays = selectedMonthDays;
        }
    }

    try {
        if (editingTaskId) {
            // Check if it's a recurring task
            const taskDoc = await getDocs(collection(db, 'tareas'));
            let originalTask = null;
            
            taskDoc.forEach(doc => {
                if (doc.id === editingTaskId) {
                    originalTask = { id: doc.id, ...doc.data() };
                }
            });
            
            if (originalTask && (originalTask.parentRecurring || originalTask.recurring)) {
                // It's a recurring task - ask what to update
                // Keep button disabled and showing "Actualizando..."
                showRecurringEditModal(originalTask, taskData);
            } else {
                // Regular task - just update it
                await updateDoc(doc(db, 'tareas', editingTaskId), taskData);
                
                taskModal.classList.remove('active');
                if (currentView === 'day') {
                    loadDayTasks();
                } else {
                    loadCalendar();
                }
                
                // Re-enable button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                isSubmitting = false;
            }
        } else {
            // If recurring, create multiple tasks
            if (taskData.recurring) {
                await createRecurringTasks(taskData);
            } else {
                await addDoc(collection(db, 'tareas'), taskData);
            }
            
            taskModal.classList.remove('active');
            if (currentView === 'day') {
                loadDayTasks();
            } else {
                loadCalendar();
            }
            
            // Re-enable button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
            isSubmitting = false;
        }
    } catch (error) {
        console.error('Error saving task:', error);
        
        // Re-enable button on error
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        isSubmitting = false;
    }
});

// Crear Tareas Recurrentes
async function createRecurringTasks(taskData) {
    const startDate = new Date(taskData.date + 'T00:00:00');
    const endDate = taskData.recurringEndDate ? new Date(taskData.recurringEndDate + 'T00:00:00') : null;
    const frequency = taskData.recurringFrequency;
    const tasksToCreate = [];
    const maxTareas = endDate ? 365 : 30; // Límite de tareas a crear
    
    if (frequency === 'daily') {
        // Diario: avanzar día por día
        let fechaActual = new Date(startDate);
        while (tasksToCreate.length < maxTareas) {
            if (endDate && fechaActual > endDate) break;
            
            tasksToCreate.push({
                ...taskData,
                date: formatDateForInput(fechaActual),
                parentRecurring: true
            });
            
            fechaActual.setDate(fechaActual.getDate() + 1);
        }
    } else if (frequency === 'weekly' || frequency === 'biweekly') {
        const diasSeleccionados = taskData.selectedWeekDays && taskData.selectedWeekDays.length > 0 
            ? [...taskData.selectedWeekDays].sort((a, b) => a - b) 
            : null;
        const multiplicadorSemana = frequency === 'biweekly' ? 2 : 1;
        
        if (diasSeleccionados) {
            // Con días específicos seleccionados: iterar día por día
            // Calcular el domingo de la semana de inicio como referencia
            const domingoInicio = new Date(startDate);
            domingoInicio.setDate(domingoInicio.getDate() - domingoInicio.getDay());
            domingoInicio.setHours(0, 0, 0, 0);
            
            let fechaActual = new Date(startDate);
            let contadorSeguridad = 0;
            
            while (tasksToCreate.length < maxTareas && contadorSeguridad < 365 * 2) {
                if (endDate && fechaActual > endDate) break;
                
                // Calcular número de semana desde el inicio
                const domingoActual = new Date(fechaActual);
                domingoActual.setDate(domingoActual.getDate() - domingoActual.getDay());
                domingoActual.setHours(0, 0, 0, 0);
                const diffMs = domingoActual.getTime() - domingoInicio.getTime();
                const numSemana = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
                
                // Verificar si es una semana válida y un día seleccionado
                if (numSemana % multiplicadorSemana === 0 && diasSeleccionados.includes(fechaActual.getDay())) {
                    tasksToCreate.push({
                        ...taskData,
                        date: formatDateForInput(fechaActual),
                        parentRecurring: true
                    });
                }
                
                fechaActual.setDate(fechaActual.getDate() + 1);
                contadorSeguridad++;
            }
        } else {
            // Sin días específicos: repetir el mismo día cada semana/quincena
            let fechaActual = new Date(startDate);
            while (tasksToCreate.length < maxTareas) {
                if (endDate && fechaActual > endDate) break;
                
                tasksToCreate.push({
                    ...taskData,
                    date: formatDateForInput(fechaActual),
                    parentRecurring: true
                });
                
                fechaActual.setDate(fechaActual.getDate() + (7 * multiplicadorSemana));
            }
        }
    } else if (frequency === 'monthly') {
        const diasSeleccionados = taskData.selectedMonthDays && taskData.selectedMonthDays.length > 0 
            ? [...taskData.selectedMonthDays].sort((a, b) => a - b) 
            : null;
        
        if (diasSeleccionados) {
            // Con días específicos del mes: recorrer cada mes y crear en cada día seleccionado
            let anio = startDate.getFullYear();
            let mes = startDate.getMonth();
            let iteraciones = 0;
            
            while (tasksToCreate.length < maxTareas && iteraciones < 365) {
                const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate();
                
                for (const dia of diasSeleccionados) {
                    if (dia <= ultimoDiaMes) {
                        const fechaTarea = new Date(anio, mes, dia);
                        
                        // Solo crear si es igual o posterior a la fecha de inicio
                        if (fechaTarea >= startDate) {
                            if (endDate && fechaTarea > endDate) continue;
                            
                            tasksToCreate.push({
                                ...taskData,
                                date: formatDateForInput(fechaTarea),
                                parentRecurring: true
                            });
                        }
                    }
                }
                
                // Verificar si superamos la fecha fin
                if (endDate && new Date(anio, mes + 1, 1) > endDate) break;
                
                // Avanzar al siguiente mes
                mes++;
                if (mes > 11) {
                    mes = 0;
                    anio++;
                }
                iteraciones++;
            }
        } else {
            // Sin días específicos: repetir el mismo día cada mes
            let fechaActual = new Date(startDate);
            while (tasksToCreate.length < maxTareas) {
                if (endDate && fechaActual > endDate) break;
                
                tasksToCreate.push({
                    ...taskData,
                    date: formatDateForInput(fechaActual),
                    parentRecurring: true
                });
                
                fechaActual.setMonth(fechaActual.getMonth() + 1);
            }
        }
    }
    
    // Crear todas las tareas en Firebase
    for (const task of tasksToCreate) {
        await addDoc(collection(db, 'tareas'), task);
    }
}

// Load Day Tasks
async function loadDayTasks() {
    try {
        const dateStr = formatDateForInput(selectedDate);
        const tasksSnap = await getDocs(collection(db, 'tareas'));
        
        const tasks = [];
        tasksSnap.forEach(doc => {
            const data = doc.data();
            if (data.date === dateStr) {
                tasks.push({ id: doc.id, ...data });
            }
        });
        
        // Sort by time
        tasks.sort((a, b) => {
            const timeA = a.startTime || a.time || '00:00 AM';
            const timeB = b.startTime || b.time || '00:00 AM';
            return parseTime12Hour(timeA) - parseTime12Hour(timeB);
        });
        
        // Check for incomplete tasks
        const now = new Date();
        const today = formatDateForInput(now);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        for (const task of tasks) {
            if (task.status === 'pending' && task.date < today) {
                await updateDoc(doc(db, 'tareas', task.id), { status: 'incomplete' });
                task.status = 'incomplete';
            } else if (task.status === 'pending' && task.date === today) {
                const endTime = task.endTime || calculateEndTimeFromDuration(task.startTime || task.time, task.duration);
                const taskEndMinutes = parseTime12Hour(endTime);
                if (currentMinutes > taskEndMinutes) {
                    await updateDoc(doc(db, 'tareas', task.id), { status: 'incomplete' });
                    task.status = 'incomplete';
                }
            }
        }
        
        if (tasks.length === 0) {
            tasksTimeline.innerHTML = `
                <div class="no-tasks-message">
                    <i class="fas fa-tasks"></i>
                    <p>No hay tareas para este día</p>
                </div>
            `;
            return;
        }
        
        // Group tasks by hour blocks (5am to 12am)
        const hourBlocks = {};
        for (let hour = 5; hour <= 23; hour++) {
            hourBlocks[hour] = [];
        }
        hourBlocks[0] = []; // Midnight
        
        tasks.forEach(task => {
            const timeStr = task.startTime || task.time || '00:00 AM';
            const taskMinutes = parseTime12Hour(timeStr);
            const taskHour = Math.floor(taskMinutes / 60);
            
            if (hourBlocks[taskHour] !== undefined) {
                hourBlocks[taskHour].push(task);
            }
        });
        
        // Render hour blocks with tasks
        let html = '';
        for (let hour = 5; hour <= 23; hour++) {
            if (hourBlocks[hour].length > 0) {
                html += createHourBlock(hour, hourBlocks[hour]);
            }
        }
        if (hourBlocks[0].length > 0) {
            html += createHourBlock(0, hourBlocks[0]);
        }
        
        tasksTimeline.innerHTML = html || `
            <div class="no-tasks-message">
                <i class="fas fa-tasks"></i>
                <p>No hay tareas para este día</p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

// Create Hour Block
function createHourBlock(hour, tasks) {
    const hourLabel = hour === 0 ? '12:00 AM' : hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`;
    
    return `
        <div class="timeline-hour-block-task">
            <div class="timeline-hour-label-task">${hourLabel}</div>
            <div class="timeline-tasks-group-task">
                ${tasks.map(task => createTaskCard(task)).join('')}
            </div>
        </div>
    `;
}

// Create Task Card
function createTaskCard(task) {
    const statusClass = task.status || 'pending';
    const statusText = {
        'pending': 'Pendiente',
        'in-progress': 'En Progreso',
        'completed': 'Completada',
        'incomplete': 'Incompleta'
    }[statusClass];
    
    const startTime = task.startTime || task.time || '09:00 AM';
    const endTime = task.endTime || calculateEndTimeFromDuration(task.time, task.duration) || '09:30 AM';
    const taskIcon = task.icon || 'tasks';
    const taskColor = task.color || '#6b7280';
    
    // Calculate duration in minutes from start and end times
    const duration = calculateDurationFromTimes(startTime, endTime);
    
    // Calculate elapsed time display
    const elapsedTime = task.elapsedTime || 0;
    const totalSeconds = duration * 60;
    const remainingSeconds = totalSeconds - elapsedTime;
    const progressPercent = (elapsedTime / totalSeconds) * 100;
    
    let timeDisplay = '';
    if (task.status === 'in-progress' && elapsedTime > 0) {
        const elapsedMin = Math.floor(elapsedTime / 60);
        const elapsedSec = elapsedTime % 60;
        const remainingMin = Math.floor(remainingSeconds / 60);
        const remainingSec = remainingSeconds % 60;
        timeDisplay = `
            <div class="task-progress-info">
                <div class="task-progress-bar-container">
                    <div class="task-progress-bar-fill" style="width: ${progressPercent}%; background: ${taskColor};"></div>
                </div>
                <div class="task-progress-text">
                    <span><i class="fas fa-hourglass-half"></i> Transcurrido: ${elapsedMin}:${String(elapsedSec).padStart(2, '0')}</span>
                    <span><i class="fas fa-clock"></i> Restante: ${remainingMin}:${String(remainingSec).padStart(2, '0')}</span>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="task-card-item ${statusClass}" style="--task-color: ${taskColor}">
            <div class="task-card-header">
                <div class="task-card-main-content">
                    <div class="task-card-icon-wrapper" style="color: ${taskColor}; border-color: ${taskColor};">
                        <i class="fas fa-${taskIcon}"></i>
                    </div>
                    <div class="task-card-info">
                        <h3 class="task-card-title">${task.title}</h3>
                        <div class="task-card-time">
                            <i class="fas fa-clock"></i>
                            <span>${startTime} - ${endTime}</span>
                        </div>
                    </div>
                </div>
                <div class="task-card-actions-top">
                    <span class="task-status-badge ${statusClass}">${statusText}</span>
                    <button class="btn-task-action-small edit" onclick="editTask('${task.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-task-action-small delete" onclick="deleteTask('${task.id}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${task.description ? `<p class="task-card-description">${task.description}</p>` : ''}
            ${timeDisplay}
            <div class="task-card-footer">
                <div class="task-card-actions">
                    ${task.status === 'pending' ? `
                        <button class="btn-task-action start" onclick="startTask('${task.id}', '${task.title}', ${duration})">
                            <i class="fas fa-play"></i> Iniciar
                        </button>
                        <button class="btn-task-action complete" onclick="completeTask('${task.id}')">
                            <i class="fas fa-check"></i> Completar
                        </button>
                    ` : ''}
                    ${task.status === 'in-progress' ? `
                        <button class="btn-task-action start" onclick="continueTask('${task.id}', '${task.title}', ${duration})">
                            <i class="fas fa-play-circle"></i> Continuar
                        </button>
                        <button class="btn-task-action complete" onclick="completeTask('${task.id}')">
                            <i class="fas fa-check"></i> Completar
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// Calculate duration in minutes from start and end times (12-hour format)
function calculateDurationFromTimes(startTime, endTime) {
    const start = parseTime12Hour(startTime);
    const end = parseTime12Hour(endTime);
    
    let diff = end - start;
    if (diff < 0) diff += 24 * 60; // Handle overnight tasks
    
    return diff;
}

// Parse 12-hour time format to minutes since midnight
function parseTime12Hour(timeStr) {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
}

// Calculate end time from start time and duration (for backward compatibility)
function calculateEndTimeFromDuration(startTime, duration) {
    if (!startTime || !duration) return null;
    
    const startMinutes = parseTime12Hour(startTime);
    const endMinutes = startMinutes + duration;
    
    const hours24 = Math.floor(endMinutes / 60) % 24;
    const minutes = endMinutes % 60;
    
    let hours12 = hours24 % 12;
    if (hours12 === 0) hours12 = 12;
    const period = hours24 < 12 ? 'AM' : 'PM';
    
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Start Task with Timer
window.startTask = async (taskId, title, duration) => {
    try {
        // Check if task already has elapsed time
        const taskDoc = await getDocs(collection(db, 'tareas'));
        let taskData = null;
        
        taskDoc.forEach(doc => {
            if (doc.id === taskId) {
                taskData = doc.data();
            }
        });
        
        const elapsedSeconds = taskData?.elapsedTime || 0;
        
        await updateDoc(doc(db, 'tareas', taskId), { 
            status: 'in-progress',
            startedAt: Timestamp.now()
        });
        
        currentTimerTaskId = taskId;
        timerDuration = duration * 60; // Convert to seconds
        timerElapsed = elapsedSeconds;
        timerPaused = false;
        
        document.getElementById('timerTaskTitle').textContent = title;
        updateTimerDisplay();
        
        const progress = (timerElapsed / timerDuration) * 100;
        document.getElementById('timerProgressBar').style.width = `${Math.min(progress, 100)}%`;
        
        timerOverlay.classList.add('active');
        startTimer();
        
        loadDayTasks();
    } catch (error) {
        console.error('Error starting task:', error);
    }
};

// Continue Task
window.continueTask = async (taskId, title, duration) => {
    await startTask(taskId, title, duration);
};

// Update Timer Display
function updateTimerDisplay() {
    const remaining = Math.max(0, timerDuration - timerElapsed);
    document.getElementById('timerDisplay').textContent = formatTime(remaining);
}

// Start Timer
function startTimer() {
    timerStartTime = Date.now() - (timerElapsed * 1000);
    
    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerElapsed = Math.floor((Date.now() - timerStartTime) / 1000);
            const remaining = Math.max(0, timerDuration - timerElapsed);
            
            updateTimerDisplay();
            
            const progress = (timerElapsed / timerDuration) * 100;
            document.getElementById('timerProgressBar').style.width = `${Math.min(progress, 100)}%`;
            
            if (remaining === 0) {
                completeTimerTask();
            }
        }
    }, 1000);
}

// Pause Timer
document.getElementById('pauseTimer').addEventListener('click', () => {
    timerPaused = !timerPaused;
    const btn = document.getElementById('pauseTimer');
    if (timerPaused) {
        btn.innerHTML = '<i class="fas fa-play"></i> Reanudar';
    } else {
        btn.innerHTML = '<i class="fas fa-pause"></i> Pausar';
        timerStartTime = Date.now() - (timerElapsed * 1000);
    }
});

// Complete Timer Task
document.getElementById('completeTimer').addEventListener('click', () => {
    completeTimerTask();
});

async function completeTimerTask() {
    clearInterval(timerInterval);
    
    try {
        await updateDoc(doc(db, 'tareas', currentTimerTaskId), { 
            status: 'completed',
            elapsedTime: 0,
            completedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error completing task:', error);
    }
    
    timerOverlay.classList.remove('active');
    currentTimerTaskId = null;
    loadDayTasks();
}

// Close Timer with Confirmation
document.getElementById('closeTimer').addEventListener('click', async () => {
    // If timer is paused, just close without confirmation
    if (timerPaused) {
        clearInterval(timerInterval);
        
        try {
            // Save elapsed time
            await updateDoc(doc(db, 'tareas', currentTimerTaskId), { 
                elapsedTime: timerElapsed,
                status: 'in-progress'
            });
        } catch (error) {
            console.error('Error saving progress:', error);
        }
        
        timerOverlay.classList.remove('active');
        currentTimerTaskId = null;
        loadDayTasks();
        return;
    }
    
    // If timer is running, show confirmation
    showConfirmModal(
        '¿Pausar cronómetro?',
        'El tiempo se guardará y podrás continuar después.',
        async () => {
            clearInterval(timerInterval);
            
            try {
                // Save elapsed time
                await updateDoc(doc(db, 'tareas', currentTimerTaskId), { 
                    elapsedTime: timerElapsed,
                    status: 'in-progress'
                });
            } catch (error) {
                console.error('Error saving progress:', error);
            }
            
            timerOverlay.classList.remove('active');
            currentTimerTaskId = null;
            loadDayTasks();
        }
    );
});

// Complete Task
window.completeTask = async (taskId) => {
    try {
        await updateDoc(doc(db, 'tareas', taskId), { status: 'completed' });
        loadDayTasks();
    } catch (error) {
        console.error('Error completing task:', error);
    }
};

// Edit Task
window.editTask = async (taskId) => {
    try {
        const taskDoc = await getDocs(collection(db, 'tareas'));
        let taskData = null;
        
        taskDoc.forEach(doc => {
            if (doc.id === taskId) {
                taskData = doc.data();
            }
        });
        
        if (taskData) {
            editingTaskId = taskId;
            document.getElementById('modalTitle').textContent = 'Editar Tarea';
            document.getElementById('taskTitle').value = taskData.title;
            document.getElementById('taskDescription').value = taskData.description || '';
            
            // Set date
            selectedTaskDate = taskData.date;
            const date = new Date(taskData.date + 'T00:00:00');
            const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            document.getElementById('taskDate').value = `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
            
            // Set times
            document.getElementById('taskStartTime').value = taskData.startTime || taskData.time || '09:00 AM';
            document.getElementById('taskEndTime').value = taskData.endTime || calculateEndTimeFromDuration(taskData.time, taskData.duration) || '09:30 AM';
            
            document.getElementById('taskRecurring').checked = taskData.recurring || false;
            
            // Set icon and color
            selectedIcon = taskData.icon || 'tasks';
            selectedColor = taskData.color || '#6b7280';
            
            document.querySelectorAll('.icon-option-task').forEach(opt => opt.classList.remove('selected'));
            document.querySelector(`.icon-option-task[data-icon="${selectedIcon}"]`)?.classList.add('selected');
            
            document.querySelectorAll('.color-option-task').forEach(opt => opt.classList.remove('selected'));
            document.querySelector(`.color-option-task[data-color="${selectedColor}"]`)?.classList.add('selected');
            
            if (taskData.recurring) {
                document.getElementById('recurringOptions').style.display = 'block';
                document.getElementById('recurringFrequency').value = taskData.recurringFrequency;
                
                // Load selected days BEFORE calling updateRecurringOptions
                selectedWeekDays = taskData.selectedWeekDays || [];
                selectedMonthDays = taskData.selectedMonthDays || [];
                selectedEndDate = taskData.recurringEndDate || null;
                
                if (selectedEndDate) {
                    const date = new Date(selectedEndDate + 'T00:00:00');
                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    document.getElementById('recurringEndDate').value = `${date.getDate()} de ${monthNames[date.getMonth()]} de ${date.getFullYear()}`;
                }
                
                // Call with keepSelections = true to preserve loaded days
                updateRecurringOptions(true);
                
                // Select week days visually
                if (selectedWeekDays.length > 0) {
                    document.querySelectorAll('.week-day-option-task').forEach(opt => {
                        if (selectedWeekDays.includes(parseInt(opt.dataset.day))) {
                            opt.classList.add('selected');
                        }
                    });
                }
                
                // Select month days visually
                if (selectedMonthDays.length > 0) {
                    setTimeout(() => {
                        document.querySelectorAll('.month-day-option-task').forEach(opt => {
                            if (selectedMonthDays.includes(parseInt(opt.dataset.day))) {
                                opt.classList.add('selected');
                            }
                        });
                    }, 100);
                }
            }
            
            taskModal.classList.add('active');
        }
    } catch (error) {
        console.error('Error loading task:', error);
    }
};

// Delete Task
window.deleteTask = async (taskId) => {
    try {
        // Get task data to check if it's recurring
        const taskDoc = await getDocs(collection(db, 'tareas'));
        let taskData = null;
        
        taskDoc.forEach(doc => {
            if (doc.id === taskId) {
                taskData = { id: doc.id, ...doc.data() };
            }
        });
        
        if (!taskData) return;
        
        // If it's a recurring task, ask what to delete
        if (taskData.parentRecurring || taskData.recurring) {
            showRecurringDeleteModal(taskData);
        } else {
            // Regular task - just delete it
            showConfirmModal(
                '¿Eliminar tarea?',
                'Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar esta tarea?',
                async () => {
                    try {
                        await deleteDoc(doc(db, 'tareas', taskId));
                        
                        if (currentView === 'day') {
                            loadDayTasks();
                        } else {
                            loadCalendar();
                        }
                    } catch (error) {
                        console.error('Error deleting task:', error);
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error loading task:', error);
    }
};

// Show recurring delete modal
function showRecurringDeleteModal(taskData) {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal-task active';
    modal.innerHTML = `
        <div class="confirm-modal-content-task">
            <div class="confirm-modal-header-task">
                <i class="fas fa-trash-alt"></i>
                <h3>¿Eliminar tarea recurrente?</h3>
            </div>
            <div class="confirm-modal-body-task">
                <p>Esta es una tarea recurrente. ¿Qué deseas eliminar?</p>
            </div>
            <div class="confirm-modal-actions-task recurring-delete-actions-task">
                <button class="btn-confirm-cancel-task">Cancelar</button>
                <button class="btn-delete-this-task">Solo esta</button>
                <button class="btn-delete-future-task">Esta y futuras</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cancel button
    modal.querySelector('.btn-confirm-cancel-task').addEventListener('click', () => {
        modal.remove();
    });
    
    // Delete only this instance
    modal.querySelector('.btn-delete-this-task').addEventListener('click', async () => {
        modal.remove();
        try {
            await deleteDoc(doc(db, 'tareas', taskData.id));
            
            if (currentView === 'day') {
                loadDayTasks();
            } else {
                loadCalendar();
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    });
    
    // Delete this and all future instances
    modal.querySelector('.btn-delete-future-task').addEventListener('click', async () => {
        modal.remove();
        try {
            // Get all tasks
            const tasksSnap = await getDocs(collection(db, 'tareas'));
            const tasksToDelete = [];
            
            tasksSnap.forEach(docSnap => {
                const data = docSnap.data();
                
                // Check if it's the same recurring series
                const isSameSeries = 
                    data.title === taskData.title &&
                    data.startTime === taskData.startTime &&
                    data.endTime === taskData.endTime &&
                    data.recurring === taskData.recurring &&
                    (data.parentRecurring || data.recurring);
                
                // Delete if it's the same series and on or after the current date
                if (isSameSeries && data.date >= taskData.date) {
                    tasksToDelete.push(docSnap.id);
                }
            });
            
            // Delete all matching tasks
            for (const id of tasksToDelete) {
                await deleteDoc(doc(db, 'tareas', id));
            }
            
            if (currentView === 'day') {
                loadDayTasks();
            } else {
                loadCalendar();
            }
        } catch (error) {
            console.error('Error deleting recurring tasks:', error);
        }
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Show recurring edit modal
function showRecurringEditModal(originalTask, newTaskData) {
    const modal = document.createElement('div');
    modal.className = 'confirm-modal-task active';
    modal.innerHTML = `
        <div class="confirm-modal-content-task">
            <div class="confirm-modal-header-task">
                <i class="fas fa-edit"></i>
                <h3>¿Editar tarea recurrente?</h3>
            </div>
            <div class="confirm-modal-body-task">
                <p>Esta es una tarea recurrente. ¿Qué deseas actualizar?</p>
            </div>
            <div class="confirm-modal-actions-task recurring-delete-actions-task">
                <button class="btn-confirm-cancel-task">Cancelar</button>
                <button class="btn-delete-this-task">Solo esta</button>
                <button class="btn-delete-future-task">Esta y futuras</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const submitBtn = taskForm.querySelector('button[type="submit"]');
    
    // Cancel button
    modal.querySelector('.btn-confirm-cancel-task').addEventListener('click', () => {
        modal.remove();
        // Reset submit button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Guardar Tarea';
        }
        isSubmitting = false;
    });
    
    // Update only this instance
    modal.querySelector('.btn-delete-this-task').addEventListener('click', async () => {
        const btn = modal.querySelector('.btn-delete-this-task');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        
        try {
            await updateDoc(doc(db, 'tareas', originalTask.id), newTaskData);
            
            modal.remove();
            taskModal.classList.remove('active');
            if (currentView === 'day') {
                loadDayTasks();
            } else {
                loadCalendar();
            }
        } catch (error) {
            console.error('Error updating task:', error);
            modal.remove();
        } finally {
            // Reset submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar Tarea';
            }
            isSubmitting = false;
        }
    });
    
    // Update this and all future instances
    modal.querySelector('.btn-delete-future-task').addEventListener('click', async () => {
        const btn = modal.querySelector('.btn-delete-future-task');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        
        try {
            // Get all tasks
            const tasksSnap = await getDocs(collection(db, 'tareas'));
            const tasksToDelete = [];
            
            console.log('Tarea original:', originalTask);
            console.log('Nuevos datos:', newTaskData);
            
            tasksSnap.forEach(docSnap => {
                const data = docSnap.data();
                
                // Check if it's the same recurring series
                // Compare by title and time, and check if it's recurring
                const isSameSeries = 
                    data.title === originalTask.title &&
                    data.startTime === originalTask.startTime &&
                    data.endTime === originalTask.endTime &&
                    (data.recurring === true || data.parentRecurring === true);
                
                // Delete if it's the same series and on or after the current date
                if (isSameSeries && data.date >= originalTask.date) {
                    tasksToDelete.push(docSnap.id);
                }
            });
            
            console.log(`Encontradas ${tasksToDelete.length} tareas para eliminar y recrear`);
            
            // Delete all matching tasks
            for (const id of tasksToDelete) {
                await deleteDoc(doc(db, 'tareas', id));
            }
            
            console.log('Tareas eliminadas, recreando con nueva configuración...');
            
            // Now recreate tasks with new configuration starting from original date
            if (newTaskData.recurring) {
                const recreateData = {
                    ...newTaskData,
                    date: originalTask.date // Start from the original task date
                };
                await createRecurringTasks(recreateData);
            } else {
                // If it's no longer recurring, just create a single task
                await addDoc(collection(db, 'tareas'), {
                    ...newTaskData,
                    date: originalTask.date
                });
            }
            
            console.log('Actualización completada exitosamente');
            
            modal.remove();
            taskModal.classList.remove('active');
            
            // Wait a bit before reloading to ensure Firebase sync
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (currentView === 'day') {
                loadDayTasks();
            } else {
                loadCalendar();
            }
        } catch (error) {
            console.error('Error updating recurring tasks:', error);
            modal.remove();
        } finally {
            // Reset submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar Tarea';
            }
            isSubmitting = false;
        }
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            // Reset submit button
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar Tarea';
            }
            isSubmitting = false;
        }
    });
}

// Load Calendar
async function loadCalendar() {
    try {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        // Update header
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        currentMonthDisplay.textContent = `${monthNames[month]} ${year}`;
        
        // Get all tasks for the month
        const tasksSnap = await getDocs(collection(db, 'tareas'));
        const tasksByDate = {};
        
        tasksSnap.forEach(doc => {
            const data = doc.data();
            if (!tasksByDate[data.date]) {
                tasksByDate[data.date] = [];
            }
            tasksByDate[data.date].push({ id: doc.id, ...data });
        });
        
        // Generate calendar
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const prevLastDay = new Date(year, month, 0);
        
        const firstDayOfWeek = firstDay.getDay();
        const lastDateOfMonth = lastDay.getDate();
        const prevLastDate = prevLastDay.getDate();
        
        let html = '';
        
        // Day headers
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        dayNames.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });
        
        // Previous month days
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const day = prevLastDate - i;
            const date = new Date(year, month - 1, day);
            const dateStr = formatDateForInput(date);
            html += createCalendarDay(day, dateStr, tasksByDate[dateStr] || [], true);
        }
        
        // Current month days
        const today = formatDateForInput(new Date());
        for (let day = 1; day <= lastDateOfMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = formatDateForInput(date);
            const isToday = dateStr === today;
            html += createCalendarDay(day, dateStr, tasksByDate[dateStr] || [], false, isToday);
        }
        
        // Next month days
        const remainingDays = 42 - (firstDayOfWeek + lastDateOfMonth);
        for (let day = 1; day <= remainingDays; day++) {
            const date = new Date(year, month + 1, day);
            const dateStr = formatDateForInput(date);
            html += createCalendarDay(day, dateStr, tasksByDate[dateStr] || [], true);
        }
        
        calendarGrid.innerHTML = html;
    } catch (error) {
        console.error('Error loading calendar:', error);
    }
}

// Create Calendar Day Cell
function createCalendarDay(day, dateStr, tasks, otherMonth = false, isToday = false) {
    const classes = ['calendar-day-cell'];
    if (otherMonth) classes.push('other-month');
    if (isToday) classes.push('today');
    
    // Sort tasks by time before showing dots
    const sortedTasks = [...tasks].sort((a, b) => {
        const timeA = a.startTime || a.time || '00:00 AM';
        const timeB = b.startTime || b.time || '00:00 AM';
        return parseTime12Hour(timeA) - parseTime12Hour(timeB);
    });
    
    const taskDots = sortedTasks.slice(0, 3).map(task => 
        `<div class="calendar-task-dot" style="--task-color: ${task.color}"></div>`
    ).join('');
    
    const taskCount = tasks.length > 3 ? `<div class="calendar-task-count">+${tasks.length - 3} más</div>` : '';
    
    return `
        <div class="${classes.join(' ')}" onclick="selectCalendarDate('${dateStr}')">
            <div class="calendar-day-number">${day}</div>
            ${tasks.length > 0 ? `
                <div class="calendar-task-dots">${taskDots}</div>
                ${taskCount}
            ` : ''}
        </div>
    `;
}

// Select Calendar Date
window.selectCalendarDate = async (dateStr) => {
    // Show modal with tasks for this day
    await showDayTasksModal(dateStr);
};

// Show Day Tasks Modal
async function showDayTasksModal(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    
    document.getElementById('dayTasksModalTitle').textContent = `${dayName}`;
    document.getElementById('dayTasksModalDate').textContent = `${day} de ${month} de ${year}`;
    
    // Load tasks for this day
    try {
        const tasksSnap = await getDocs(collection(db, 'tareas'));
        const tasks = [];
        
        tasksSnap.forEach(doc => {
            const data = doc.data();
            if (data.date === dateStr) {
                tasks.push({ id: doc.id, ...data });
            }
        });
        
        // Sort by time
        tasks.sort((a, b) => {
            const timeA = a.startTime || a.time || '00:00 AM';
            const timeB = b.startTime || b.time || '00:00 AM';
            return parseTime12Hour(timeA) - parseTime12Hour(timeB);
        });
        
        const modalBody = document.getElementById('dayTasksModalBody');
        
        if (tasks.length === 0) {
            modalBody.innerHTML = `
                <div class="no-tasks-day-modal">
                    <i class="fas fa-calendar-times"></i>
                    <p>No hay tareas para este día</p>
                </div>
            `;
        } else {
            let html = '<div class="day-tasks-list-task">';
            
            tasks.forEach(task => {
                const statusClass = task.status || 'pending';
                const statusText = {
                    'pending': 'Pendiente',
                    'in-progress': 'En Progreso',
                    'completed': 'Completada',
                    'incomplete': 'Incompleta'
                }[statusClass];
                
                const startTime = task.startTime || task.time || '09:00 AM';
                const endTime = task.endTime || calculateEndTimeFromDuration(task.startTime || task.time, task.duration) || '09:30 AM';
                const taskIcon = task.icon || 'tasks';
                const taskColor = task.color || '#6b7280';
                
                html += `
                    <div class="day-task-item-modal" style="--task-color: ${taskColor}">
                        <div class="day-task-item-header-modal">
                            <div class="day-task-icon-modal">
                                <i class="fas fa-${taskIcon}"></i>
                            </div>
                            <div class="day-task-info-modal">
                                <div class="day-task-title-modal">${task.title}</div>
                                <div class="day-task-time-modal">
                                    <i class="fas fa-clock"></i>
                                    <span>${startTime} - ${endTime}</span>
                                </div>
                            </div>
                            <span class="task-status-badge ${statusClass} day-task-status-modal">${statusText}</span>
                        </div>
                        ${task.description ? `<div class="day-task-description-modal">${task.description}</div>` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
            modalBody.innerHTML = html;
        }
        
        document.getElementById('dayTasksModal').classList.add('active');
    } catch (error) {
        console.error('Error loading day tasks:', error);
    }
}

// Close day tasks modal
document.getElementById('closeDayTasksModal').addEventListener('click', () => {
    document.getElementById('dayTasksModal').classList.remove('active');
});

document.getElementById('dayTasksModal').addEventListener('click', (e) => {
    if (e.target.id === 'dayTasksModal') {
        document.getElementById('dayTasksModal').classList.remove('active');
    }
});

// Format Time
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Format Date for Input
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Show Toast Notification
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification-task toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add styles if not already added
    if (!document.getElementById('toast-styles-task')) {
        const style = document.createElement('style');
        style.id = 'toast-styles-task';
        style.textContent = `
            .toast-notification-task {
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.98) 100%);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 16px 24px;
                display: flex;
                align-items: center;
                gap: 12px;
                color: var(--color-white);
                font-size: 14px;
                font-weight: 500;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                z-index: 10000;
                animation: slideInRight-task 0.3s ease;
            }
            
            @keyframes slideInRight-task {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .toast-notification-task.toast-success {
                border-left: 4px solid #10b981;
            }
            
            .toast-notification-task.toast-error {
                border-left: 4px solid #ef4444;
            }
            
            .toast-notification-task.toast-info {
                border-left: 4px solid #6366f1;
            }
            
            .toast-notification-task i {
                font-size: 20px;
            }
            
            .toast-notification-task.toast-success i {
                color: #10b981;
            }
            
            .toast-notification-task.toast-error i {
                color: #ef4444;
            }
            
            .toast-notification-task.toast-info i {
                color: #6366f1;
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight-task 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Show Confirm Modal
function showConfirmModal(title, message, onConfirm) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'confirm-modal-task active';
    modal.innerHTML = `
        <div class="confirm-modal-content-task">
            <div class="confirm-modal-header-task">
                <i class="fas fa-question-circle"></i>
                <h3>${title}</h3>
            </div>
            <div class="confirm-modal-body-task">
                <p>${message}</p>
            </div>
            <div class="confirm-modal-actions-task">
                <button class="btn-confirm-cancel-task">Cancelar</button>
                <button class="btn-confirm-ok-task">Aceptar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.btn-confirm-cancel-task').addEventListener('click', () => {
        modal.remove();
    });
    
    modal.querySelector('.btn-confirm-ok-task').addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Initialize
loadDayTasks();
