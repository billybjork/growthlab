# GrowthLab AI Bootcamp Viewer

A Markdown-based slide deck viewer for instructors and students. Edit Markdown, refresh the browser, and present. No build steps, no dependencies, no complexity.

## Quick Start

```bash
python3 server.py
# Open http://localhost:8000
# Edit mode enabled - click "Edit" on any card to make changes
```

## Content Format

Sessions are Markdown files. Use `---` on its own line to create card boundaries. Supports standard Markdown (headings, lists, bold, italics, blockquotes, code blocks, tables, images).

## Forms & Data Collection

Add interactive forms to collect responses. Submissions auto-save to Google Sheets, organized by session/card.

### Setup

1. Create a Google Sheet for responses
2. Add Apps Script from `tools/Code.gs` (Extensions → Apps Script)
3. Deploy as web app (Execute as: Me, Access: Anyone)
4. Copy the webhook URL to `public/js/config.js` → `FORMS_WEBHOOK_URL`

**Important:** After modifying `Code.gs`, you must redeploy: Deploy → Manage deployments → Edit → Version: New version → Deploy

### Adding Forms

Wrap form HTML in a `div` with `data-form="id"`:

```html
<div data-form="quiz">
  <label for="email">Email:</label>
  <input type="email" name="email" required />

  <label for="answer">What is 2+2?</label>
  <input type="text" name="answer" required />

  <button type="submit">Submit</button>
</div>
```

Auto-creates Google Sheet tab (`session-XX-card-Y-quiz`), shows success message, advances to next card, tracks user ID.

### Slack Notifications (Optional)

Get notified in Slack when forms are submitted:

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) with scopes: `chat:write`, `users:read`, `users:read.email`
2. Install to workspace and copy the Bot Token (`xoxb-...`)
3. In Apps Script: Project Settings → Script Properties, add:
   - `SLACK_BOT_TOKEN`: your bot token
   - `SLACK_CHANNEL_ID`: target channel ID (right-click channel → View details → copy ID)
4. Create a "Users" tab in your sheet with columns: `Email`, `Slack User ID`, `Name`
5. Invite the bot to your channel: `/invite @GrowthLab`

Submissions post to the channel. Users in the lookup table also receive a DM confirmation.

## Edit Mode

Run `python3 server.py` to enable edit mode on localhost. Edit cards inline, upload images (auto-converts to WebP), save changes back to markdown files.

**Keyboard shortcuts:**
- `Cmd/Ctrl+E` - Edit current card
- `Cmd/Ctrl+S` - Save changes
- `Esc` - Cancel editing


## Creating New Sessions

1. Write outline (Word, Google Docs, or plain text)
2. Use system prompt from `tools/system-prompt.md` with Claude/LLM to convert to Markdown
3. Save output to `public/sessions/session-XX.md`
4. Add session to the list in `public/index.html`
5. Run `python3 server.py` and test in browser
6. Add images via edit mode UI