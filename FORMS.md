# GrowthLab Forms Guide

This guide explains how to set up and use form submissions with Google Sheets integration.

## Table of Contents
1. [One-Time Setup](#one-time-setup)
2. [How It Works](#how-it-works)
3. [Adding a New Form](#adding-a-new-form)
4. [Form Examples](#form-examples)
5. [Troubleshooting](#troubleshooting)

---

## One-Time Setup

Follow these steps once to enable form submissions:

### Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it something like "GrowthLab Form Responses"
4. Keep this tab open - you'll need it in the next step

### Step 2: Add the Google Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code in the editor
3. Open the file `/google-apps-script/Code.gs` from this repository
4. Copy the entire contents and paste into the Apps Script editor
5. Click **Save** (💾 icon)
6. Name your project (e.g., "GrowthLab Form Handler")

### Step 3: Deploy as Web App

1. In Apps Script, click **Deploy** → **New deployment**
2. Click the gear icon (⚙️) next to "Select type"
3. Choose **Web app**
4. Configure the deployment:
   - **Description:** "GrowthLab Forms v1"
   - **Execute as:** "Me" (your email)
   - **Who has access:** "Anyone"
5. Click **Deploy**
6. **Authorize** the app when prompted (you may see a warning - click "Advanced" → "Go to [project name]")
7. **Copy the Web App URL** (it will look like: `https://script.google.com/macros/s/ABC123.../exec`)

### Step 4: Add Webhook URL to Your App

1. Open `/src/js/config.js`
2. Paste your Web App URL inside the quotes for `FORMS_WEBHOOK_URL`:
   ```javascript
   FORMS_WEBHOOK_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
   ```
3. Save the file
4. Commit and push to deploy

### Step 5: Test It!

1. Deploy your changes to Railway
2. Navigate to a session with a form
3. Fill out and submit the form
4. Check your Google Sheet - a new tab should appear with the form data!

---

## How It Works

### Automatic Organization

When a user submits a form, the system automatically:

1. **Generates a persistent User ID** (stored in browser localStorage)
2. **Captures form data** + metadata (session, card, timestamp)
3. **Sends to Google Sheets** via the webhook
4. **Creates a new tab** if this is the first submission for that form
   - Tab name format: `{session}-{card}-{formId}`
   - Example: `session-01-card-3-feedback`
5. **Adds column headers** from form field names
6. **Appends a new row** with the response

### Data Structure

Each row in the sheet contains:
- **Timestamp** - When the form was submitted
- **User ID** - Persistent anonymous user identifier
- **[Form fields]** - All your custom form fields (email, answer, rating, etc.)
- **Session** - Which session file (e.g., "session-01")
- **Card** - Which card number (e.g., "card-3")
- **Form ID** - The form identifier from `data-form` attribute

---

## Adding a New Form

Every time you want to add a form to a card, follow these simple steps:

### Step 1: Add HTML to Your Markdown

In your session markdown file (e.g., `sessions/session-01.md`), add a form wrapped in a `div` with the `data-form` attribute:

```markdown
---
# Your Card Title

<div data-form="your-form-id">
  <label for="email">Email:</label>
  <input type="email" id="email" name="email" required />

  <label for="feedback">Feedback:</label>
  <textarea id="feedback" name="feedback" rows="4"></textarea>

  <button type="submit">Submit</button>
</div>
---
```

### Step 2: That's It!

Seriously - that's all you need to do. The system will:
- ✅ Automatically detect the form
- ✅ Wire up the submit handler
- ✅ Capture all input fields
- ✅ Create a new Google Sheet tab if needed
- ✅ Save responses with metadata

### Important Notes

- **`data-form` attribute is required** - This is how the system identifies forms
  - Use a descriptive ID: `data-form="feedback"`, `data-form="quiz"`, etc.
- **`name` or `id` required on inputs** - Field names come from the `name` or `id` attribute
- **Submit button required** - Use `<button type="submit">` or `<button class="form-submit">`

---

## Form Examples

### Example 1: Simple Feedback Form

```html
<div data-form="feedback">
  <p>How was this session?</p>

  <label for="email">Email:</label>
  <input type="email" id="email" name="email" required />

  <label for="rating">Rating:</label>
  <select id="rating" name="rating">
    <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
    <option value="4">⭐⭐⭐⭐ Good</option>
    <option value="3">⭐⭐⭐ Okay</option>
    <option value="2">⭐⭐ Poor</option>
    <option value="1">⭐ Very Poor</option>
  </select>

  <label for="comments">Comments:</label>
  <textarea id="comments" name="comments" rows="4"></textarea>

  <button type="submit">Submit Feedback</button>
</div>
```

**Result:** Creates tab `session-01-card-2-feedback` with columns: Timestamp, User ID, email, rating, comments, Session, Card, Form ID

---

### Example 2: Quiz Question

```html
<div data-form="quiz">
  <h3>Pop Quiz!</h3>
  <p>What is the capital of France?</p>

  <label for="email">Email:</label>
  <input type="email" id="email" name="email" required />

  <label for="answer">Your Answer:</label>
  <input type="text" id="answer" name="answer" required />

  <button type="submit">Submit Answer</button>
</div>
```

**Result:** Creates tab `session-01-card-5-quiz` with columns: Timestamp, User ID, email, answer, Session, Card, Form ID

---

### Example 3: Multiple Choice

```html
<div data-form="assessment">
  <h3>Self-Assessment</h3>

  <label for="email">Email:</label>
  <input type="email" id="email" name="email" required />

  <p>How confident do you feel about this topic?</p>

  <label>
    <input type="radio" name="confidence" value="very-confident" required />
    Very Confident
  </label>
  <label>
    <input type="radio" name="confidence" value="somewhat-confident" />
    Somewhat Confident
  </label>
  <label>
    <input type="radio" name="confidence" value="not-confident" />
    Not Confident
  </label>

  <button type="submit">Submit</button>
</div>
```

**Result:** Creates tab `session-01-card-7-assessment` with columns: Timestamp, User ID, email, confidence, Session, Card, Form ID

---

### Example 4: Checkboxes

```html
<div data-form="preferences">
  <h3>Which topics interest you?</h3>

  <label for="email">Email:</label>
  <input type="email" id="email" name="email" required />

  <label>
    <input type="checkbox" name="topic-seo" value="yes" />
    SEO
  </label>
  <label>
    <input type="checkbox" name="topic-ppc" value="yes" />
    PPC Advertising
  </label>
  <label>
    <input type="checkbox" name="topic-social" value="yes" />
    Social Media
  </label>

  <button type="submit">Submit</button>
</div>
```

**Result:** Each checkbox becomes a column with true/false values

---

## Troubleshooting

### Forms not working?

1. **Check the browser console** (F12 → Console tab)
   - You should see: `📋 GrowthLab Forms module loaded`
   - And: `📋 Form initialized: [formId]`

2. **Verify webhook URL is set**
   - Open `/src/js/config.js`
   - Make sure `FORMS_WEBHOOK_URL` has your Google Apps Script URL

3. **Check Google Apps Script deployment**
   - Make sure it's deployed as "Web app"
   - Verify "Who has access" is set to "Anyone"

### Responses not appearing in Google Sheet?

1. **Check Apps Script execution logs**
   - In Apps Script editor: **Executions** tab
   - Look for recent executions and any errors

2. **Test the script directly**
   - In Apps Script editor, select `testDoPost` function
   - Click **Run**
   - Check your Google Sheet for a test row

### Forms showing but submit doesn't work?

1. **Check for JavaScript errors** in browser console
2. **Verify form structure:**
   - Has `data-form` attribute on wrapper div
   - Inputs have `name` or `id` attributes
   - Has a submit button

### Need to update the webhook URL?

If you need to change the Google Apps Script deployment:

1. Update the URL in `/src/js/config.js`
2. Commit and push changes
3. No need to touch the Google Sheet or Apps Script code

---

## Advanced: Field Naming Best Practices

- **Use lowercase with hyphens:** `email`, `first-name`, `phone-number`
- **Be descriptive:** `rating` instead of `r`, `comments` instead of `c`
- **Keep consistent:** Use the same field name for email across all forms
- **Avoid special characters:** Stick to letters, numbers, and hyphens

This keeps your Google Sheet columns clean and readable!

---

## Questions or Issues?

If you encounter any problems, check:
1. Browser console for JavaScript errors
2. Google Apps Script execution logs
3. Make sure all setup steps were completed

Happy form building! 📋
