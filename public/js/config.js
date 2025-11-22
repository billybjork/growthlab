/**
 * GrowthLab Configuration
 *
 * Global configuration for the GrowthLab application.
 */

const GROWTHLAB_CONFIG = {
  /**
   * Google Apps Script webhook URL for form submissions
   *
   * Setup instructions:
   * 1. Create a Google Sheet for form responses
   * 2. Add the Google Apps Script code from /priv/Code.gs
   * 3. Deploy as web app and get the webhook URL
   * 4. Paste the URL below
   *
   * Example:
   * 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
   */
  FORMS_WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbzEp25QkGQtSC9SR8MAt7tzKz5D2SfBMQjv8fCE11V4fXppbbQ7-NR9ugT3YXqYjdzp/exec',

  /**
   * Enable debug logging for forms
   */
  DEBUG_FORMS: false,
};
