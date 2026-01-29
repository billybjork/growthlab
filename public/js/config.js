/**
 * GrowthLab Configuration
 *
 * MULTI-COHORT FORM SUBMISSION SETUP:
 *
 * Each cohort requires its own Google Sheet and Apps Script deployment:
 *
 * 1. Create a new Google Sheet for the cohort
 * 2. In the sheet: Extensions → Apps Script
 * 3. Copy the contents of tools/Code.gs into the script editor
 * 4. Deploy as Web App:
 *    - Click Deploy → New deployment
 *    - Select type: Web app
 *    - Execute as: Me (your email)
 *    - Who has access: Anyone
 * 5. Copy the Web App URL and add it below under COHORT_WEBHOOKS
 *
 * For Slack notifications (optional):
 * - In Apps Script: Project Settings → Script Properties
 * - Add SLACK_BOT_TOKEN (xoxb-...) and SLACK_CHANNEL_ID (C...)
 * - Create a "Users" tab in the sheet with columns: Email, Slack User ID, Name
 * - Slack messages are handled entirely by the Apps Script, not this website
 *
 * To get the webhook URL for an existing deployment:
 * - Open the Google Sheet → Extensions → Apps Script
 * - Click Deploy → Manage deployments
 * - Copy the Web App URL from the active deployment
 */

const GROWTHLAB_CONFIG = {
  /**
   * Webhook URLs for each cohort's Google Apps Script.
   * Each cohort should have its own Google Sheet + Apps Script deployment.
   * The key must match the cohort folder name (e.g., "cohort-01", "cohort-02").
   */
  COHORT_WEBHOOKS: {
    'cohort-01': 'https://script.google.com/macros/s/AKfycbznzbDUcwaGI7pjr7ESDDWBAKqUanqzY96IoF6xXmNW4142S4pTYIK7VT35VlHm8NwP/exec',
    'cohort-02': 'https://script.google.com/macros/s/AKfycbzPE42hbmlOmGvQvRoxEoeRUK2ZFjkq5s-4HIALOiX2sGsIDcGW8JeZXb10htQ8fCAe/exec',
  },

  /**
   * Default cohort to use if none specified (for backwards compatibility)
   */
  DEFAULT_COHORT: 'cohort-01',

  /**
   * Enable debug logging for forms
   */
  DEBUG_FORMS: false,
};
