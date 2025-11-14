// Create confirm modal if it doesn't exist
let confirmModalElement = document.getElementById('confirmModal');
if (!confirmModalElement) {
    confirmModalElement = document.createElement('div');
    confirmModalElement.id = 'confirmModal';
    confirmModalElement.className = 'confirm-modal';
    confirmModalElement.innerHTML = `
        <div class="confirm-modal-content">
            <div class="confirm-modal-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3 class="confirm-modal-title" id="confirmTitle">¿Estás seguro?</h3>
            <p class="confirm-modal-message" id="confirmMessage">Esta acción no se puede deshacer.</p>
            <div class="confirm-modal-actions">
                <button class="btn btn-secondary" id="confirmCancel">Cancelar</button>
                <button class="btn btn-expense" id="confirmOk">Eliminar</button>
            </div>
        </div>
    `;
    document.body.appendChild(confirmModalElement);
}

let confirmResolve = null;

export function showConfirm(title = '¿Estás seguro?', message = 'Esta acción no se puede deshacer.', okText = 'Eliminar') {
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

// Event listeners
document.addEventListener('click', (e) => {
    if (e.target.id === 'confirmOk') {
        closeConfirmModal(true);
    } else if (e.target.id === 'confirmCancel') {
        closeConfirmModal(false);
    } else if (e.target.id === 'confirmModal') {
        closeConfirmModal(false);
    }
});

// ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmModalElement.classList.contains('active')) {
        closeConfirmModal(false);
    }
});
