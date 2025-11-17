// Sistema de notificaciones toast profesional
let toastContainer = null;

function createToastContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

export function showToast(message, type = 'info', duration = 4000) {
    const container = createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z" fill="currentColor"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" fill="currentColor"/></svg>',
        warning: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M1 17H19L10 2L1 17ZM11 14H9V12H11V14ZM11 10H9V6H11V10Z" fill="currentColor"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z" fill="currentColor"/></svg>'
    };
    
    const colors = {
        success: { bg: '#10b981', border: '#059669', shadow: 'rgba(16, 185, 129, 0.4)' },
        error: { bg: '#ef4444', border: '#dc2626', shadow: 'rgba(239, 68, 68, 0.4)' },
        warning: { bg: '#f59e0b', border: '#d97706', shadow: 'rgba(245, 158, 11, 0.4)' },
        info: { bg: '#3b82f6', border: '#2563eb', shadow: 'rgba(59, 130, 246, 0.4)' }
    };
    
    const color = colors[type] || colors.info;
    
    toast.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        background: ${color.bg};
        color: white;
        padding: 14px 18px;
        border-radius: 10px;
        border-left: 4px solid ${color.border};
        box-shadow: 0 8px 24px ${color.shadow}, 0 2px 8px rgba(0, 0, 0, 0.1);
        min-width: 300px;
        max-width: 450px;
        pointer-events: auto;
        cursor: pointer;
        animation: slideInRight 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        transition: all 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 500;
        line-height: 1.5;
    `;
    
    toast.innerHTML = `
        <div style="flex-shrink: 0; display: flex; align-items: center;">
            ${icons[type] || icons.info}
        </div>
        <div style="flex: 1; word-break: break-word;">
            ${message}
        </div>
        <button style="
            flex-shrink: 0;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 6px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            font-size: 18px;
            line-height: 1;
            padding: 0;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
           onmouseout="this.style.background='rgba(255,255,255,0.2)'">
            ×
        </button>
    `;
    
    // Hover effect
    toast.addEventListener('mouseenter', () => {
        toast.style.transform = 'translateX(-4px)';
        toast.style.boxShadow = `0 12px 32px ${color.shadow}, 0 4px 12px rgba(0, 0, 0, 0.15)`;
    });
    
    toast.addEventListener('mouseleave', () => {
        toast.style.transform = 'translateX(0)';
        toast.style.boxShadow = `0 8px 24px ${color.shadow}, 0 2px 8px rgba(0, 0, 0, 0.1)`;
    });
    
    // Close button
    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeToast(toast);
    });
    
    // Click to dismiss
    toast.addEventListener('click', () => {
        removeToast(toast);
    });
    
    container.appendChild(toast);
    
    // Auto remove
    const timeout = setTimeout(() => {
        removeToast(toast);
    }, duration);
    
    // Store timeout for manual removal
    toast._timeout = timeout;
    
    return toast;
}

function removeToast(toast) {
    if (toast._timeout) {
        clearTimeout(toast._timeout);
    }
    
    toast.style.animation = 'slideOutRight 0.3s ease forwards';
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        
        // Remove container if empty
        if (toastContainer && toastContainer.children.length === 0) {
            toastContainer.remove();
            toastContainer = null;
        }
    }, 300);
}

// Add animations to document
if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
        
        @media (max-width: 768px) {
            #toast-container {
                left: 20px;
                right: 20px;
                top: 20px;
            }
            
            .toast {
                min-width: auto !important;
                max-width: 100% !important;
            }
        }
    `;
    document.head.appendChild(style);
}
