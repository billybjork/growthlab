# GrowthLab AI Bootcamp Viewer

A Markdown-based slide deck viewer for instructors and students. Edit Markdown, refresh the browser, and present. No build steps, no dependencies, no complexity.

## Quick Start

```bash
cd src/growthlab-viewer
python -m http.server 8000
# Open http://localhost:8000
```

Navigate with arrow keys, space, clicks, or hash URLs: `http://localhost:8000/session.html#session-01/0`

## Project Structure

```
growthlab-viewer/
├── index.html              # Course home with session list
├── session.html            # Viewer template (works for all sessions)
├── css/styles.css          # Complete styling (16:9 cards, responsive, 3D effects)
├── js/viewer.js            # Core logic: parsing, navigation, rendering
├── sessions/
│   ├── session-01.md       # Example with all content patterns
│   ├── session-02.md       # Add your sessions here
│   └── ...
├── media/
│   ├── _input/             # Raw source images (before conversion)
│   └── session-XX/         # Optimized images (WebP)
└── scripts/
    └── image_convert.sh    # Batch convert PNG/JPG → WebP
```

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

## Images

### Adding Images

1. Place raw images in `media/_input/session-XX/`
   ```
   media/_input/
   └── session-02/
       ├── figjam-spectrum.png
       ├── prototype.jpg
       └── demo.gif
   ```

2. Convert to WebP:
   ```bash
   bash scripts/image_convert.sh session-02
   # Outputs: media/session-02/*.webp
   ```

3. Reference in Markdown:
   ```markdown
   ![Precision spectrum board](../media/session-02/figjam-spectrum.webp)
   ```

### Image Conversion Script

The bash script auto-detects ImageMagick or FFmpeg:

```bash
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick
# Or: brew install ffmpeg

bash scripts/image_convert.sh session-01
```

Converts PNG/JPG/GIF to WebP, resizes to 1600px max, quality 75.

## Creating New Sessions

### Using the System Prompt

To convert your session outlines to Markdown, use this prompt with Claude or your preferred LLM:

```
You are helping turn my AI bootcamp session outlines into structured Markdown "card decks"
for a simple web-based slide viewer.

COURSE CONTEXT
- Course name: GrowthLab AI Bootcamp
- Client: GrowthAssistant
- Audience: designers and video editors
- Delivery: live, synchronous sessions over Zoom with screen-sharing
- Primary goal: support instructor with clear talking beats and activity prompts

OUTPUT FORMAT
- Produce a single Markdown document per session
- At the top, include YAML front matter:

  ---
  id: session-XX          # I will tell you this
  title: "..."            # from the outline
  week: N                 # I will tell you this
  day: N                  # I will tell you this
  duration_minutes: 90    # or as specified
  learning_objectives:
    - ...
  audience: "Designers & video editors at GrowthAssistant"
  prework:
    - ...                 # summarize any pre-work or use [] if none
  ---

- After front matter, use:
  - '#' for the session title
  - '##' for major time blocks / sections (e.g., '## 0–15 min · Pre-Work: Show & Tell')
  - '---' (horizontal rule) to indicate card boundaries within a section
  - Regular Markdown (headings, bold, italics, bullets, blockquotes) for content

CARD DESIGN RULES
- Think of each card as one "beat" while talking
- Aim for 2–4 cards per time block
- A card can contain: heading, bullets, quote, prompt, or activity description
- Avoid walls of text; break into multiple cards when in doubt

CONTENT PATTERNS TO USE
- Prompts: > Prompt: "Question here?"
- Activities: ### Activity: Name
- Tools: **Tool:** Name
- Assignments: ### Assignment #N: Title
- Facilitator notes: **Facilitator notes:**

PRESERVE / OMIT
- Preserve: sequence of time blocks, prompts, instructions, learning objectives
- Omit: new activities not in outline, changes to learning goals
- May tighten language and combine trivial steps

FINAL REQUIREMENT
- Return only the Markdown file – no extra commentary
```

**Usage:**
1. Paste the prompt above into Claude
2. Say: `id: session-02, week: 1, day: 2, duration_minutes: 90`
3. Paste your raw outline
4. Copy the Markdown output into `sessions/session-02.md`
5. Do a human pass to adjust card breaks and wording if needed

### Workflow

1. Write outline (Word, Google Docs, or plain text)
2. Use system prompt to generate Markdown
3. Place in `sessions/session-XX.md`
4. Add images to `media/_input/session-XX/`
5. Run image converter
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

## Architecture

**viewer.js** (~280 lines):
1. Parse URL hash → `sessionId` and `cardIndex`
2. Fetch Markdown file via `fetch()`
3. Extract YAML front matter (simple regex parser)
4. Convert Markdown → HTML with `marked.js` (loaded from CDN)
5. Split HTML by `<hr>` tags into cards
6. Render with CSS 3D stack effect
7. Handle keyboard, mouse, and hash navigation
8. Sync URL hash on navigation

**No build step, no framework, no dependencies for viewing.**

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

## Tips

- Keep each card to ~5-10 bullet points max
- Use images to break up text-heavy sections
- Preview in browser after each outline conversion
- Test keyboard shortcuts and click navigation
- Use facilitator notes to remind yourself of timing/talking points
- Theme is macOS-inspired (system fonts, clean spacing)—adjust `css/styles.css` for your brand
