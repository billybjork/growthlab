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
- Use standard Markdown:
  - Start directly with '##' headings for major sections (e.g., '## Welcome to GrowthLab! 🎉', '## 🎯 Introduction Game')
  - Include emojis in H2 headings for visual interest and quick scanning
  - Do NOT include an H1 ('#') session title at the top
  - '---' (horizontal rule) to indicate card boundaries between sections/topics
  - '***' (three asterisks) for visual separators WITHIN a card (for breathing room between related elements - use liberally)
  - Regular Markdown (headings, bold, italics, bullets, blockquotes) for content
  - `<u>` tags for underline emphasis on key terms

TECHNICAL NOTE
The viewer uses a block-based editor (see `public/js/edit-blocks.js`) that supports:
- Text blocks (markdown content)
- Image blocks (added via editor)
- Video blocks (added via editor)
- Details/collapsible sections
- Callout boxes
- Row/column layouts

During generation, use:
- Simple markdown for text content
- Descriptive placeholders for images/videos
- HTML for callouts, details, and rows (as shown in examples below)
- `<!-- block -->` separators for distinct content elements

The editor will handle all sizing, styling, and media URLs.

EXTENDED SYNTAX
The viewer supports these additional content types beyond standard Markdown:

1. **Videos** – Use descriptive placeholders in brackets:
   ```markdown
   [Video: Keep thinking with Claude]
   [Video: AI-generated cat playing piano]
   ```
   - Actual video URLs and embeds will be added later via the editor
   - Use brackets with "Video:" prefix and description

2. **Callout boxes** – Must be in their own block:
   ```markdown
   <!-- block -->

   <div class="callout">
   Content here appears in a visually distinct box.
   Supports **markdown** inside.
   </div>

   <!-- block -->
   ```
   Use for key instructions, important notes, or content that should stand out.

3. **Collapsible sections** – Must be in their own block:
   ```markdown
   <!-- block -->

   <details>
   <summary>Click to expand</summary>

   Hidden content goes here. Supports full markdown inside.

   </details>

   <!-- block -->
   ```
   Use for supplementary info (like pre-work on activity cards), facilitator notes, or content the instructor may optionally reveal.

4. **Block separators** – Use HTML comments to create distinct content blocks:
   ```markdown
   #### Person Name

   <!-- block -->

   <img src="media/session-01/image.webp" alt="" style="display: block; max-width: 250px">

   <!-- block -->

   #### Another Person
   ```

   **Important:** Always include blank lines before AND after `<!-- block -->`.

   Use block separators when you need:
   - Images and headings to stack vertically (not flow inline)
   - Distinct visual separation between elements within a single card
   - Content that will be edited independently in the block editor

5. **Row/column layouts** – Must be in their own block:
   ```markdown
   <!-- block -->

   <!-- row -->
   Content in left column
   <!-- col -->
   Content in right column
   <!-- /row -->

   <!-- block -->
   ```
   Use for comparing perspectives, showing before/after, or any side-by-side layout.

6. **Images** – Use descriptive placeholders in brackets:
   ```markdown
   [BarkBox logo image]
   [Screenshot showing frontier AI examples]
   [Photo of team member]
   ```
   - Images will be added later via the edit mode
   - Use brackets with descriptive text indicating what the image should show
   - Don't include file paths, sizing, or styling - the editor handles all of that

**CRITICAL:** All HTML elements (`<details>`, `<div class="callout">`, `<div data-form>`, row/column layouts) MUST be in their own blocks with `<!-- block -->` separators before and after, with blank lines surrounding the separators.

7. **Form elements** – ALWAYS include forms for assignments:
   When an assignment is mentioned, create a structured form with:
   - Email field
   - Fields for each deliverable (use textarea for explanations, input for URLs/short answers)
   - Submit button
   - Wrap in `<div data-form="assignment-name">`

   Example: For "find 3 creative references and explain what's strong about each":
   ```markdown
   <!-- block -->

   <div data-form="assignment-1">
     <label for="email">Email:</label>
     <input type="email" id="email" name="email" required />

     <label for="ref1_url">Reference #1 (URL):</label>
     <input type="text" id="ref1_url" name="ref1_url" required />

     <label for="ref1_strong">What's strong/effective about Reference #1?</label>
     <textarea id="ref1_strong" name="ref1_strong" rows="3" required></textarea>

     <label for="ref1_improve">What could be improved/modified?</label>
     <textarea id="ref1_improve" name="ref1_improve" rows="3" required></textarea>

     <!-- Repeat for ref2 and ref3 -->

     <button type="submit">Submit Assignment</button>
   </div>

   <!-- block -->
   ```

BLOCK STRUCTURE
**Critical:** Within each card, use `<!-- block -->` to separate distinct content elements:
- Place `<!-- block -->` on its own line with blank lines before AND after
- Each block should contain ONE distinct element (heading + text, image, callout, etc.)
- Blocks allow independent editing of each content piece

Example structure:
```markdown
## Card Title

<!-- block -->

First content block (text, heading, etc.)

<!-- block -->

[Image description]

<!-- block -->

Next content block
```

**When to create separate blocks:**
- Each image or video should be its own block
- Headings that introduce new concepts should start a new block
- Callouts, details, and other special elements need their own blocks
- Text that will be edited independently should be separate blocks

CARD DESIGN RULES
- Think of each card as one "beat" while talking
- **When to split into multiple cards:**
  - New major section or topic (often indicated by time blocks in outline)
  - Shift in activity type (from discussion to presentation to assignment)
  - Natural pause or transition point where instructor would advance slides
  - Distinct conceptual shift that deserves its own visual focus
  - Example: "Why GrowthLab Exists" and "What Differentiates You" are related but deserve separate cards
- **When to keep content together:**
  - Related talking points that flow as one continuous narrative
  - Multi-part instructions for a single activity
  - Examples that all illustrate the same concept
  - Content that would feel choppy if split apart
- Use standard Markdown (headings, lists, bold, italics, blockquotes, code blocks, tables)
- Avoid walls of text; use formatting to break up dense content

**Special patterns:**
- **Pre-work:** Can be embedded within the first activity card using `<details>` rather than always being a separate section
- **Multi-category activities:** When breakout rooms or discussions have multiple distinct categories, create individual cards for EACH category with its own references and examples
- **Biographical content:** When introducing speakers/instructors, include extended details with specific examples, projects, and timeline elements where provided

VISUAL DESIGN & FORMATTING
Make content engaging and scannable through:

1. **Emojis for visual anchors** – Use tastefully to help instructor quickly identify content types
2. **Creative formatting** – Use blockquotes, tables, callout boxes, or unique layouts when they enhance clarity
3. **Placeholder elements** – Use descriptive text in brackets for images and videos:
   - Images: `[Image description]`
   - Videos: `[Video: Title or description]`
   - The editor will handle adding actual media, sizing, and styling later

**Established visual language for common patterns:**
- 🎯 **Activities & exercises** – hands-on tasks for participants
- 💭 **Discussion prompts** – open questions for group engagement
- 👥 **Breakout rooms** – small group work
- 📋 **Assignments** – homework or deliverables
- ⭐ **Key concepts** – important principles or takeaways
- 💡 **Pro tips** – helpful insights or best practices
- ⚠️ **Important notes** – critical information to emphasize

Use these consistently so instructors can quickly scan and recognize content types.

RECAP CARD
- Every session MUST end with a single recap/summary card
- This card should briefly summarize the key takeaways from the session
- Use '## Recap' as the section heading
- Keep it concise (3–5 bullet points covering main concepts or skills learned)
- Use emoji visual anchors for each takeaway (⭐, 🎯, 💡, etc.)

LEVEL OF DETAIL
- **Preserve ALL specifics:** When the outline includes specific examples, links, projects, names, or references, include them verbatim
- **Use actual data:** Real competitor names, actual project titles, specific dates, exact URLs from the outline
- **Don't generalize:** Avoid replacing specific details with generic placeholders
  - ❌ Bad: "competitors/alternatives to BarkBox (include examples)"
  - ✅ Good: "competitors/alternatives to BarkBox (such as WoofPacks, SundayForDogs, & MeowBox)"
  - ❌ Bad: "Possible sources: Pinterest, Atria, Instagram, Meta Ads Manager, Are.na, etc."
  - ✅ Good: List the ACTUAL sources from the outline
- **Expand biographical content:** When introducing people with project histories, include all specific examples with dates and links
  - Example: "[August, 2022] **First AI-assisted video project** - Subaru Crosstrek XV - Using ~700 images from Craiyon"
- **Real references:** Use the actual reference URLs from the outline, not example.com placeholders
- **Use proper markdown links:** Format links as `[Link text](URL)` for clickable references

PRESERVE / OMIT
- Preserve: Key prompts, instructions, learning objectives, activities, specific examples, references, links
- Omit: Specific time blocks (those are for internal planning only)
- May tighten language slightly but don't condense rich content into summaries
- Keep voice active, engaging, and casual

FINAL REQUIREMENT
- Return only the Markdown file – no extra commentary
- Use simple markdown syntax with descriptive placeholders for images/videos
- Actual media URLs, sizing, and styling will be added during editing
- Focus on content structure, block separation, and preserving specific details from the outline
