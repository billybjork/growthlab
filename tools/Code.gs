/**
 * GrowthLab Form Response Handler
 *
 * This script receives form submissions from the GrowthLab app and automatically
 * organizes them into tabs based on session, card, and form ID.
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Create a new Google Sheet for form responses
 * 2. In your sheet: Extensions → Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Click Save (💾 icon)
 * 5. Click Deploy → New deployment
 * 6. Click gear icon (⚙️) → Select "Web app"
 * 7. Configure:
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone"
 * 8. Click Deploy
 * 9. Authorize when prompted (you may see a warning - click Advanced → Go to project)
 * 10. Copy the Web App URL
 * 11. Paste URL into public/js/config.js → FORMS_WEBHOOK_URL
 *
 * SLACK INTEGRATION SETUP:
 *
 * 1. Create a Slack app at https://api.slack.com/apps
 * 2. Add Bot Token Scopes: chat:write, users:read, users:read.email
 * 3. Install to workspace and copy the Bot User OAuth Token
 * 4. In Apps Script: Project Settings → Script Properties, add:
 *    - SLACK_BOT_TOKEN: your bot token (xoxb-...)
 *    - SLACK_CHANNEL_ID: target channel ID (C...)
 * 5. Create a "Users" tab in your sheet with columns: Email, Slack User ID, Name
 * 6. Invite the bot to your channel: /invite @GrowthLab
 *
 * IMPORTANT: After making any changes to this script, you must redeploy:
 * Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy
 *
 * The script will auto-create tabs named: session-XX-card-Y-formId
 * Each tab gets column headers from your form fields.
 *
 */

// ============================================================================
// SLACK INTEGRATION
// ============================================================================

/**
 * Look up a user's Slack ID by their email address.
 * Reads from the "Users" tab in the spreadsheet.
 * @param {string} email - The email to look up
 * @returns {string|null} - Slack User ID or null if not found
 */
function getSlackUserIdByEmail(email) {
  if (!email) return null;

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = spreadsheet.getSheetByName('Users');

  if (!usersSheet) {
    Logger.log('Warning: "Users" tab not found. Slack DMs will be skipped.');
    return null;
  }

  const data = usersSheet.getDataRange().getValues();
  const normalizedEmail = email.toLowerCase().trim();

  // Skip header row, find matching email
  for (let i = 1; i < data.length; i++) {
    const rowEmail = (data[i][0] || '').toString().toLowerCase().trim();
    if (rowEmail === normalizedEmail) {
      return data[i][1] || null; // Column B = Slack User ID
    }
  }

  return null;
}

/**
 * Send a message to Slack using Block Kit formatting.
 * @param {string} channelOrUserId - Channel ID (C...) or User ID (U...) for DM
 * @param {Object[]} blocks - Slack Block Kit blocks array
 * @param {string} text - Fallback text for notifications
 * @returns {Object} - Response from Slack API
 */
function sendSlackMessage(channelOrUserId, blocks, text) {
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');

  if (!token) {
    Logger.log('Warning: SLACK_BOT_TOKEN not configured. Skipping Slack notification.');
    return { ok: false, error: 'token_not_configured' };
  }

  const payload = {
    channel: channelOrUserId,
    blocks: blocks,
    text: text // Fallback for notifications
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
    const result = JSON.parse(response.getContentText());

    if (!result.ok) {
      Logger.log('Slack API error: ' + result.error);
    }

    return result;
  } catch (error) {
    Logger.log('Slack request failed: ' + error.toString());
    return { ok: false, error: error.toString() };
  }
}

/**
 * Build Slack Block Kit blocks for a form submission.
 * @param {Object} data - The form submission data
 * @param {string} tabName - The sheet tab name
 * @param {Date} timestamp - Submission timestamp
 * @param {boolean} isDM - Whether this is for a DM (changes header text)
 * @returns {Object[]} - Array of Slack blocks
 */
function buildSubmissionBlocks(data, tabName, timestamp, isDM) {
  const session = data._session || 'unknown';
  const card = data._card || 'unknown';
  const formId = data._formId || 'unknown';
  const email = data.email || 'unknown';

  const formattedTime = Utilities.formatDate(
    timestamp,
    Session.getScriptTimeZone(),
    'MMM d, yyyy \'at\' h:mm a'
  );

  const blocks = [];

  // Header
  if (isDM) {
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: '📝 Form Submission Received', emoji: true }
    });
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `Your response to *${formId}* has been saved.` }
    });
  } else {
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: '📬 New Form Submission', emoji: true }
    });
  }

  // Metadata section
  const metaText = isDM
    ? `*Session:* ${session}\n*Card:* ${card}\n*Submitted:* ${formattedTime}`
    : `*Form:* ${formId}\n*Session:* ${session} | *Card:* ${card}\n*Submitted by:* ${email}\n*Time:* ${formattedTime}`;

  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: metaText }
  });

  // Divider
  blocks.push({ type: 'divider' });

  // Form responses header
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: isDM ? '*Your Responses:*' : '*Responses:*' }
  });

  // Form fields (exclude metadata fields starting with _)
  for (const key in data) {
    if (!key.startsWith('_')) {
      const value = data[key] || '(empty)';
      const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

      // Truncate long values for Slack's limits (3000 char max per text block)
      const truncatedValue = value.length > 500
        ? value.substring(0, 497) + '...'
        : value;

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*${displayKey}:*\n${truncatedValue}` }
      });
    }
  }

  // Final divider
  blocks.push({ type: 'divider' });

  return blocks;
}

/**
 * Send Slack notifications for a form submission.
 * Sends to both the configured channel and (if found) the user via DM.
 * @param {Object} data - The form submission data
 * @param {string} tabName - The sheet tab name
 * @param {Date} timestamp - Submission timestamp
 */
function notifySlack(data, tabName, timestamp) {
  const channelId = PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL_ID');
  const email = data.email;
  const formId = data._formId || 'form';

  // Send channel notification (always)
  if (channelId) {
    const channelBlocks = buildSubmissionBlocks(data, tabName, timestamp, false);
    sendSlackMessage(
      channelId,
      channelBlocks,
      `New submission to ${formId} from ${email || 'unknown'}`
    );
  }

  // Send DM to user (if email found in Users tab)
  if (email) {
    const slackUserId = getSlackUserIdByEmail(email);
    if (slackUserId) {
      const dmBlocks = buildSubmissionBlocks(data, tabName, timestamp, true);
      sendSlackMessage(
        slackUserId,
        dmBlocks,
        `Your response to ${formId} has been saved.`
      );
    }
  }
}

// ============================================================================
// FORM SUBMISSION HANDLER
// ============================================================================

function doPost(e) {
  try {
    // Parse the incoming JSON data
    const data = JSON.parse(e.postData.contents);

    // Extract metadata
    const session = data._session || 'unknown-session';
    const card = data._card || 'unknown-card';
    const formId = data._formId || 'unknown-form';
    const timestamp = new Date();

    // Create tab name: session-card-formId
    const tabName = `${session}-${card}-${formId}`;

    // Get or create the sheet tab
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(tabName);

    // If sheet doesn't exist, create it with headers
    if (!sheet) {
      sheet = spreadsheet.insertSheet(tabName);

      // Create column headers
      const headers = ['Timestamp', 'User ID'];
      const formFields = [];

      // Add all form fields (excluding internal metadata fields that start with _)
      for (const key in data) {
        if (!key.startsWith('_')) {
          headers.push(key);
          formFields.push(key);
        }
      }

      // Add metadata columns at the end
      headers.push('Session', 'Card', 'Form ID');

      // Write headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // Format header row
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4285f4')
        .setFontColor('#ffffff');

      // Freeze header row
      sheet.setFrozenRows(1);

      // Auto-resize columns
      for (let i = 1; i <= headers.length; i++) {
        sheet.autoResizeColumn(i);
      }
    }

    // Get headers from existing sheet
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Build row data matching header order
    const rowData = [];
    for (const header of headers) {
      if (header === 'Timestamp') {
        rowData.push(timestamp);
      } else if (header === 'User ID') {
        rowData.push(data._userId || '');
      } else if (header === 'Session') {
        rowData.push(session);
      } else if (header === 'Card') {
        rowData.push(card);
      } else if (header === 'Form ID') {
        rowData.push(formId);
      } else {
        // Form field data
        rowData.push(data[header] || '');
      }
    }

    // Append the row
    sheet.appendRow(rowData);

    // Send Slack notifications (non-blocking, errors don't fail submission)
    try {
      notifySlack(data, tabName, timestamp);
    } catch (slackError) {
      Logger.log('Slack notification error (non-fatal): ' + slackError.toString());
    }

    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Response saved successfully',
        tab: tabName
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

// Test the form submission handler (run in Apps Script editor)
function testDoPost() {
  const testPayload = {
    postData: {
      contents: JSON.stringify({
        _session: 'session-01',
        _card: 'card-3',
        _formId: 'test-quiz',
        _userId: 'test-user-123',
        email: 'test@example.com',
        answer: 'Test answer',
        rating: '5'
      })
    }
  };

  const result = doPost(testPayload);
  Logger.log(result.getContent());
}

// Test Slack channel notification (run in Apps Script editor)
function testSlackChannel() {
  const testData = {
    _session: 'session-01',
    _card: 'card-3',
    _formId: 'test-form',
    _userId: 'test-user-123',
    email: 'test@example.com',
    question1: 'This is a test response to question 1.',
    question2: 'This is a test response to question 2.'
  };

  const channelId = PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL_ID');

  if (!channelId) {
    Logger.log('ERROR: SLACK_CHANNEL_ID not set. Go to Project Settings → Script Properties.');
    return;
  }

  const blocks = buildSubmissionBlocks(testData, 'test-tab', new Date(), false);
  const result = sendSlackMessage(channelId, blocks, 'Test notification from GrowthLab');

  Logger.log('Result: ' + JSON.stringify(result));
}

// Test Slack DM (requires a valid email in the Users tab)
function testSlackDM() {
  // Change this to an email that exists in your Users tab
  const testEmail = 'test@example.com';

  const slackUserId = getSlackUserIdByEmail(testEmail);

  if (!slackUserId) {
    Logger.log('ERROR: No Slack ID found for ' + testEmail + '. Add this email to the Users tab.');
    return;
  }

  const testData = {
    _session: 'session-01',
    _card: 'card-3',
    _formId: 'test-form',
    email: testEmail,
    response: 'This is a test DM to verify your Slack integration works!'
  };

  const blocks = buildSubmissionBlocks(testData, 'test-tab', new Date(), true);
  const result = sendSlackMessage(slackUserId, blocks, 'Test DM from GrowthLab');

  Logger.log('Result: ' + JSON.stringify(result));
}

// Verify Slack configuration is complete
function checkSlackConfig() {
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  const channelId = PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL_ID');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const usersSheet = spreadsheet.getSheetByName('Users');

  Logger.log('=== Slack Configuration Check ===');
  Logger.log('SLACK_BOT_TOKEN: ' + (token ? '✓ Set (' + token.substring(0, 10) + '...)' : '✗ NOT SET'));
  Logger.log('SLACK_CHANNEL_ID: ' + (channelId ? '✓ Set (' + channelId + ')' : '✗ NOT SET'));
  Logger.log('Users tab: ' + (usersSheet ? '✓ Exists' : '✗ NOT FOUND'));

  if (usersSheet) {
    const rowCount = usersSheet.getLastRow() - 1; // Exclude header
    Logger.log('Users in lookup table: ' + Math.max(0, rowCount));
  }

  if (!token || !channelId) {
    Logger.log('\nTo fix: Go to Project Settings → Script Properties and add the missing values.');
  }
}