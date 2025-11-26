/**
 * GrowthLab Form Handler
 *
 * Automatically detects and handles forms in session cards.
 * Sends data to Google Sheets via webhook.
 */

(function() {
  'use strict';

  // Check if config is loaded
  if (typeof GROWTHLAB_CONFIG === 'undefined' || !GROWTHLAB_CONFIG.FORMS_WEBHOOK_URL) {
    console.warn('⚠️ Forms disabled: FORMS_WEBHOOK_URL not configured in config.js');
    return;
  }

  const WEBHOOK_URL = GROWTHLAB_CONFIG.FORMS_WEBHOOK_URL;
  const USER_ID_KEY = 'growthlab_user_id';

  // Generate or retrieve persistent user ID
  function getUserId() {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      // Generate a unique ID: timestamp + random string
      userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  }

  // Get current session and card info
  function getSessionInfo() {
    const params = new URLSearchParams(window.location.search);
    const sessionFile = params.get('file') || 'session-01';
    const cardIndex = params.get('card') || '0';

    return {
      _session: sessionFile,
      _card: `card-${cardIndex}`
    };
  }

  // Show success message
  function showSuccessMessage(form) {
    // Create success message element
    const message = document.createElement('div');
    message.className = 'form-success-message';
    message.textContent = '✓ Response saved successfully!';
    message.style.cssText = `
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      margin-top: 16px;
      font-weight: 500;
      text-align: center;
      animation: slideIn 0.3s ease;
    `;

    // Add animation
    if (!document.querySelector('style#form-animations')) {
      const style = document.createElement('style');
      style.id = 'form-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Insert after form
    form.parentElement.appendChild(message);

    // Remove after 3 seconds
    setTimeout(() => {
      message.style.transition = 'opacity 0.3s ease';
      message.style.opacity = '0';
      setTimeout(() => message.remove(), 300);
    }, 3000);
  }

  // Show error message
  function showErrorMessage(form, errorText) {
    const message = document.createElement('div');
    message.className = 'form-error-message';
    message.textContent = `✗ Error: ${errorText}`;
    message.style.cssText = `
      background: #ef4444;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      margin-top: 16px;
      font-weight: 500;
      text-align: center;
    `;

    form.parentElement.appendChild(message);

    setTimeout(() => {
      message.style.transition = 'opacity 0.3s ease';
      message.style.opacity = '0';
      setTimeout(() => message.remove(), 300);
    }, 5000);
  }

  /**
   * Submit form data to Google Sheets via webhook
   *
   * IMPORTANT: For better error handling, update your Google Apps Script to include CORS headers:
   *
   * function doPost(e) {
   *   // Your existing code...
   *   return ContentService.createTextOutput(JSON.stringify({success: true}))
   *     .setMimeType(ContentService.MimeType.JSON)
   *     .setHeader('Access-Control-Allow-Origin', '*');
   * }
   *
   * Then remove mode: 'no-cors' below to enable proper response handling.
   *
   * @param {Object} formData - Form data to submit
   * @returns {Promise<Object>} - Success status and error if any
   */
  async function submitFormData(formData) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors', // TODO: Remove this after adding CORS headers to Google Apps Script
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      // Note: no-cors mode prevents reading response status
      // We can only detect network errors, not submission failures
      // This is a limitation until CORS headers are added to the webhook
      return { success: true };

    } catch (error) {
      console.error('[Forms] Submission error:', error);
      return { success: false, error: error.message };
    }
  }

  // Initialize form handler for a specific form element
  function initForm(formElement) {
    const formId = formElement.dataset.form;

    if (!formId) {
      console.warn('Form missing data-form attribute:', formElement);
      return;
    }

    // Skip if already initialized (prevent duplicate handlers)
    if (formElement.dataset.formInitialized === 'true') {
      return;
    }
    formElement.dataset.formInitialized = 'true';

    // Find the actual <form> element or create a virtual form
    let form = formElement.tagName === 'FORM'
      ? formElement
      : formElement.querySelector('form');

    // If no <form> tag, handle it as a div with inputs
    const isVirtualForm = !form;

    if (isVirtualForm) {
      form = formElement;
    }

    // Find submit button
    const submitButton = form.querySelector('button[type="submit"], button.form-submit');

    if (!submitButton) {
      console.warn('Form missing submit button:', formElement);
      return;
    }

    /**
     * Validate form inputs with custom error messages
     * @returns {Object} - { valid: boolean, errors: string[] }
     */
    const validateForm = () => {
      const inputs = form.querySelectorAll('input, textarea, select');
      const errors = [];

      inputs.forEach(input => {
        // Skip buttons and non-input elements
        if (input.type === 'submit' || input.type === 'button') return;

        // Required field validation
        if (input.hasAttribute('required') && !input.value.trim()) {
          const label = input.getAttribute('aria-label') || input.placeholder || input.name;
          errors.push(`${label} is required`);
          return;
        }

        // Email validation
        if (input.type === 'email' && input.value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(input.value)) {
            errors.push('Please enter a valid email address');
          }
        }

        // Number validation
        if (input.type === 'number' && input.value) {
          const num = parseFloat(input.value);
          if (input.hasAttribute('min') && num < parseFloat(input.min)) {
            errors.push(`${input.name} must be at least ${input.min}`);
          }
          if (input.hasAttribute('max') && num > parseFloat(input.max)) {
            errors.push(`${input.name} must be at most ${input.max}`);
          }
        }

        // Text length validation
        if ((input.type === 'text' || input.tagName === 'TEXTAREA') && input.value) {
          if (input.hasAttribute('minlength') && input.value.length < parseInt(input.minlength)) {
            errors.push(`${input.name} must be at least ${input.minlength} characters`);
          }
          if (input.hasAttribute('maxlength') && input.value.length > parseInt(input.maxlength)) {
            errors.push(`${input.name} must be at most ${input.maxlength} characters`);
          }
        }
      });

      return {
        valid: errors.length === 0,
        errors
      };
    };

    // Handle form submission
    const handleSubmit = async (e) => {
      e.preventDefault();

      // Validate form inputs
      const validation = validateForm();
      if (!validation.valid) {
        showErrorMessage(form, validation.errors.join(', '));
        return;
      }

      // Disable submit button during submission
      submitButton.disabled = true;
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Submitting...';

      // Collect form data
      const inputs = form.querySelectorAll('input, textarea, select');
      const formData = {
        _userId: getUserId(),
        _formId: formId,
        ...getSessionInfo()
      };

      // Add all input values
      inputs.forEach(input => {
        const name = input.name || input.id;
        if (name && !name.startsWith('_')) {
          if (input.type === 'checkbox') {
            formData[name] = input.checked;
          } else if (input.type === 'radio') {
            if (input.checked) {
              formData[name] = input.value;
            }
          } else {
            formData[name] = input.value;
          }
        }
      });

      // Submit to Google Sheets
      const result = await submitFormData(formData);

      // Re-enable button
      submitButton.disabled = false;
      submitButton.textContent = originalText;

      if (result.success) {
        showSuccessMessage(form);

        // Clear form inputs
        inputs.forEach(input => {
          if (input.type !== 'submit' && input.type !== 'button') {
            if (input.type === 'checkbox' || input.type === 'radio') {
              input.checked = false;
            } else {
              input.value = '';
            }
          }
        });

        // Auto-advance to next card after showing success message
        setTimeout(() => {
          const nextButton = document.getElementById('next-btn');
          if (nextButton && !nextButton.disabled) {
            nextButton.click();
          }
        }, 1500); // Wait 1.5 seconds so user sees the success message
      } else {
        showErrorMessage(form, result.error || 'Could not save response');
      }
    };

    // Attach event listener
    if (isVirtualForm) {
      submitButton.addEventListener('click', handleSubmit);
    } else {
      form.addEventListener('submit', handleSubmit);
    }

  }

  /**
   * Initialize all forms when DOM is ready
   * Uses both MutationObserver and setTimeout to catch forms whenever they appear
   */
  function initAllForms() {
    let initialized = false;

    const tryInit = () => {
      if (initialized) return;

      const forms = document.querySelectorAll('[data-form]');
      if (forms.length > 0) {
        forms.forEach(initForm);
        initialized = true;
        if (observer) observer.disconnect();
      }
    };

    // Watch for forms being added to the DOM
    const observer = new MutationObserver(tryInit);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Fallback: try after 500ms in case observer misses the forms
    setTimeout(tryInit, 500);
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllForms);
  } else {
    initAllForms();
  }

})();
