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
 * The script will auto-create tabs named: session-XX-card-Y-formId
 * Each tab gets column headers from your form fields.
 *
 */

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

// Test function (run this in Apps Script editor to verify it works)
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