# GrowthLab AI Bootcamp Viewer

A Markdown-based slide deck viewer for instructors and students. Edit Markdown, refresh the browser, and present. No build steps, no dependencies, no complexity.

## Quick Start

### For Viewing (Production)
```bash
cd src/growthlab-viewer
python -m http.server 8000
# Open http://localhost:8000
```

### For Editing (Development)
```bash
cd src/growthlab-viewer
python3 server.py 8000
# Open http://localhost:8000
# Edit mode automatically enabled on localhost
```

Navigate with arrow keys, space, clicks, or hash URLs: `http://localhost:8000/session.html#session-01/0`

## Content Format: Markdown with YAML Front Matter

Each session is a single Markdown file with YAML metadata at the top.

### Front Matter

```yaml
---
id: session-01
title: "Foundations of AI for Creatives"
week: 1
day: 1
duration_minutes: 90
learning_objectives:
  - Understand AI tools for creative work
  - Explore practical applications
audience: "Designers & video editors at GrowthAssistant"
prework:
  - []
---
```

**Metadata fields:**
- `id`: Unique identifier (matches filename: `session-01.md` → `id: session-01`)
- `title`: Displayed in viewer header and session list
- `week`, `day`, `duration_minutes`: Shown in session meta
- `learning_objectives`: Array of goals for the session
- `audience`: Who this session is for
- `prework`: Array of pre-work items (use `[]` for none)

### Content Structure

After front matter, structure your content with:

- **`#`** – Session title (optional, can match front matter)
- **`##`** – Major time blocks / sections
  Example: `## 0–15 min · Pre-Work: Show & Tell`
- **`---`** (horizontal rule) – **Card boundary**
  Each card is roughly one "beat" or talking point
- **Standard Markdown** – paragraphs, lists, bold, italics, blockquotes, code blocks, tables, images

### Content Patterns (Micro-Language)

**Prompts** (for discussion):
```markdown
> Prompt: "Where in your workflow do you feel like a 'painter' vs a 'photographer'?"
```

**Activities**:
```markdown
### Activity: Precision Spectrum

1. Place examples on the FigJam board
2. Label each as "low precision" or "high precision"
3. Discuss which ones AI could handle
```

**Tools** (software/services to use):
```markdown
**Tool:** Gemini Advanced

- Use the "Help me create" feature in Docs
- Focus on drafting briefs, not final copy
```

**Assignments**:
```markdown
### Assignment #2: AI-Assisted Brand Explorations (Due next session)

- Pick 1–2 references from today
- Use Gemini to generate 3–5 alternative headlines
- Save outputs in shared folder
```

**Facilitator Notes** (only shown to instructor):
```markdown
**Facilitator notes:**

- Timebox shares to 10 minutes
- Highlight 2–3 best examples
```

### Example Card

```markdown
## 10–25 min · The Current AI Landscape

**Goal:** Understand what AI tools exist and what they're good at.

---

**Three broad categories:**

1. **Text-based** (ChatGPT, Claude, Gemini)
   - Fast ideation, copywriting, brief generation

2. **Image-based** (Midjourney, DALL-E, Stable Diffusion)
   - Visual exploration, concept art

3. **Video-based** (Runway, Synthesia)
   - B-roll generation, editing

---

> Prompt: "What gaps do you see in your current toolset?"
```

Each `---` creates a new card. Cards display in a 3D stack (active card visible, next 1–2 cards peeking behind).

## Navigation

**Keyboard:**
- `→` / `Space` / `Page Down` – Next card
- `←` / `Page Up` – Previous card
- `Home` / `End` – First / last card

**Mouse/Touch:**
- Click right 70% of card → Next
- Click left 30% of card → Previous

**URL Hash:**
```
session.html#session-02/3   # Session 2, Card 3
session.html#session-01/0   # Session 1, Card 0
```

## Edit Mode (Local Development)

When running the custom dev server (`python3 server.py`), edit mode is automatically enabled on localhost. This allows you to edit cards and upload images directly through the browser.

### Features

**Edit any card:**
- Click the "✎ Edit" button in the top-right of any card
- Edit text inline (contenteditable)
- Click "💾 Save" to persist changes to the markdown file
- Click "✕ Cancel" to discard changes

**Upload images:**
- Click "+ Add Image" while editing a card
- Select an image file (PNG, JPG, GIF, etc.)
- Image is automatically converted to WebP and saved to `media/session-XX/`
- Image appears in the card immediately
- Click Save when done with all edits

**Keyboard shortcuts:**
- `Cmd/Ctrl+E` - Edit current card
- `Cmd/Ctrl+S` - Save changes
- `Esc` - Cancel editing

**Navigation disabled while editing:**
- Arrow keys and drag/swipe are disabled in edit mode
- Allows proper text selection and editing
- Re-enabled when you save or cancel

### How It Works

1. Run `python3 server.py` (not the default `python -m http.server`)
2. Navigate to any session
3. Edit mode buttons appear automatically on localhost
4. Click "Edit" on any card to start editing
5. Upload images with the "+ Add Image" button - they're converted to WebP automatically
6. Click "Save" to persist changes to the markdown files

**Note:**
- Edit mode only works on `localhost` - it won't appear on deployed/production sites
- Images are converted using ImageMagick or FFmpeg (one must be installed)
- Converted images are saved directly to `media/session-XX/` (no intermediate folder needed)

## Images (Manual Workflow)

If you prefer to add images without using the edit mode UI:

### Adding Images Manually

1. Convert your images to WebP format (using ImageMagick, online tools, etc.)
   ```bash
   # Using ImageMagick:
   convert your-image.png -resize 1600x> -quality 75 output.webp

   # Using FFmpeg:
   ffmpeg -i your-image.png -vf scale=1600:-1 -q:v 5 output.webp
   ```

2. Place converted images directly in `media/session-XX/`
   ```
   media/
   └── session-02/
       ├── figjam-spectrum.webp
       ├── prototype.webp
       └── demo.webp
   ```

3. Reference in Markdown:
   ```markdown
   ![Precision spectrum board](media/session-02/figjam-spectrum.webp)
   ```

**Note:** The edit mode UI (available on localhost) handles conversion automatically, so manual conversion is only needed for batch operations or when working without the dev server.

## Creating New Sessions

### Using the System Prompt

To convert your session outlines to Markdown, use the system prompt from `priv/system-prompt.md` with Claude or your preferred LLM.

**Workflow:**
1. Copy the prompt from `priv/system-prompt.md`
2. Say: `id: session-02, week: 1, day: 2, duration_minutes: 90`
3. Paste your raw outline
4. Copy the Markdown output into `sessions/session-02.md`
5. Do a human pass to adjust card breaks and wording if needed

### Workflow

1. Write outline (Word, Google Docs, or plain text)
2. Use system prompt to generate Markdown
3. Place in `sessions/session-XX.md`
4. Start dev server: `python3 server.py`
5. Add images via edit mode UI (automatically converts to WebP)
6. Test in browser

## Hosting

For students to access:

**Option 1: Netlify / Vercel** (Recommended)
- Push repo to GitHub
- Connect to Netlify/Vercel
- Deploy static site
- Share URL with students

**Option 2: GitHub Pages**
- Push repo to GitHub
- Enable Pages in settings
- Students access via `https://username.github.io/growthlab-viewer`

**Option 3: Custom Server**
- Copy folder to your web server
- Serve with any HTTP server

All sessions work offline (for offline viewing, share the repo as a zip—students can open `index.html` locally if you enable CORS or run a local server).

## Troubleshooting

**"marked is not defined" error:**
- Check browser console for CDN load errors
- Verify internet connection (marked loads from unpkg CDN)
- Try refresh with Cmd+Shift+R (hard refresh)

**Images not loading:**
- Verify paths are relative: `../media/session-XX/image.webp`
- Check that converted images exist in `media/` folder
- Ensure WebP format or browser support

**Cards not splitting:**
- Make sure you use `---` on its own line to delimit cards
- Don't use `---` in content (use `***` or `___` instead)

**Hash navigation not working:**
- Verify session file exists: `sessions/session-XX.md`
- Check URL format: `session.html#session-01/0`
- Browser may cache old hash—do a hard refresh
