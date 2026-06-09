/**
 * Halo IT Services 365 - Utility Functions
 * Common helper functions for UI and data manipulation
 */

class UIUtils {
  /**
   * Show toast notification
   */
  static showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || this.createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${message}</span>
        <button class="close-btn" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: inherit;">×</button>
      </div>
    `;

    container.appendChild(toast);

    const closeBtn = toast.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => toast.remove());

    if (duration > 0) {
      setTimeout(() => toast.remove(), duration);
    }

    return toast;
  }

  /**
   * Create toast container if it doesn't exist
   */
  static createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 2000;
    `;
    document.body.appendChild(container);
    return container;
  }

  /**
   * Show alert message
   */
  static showAlert(message, type = 'info', containerId = null) {
    const container = containerId ? document.getElementById(containerId) : document.body;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${message}</span>
        <button class="close-btn" style="background: none; border: none; font-size: 1.25rem; cursor: pointer;">×</button>
      </div>
    `;

    const closeBtn = alert.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => alert.remove());

    if (containerId) {
      container.innerHTML = '';
      container.appendChild(alert);
    } else {
      document.body.insertBefore(alert, document.body.firstChild);
    }

    return alert;
  }

  /**
   * Show modal dialog
   */
  static showModal(title, content, buttons = []) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.id = 'app-modal';

    const contentHtml = typeof content === 'string' ? content : '';
    const buttonsHtml = buttons.map(btn => `
      <button class="btn ${btn.class || 'btn-primary'}" data-action="${btn.action}">
        ${btn.label}
      </button>
    `).join('');

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          ${contentHtml}
        </div>
        ${buttons.length > 0 ? `<div class="modal-footer">${buttonsHtml}</div>` : ''}
      </div>
    `;

    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.addEventListener('click', () => this.closeModal(modal));

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeModal(modal);
    });

    buttons.forEach(btn => {
      const btnEl = modal.querySelector(`[data-action="${btn.action}"]`);
      if (btnEl && btn.callback) {
        btnEl.addEventListener('click', () => {
          btn.callback();
          this.closeModal(modal);
        });
      }
    });

    document.body.appendChild(modal);
    return modal;
  }

  /**
   * Close modal
   */
  static closeModal(modal = null) {
    const target = modal || document.getElementById('app-modal');
    if (target) target.remove();
  }

  /**
   * Show loading indicator
   */
  static showLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '<div class="spinner"></div>';
    }
  }

  /**
   * Clear loading indicator
   */
  static clearLoading(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }
  }

  /**
   * Disable form
   */
  static disableForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.querySelectorAll('input, button, select, textarea').forEach(el => {
        el.disabled = true;
      });
    }
  }

  /**
   * Enable form
   */
  static enableForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.querySelectorAll('input, button, select, textarea').forEach(el => {
        el.disabled = false;
      });
    }
  }

  /**
   * Get form data as object
   */
  static getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};

    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
      if (data.hasOwnProperty(key)) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });

    return data;
  }

  /**
   * Set form data
   */
  static setFormData(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;

    Object.keys(data).forEach(key => {
      const input = form.elements[key];
      if (input) {
        if (input.type === 'checkbox') {
          input.checked = data[key];
        } else if (input.type === 'radio') {
          const radio = form.querySelector(`input[name="${key}"][value="${data[key]}"]`);
          if (radio) radio.checked = true;
        } else {
          input.value = data[key];
        }
      }
    });
  }

  /**
   * Clear form
   */
  static clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) form.reset();
  }

  /**
   * Show field error
   */
  static showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
      field.classList.add('error');
      const errorEl = document.createElement('div');
      errorEl.className = 'form-error';
      errorEl.textContent = message;
      field.parentNode.appendChild(errorEl);
    }
  }

  /**
   * Clear field errors
   */
  static clearFieldErrors(formId) {
    const form = document.getElementById(formId);
    if (form) {
      form.querySelectorAll('.form-error').forEach(el => el.remove());
      form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    }
  }
}

class DataFormatter {
  /**
   * Format date to readable string
   */
  static formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /**
   * Format datetime to readable string
   */
  static formatDateTime(dateTime) {
    if (!dateTime) return '-';
    const d = new Date(dateTime);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  static formatRelativeTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;

    return this.formatDate(date);
  }

  /**
   * Format number to currency
   */
  static formatCurrency(value, currency = 'USD') {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  }

  /**
   * Format number with commas
   */
  static formatNumber(value) {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US').format(value);
  }

  /**
   * Format percentage
   */
  static formatPercentage(value, decimals = 2) {
    if (value === null || value === undefined) return '-';
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Truncate text
   */
  static truncate(text, length = 50) {
    if (!text) return '-';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  /**
   * Capitalize first letter
   */
  static capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Convert status to badge class
   */
  static getStatusBadgeClass(status) {
    const statusMap = {
      'open': 'badge-info',
      'in_progress': 'badge-warning',
      'closed': 'badge-success',
      'on_hold': 'badge-warning',
      'cancelled': 'badge-danger',
    };
    return statusMap[status] || 'badge-primary';
  }

  /**
   * Convert priority to badge class
   */
  static getPriorityBadgeClass(priority) {
    const priorityMap = {
      'low': 'badge-info',
      'medium': 'badge-warning',
      'high': 'badge-warning',
      'critical': 'badge-danger',
    };
    return priorityMap[priority] || 'badge-primary';
  }
}

class ValidationUtils {
  /**
   * Validate email
   */
  static isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  /**
   * Validate phone
   */
  static isValidPhone(phone) {
    const regex = /^[\d\s\-\+\(\)]+$/;
    return regex.length >= 10 && regex.test(phone);
  }

  /**
   * Validate URL
   */
  static isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate password strength
   */
  static validatePassword(password) {
    const errors = [];
    if (password.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
    if (!/\d/.test(password)) errors.push('At least one number');
    if (!/[!@#$%^&*]/.test(password)) errors.push('At least one special character (!@#$%^&*)');

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export to global namespace
window.UIUtils = UIUtils;
window.DataFormatter = DataFormatter;
window.ValidationUtils = ValidationUtils;
