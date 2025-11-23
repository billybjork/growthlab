/**
 * GrowthLab Configuration
 *
 * Global configuration for the GrowthLab application.
 */

const GROWTHLAB_CONFIG = {
  /**
   * Google Apps Script webhook URL for form submissions
   *
   * SECURITY: This value should be overridden in config.local.js
   *
   * Setup instructions:
   * 1. Create a Google Sheet for form responses
   * 2. Add the Google Apps Script code from /tools/Code.gs
   * 3. Deploy as web app and get the webhook URL
   * 4. Create public/js/config.local.js with:
   *    GROWTHLAB_CONFIG.FORMS_WEBHOOK_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   *
   * Note: config.local.js is gitignored to keep your webhook URL private
   */
  FORMS_WEBHOOK_URL: '',  // Override this in config.local.js

  /**
   * Enable debug logging for forms
   */
  DEBUG_FORMS: false,
};
