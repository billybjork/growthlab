## 👋 Welcome Back!

<!-- block -->

<img src="media/shared/20251208_113911.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">

<!-- block -->

<div class="callout">### Today we'll cover:
- **Assignment #6 Recap** – sharing your capstone pre-viz outputs
- **AI Evals** – understanding public, proprietary, and DIY evaluations
- **Individual Activity** – creating your own eval and testing models
- **Model Bake-Off** – systematic comparison with scorecards
- **Assignment #7** – capstone video pre-viz</div>

<!-- block -->

<img src="media/shared/20251208_113928.webp" alt="" style="display: block; max-width: 851.9921875px; width: 851.9921875px; margin-left: auto; margin-right: auto">
---
## 🎬 Recap: Assignment #6

<!-- block -->

### **📢 Opening Activity:** Share your favorite capstone pre-viz output

<!-- block -->

Everyone share your favorite output from Assignment #6 through Slack before we begin.

<!-- block -->

<!-- row -->
<div class="callout">### 💭 **Discussion questions:**

- What's the **concept/idea** you were trying to achieve?
- Did you **generate this from scratch** or modify one of the base images?
- Can you **show us the Flora project** you used to create this?</div>
<!-- col -->
<img src="media/shared/20251209_121548.webp" alt="" style="display: block; max-width: 505px; width: 505px; margin-left: auto; margin-right: auto">
<!-- /row -->
---
## 🎯 Today's Session: Evaluating Models

<!-- block -->

Choosing AI models can be confusing...

<!-- block -->

<img src="media/shared/20251208_114228.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">

<!-- block -->

Today we're diving into **"evals"** (short for "evaluations"), to give you a stronger basis for choosing the right model for each task.

We'll explore:
- Why evals are important
- The various forms they come in
- How to create your own evals
- Using evals to assess model outputs

<!-- block -->

***

<!-- block -->

<div class="callout">### 🧠 **A Note on Experimentation:**

As we move into hands-on activities, remember: **rapid prototyping means some outputs won't work — and that's exactly the point.**

Just like giving feedback to AI helps it improve, giving feedback to yourself (and each other) is part of the learning process. Every "failed" prompt teaches you something about how models interpret instructions.

This is always a **test & learn** set of iterations. The more you practice, the better you'll predict which prompts lead to successful outputs. There's no such thing as a "bad" attempt — only data points that sharpen your intuition.</div>
---
## 📊 Types of AI Evals

<!-- block -->

<div style="text-align: center">### **"Evals" (also known as "benchmarks") play a central role in the AI industry.**</div>

<!-- block -->

<img src="media/shared/20251208_115431.webp" alt="" style="display: block; max-width: 725.9921875px; width: 725.9921875px;;; margin-left: auto; margin-right: auto">

<!-- block -->

***

<!-- block -->

<!-- row -->
### 🌐 Public Evals

Public, reproduceable, community-accepted benchmarks designed to measure specific competencies (e.g., coding, reasoning, factual knowledge, safety)

**Best for:** Comparing new models against each other in a standardized manner

**Examples:**
- Humanity's Last Exam
- SWEBench
- ARC‑AGI‑2
<!-- col -->
### 🏢 Proprietary Evals

Custom evaluations built by organizations to measure the performance of an internal model (often fine-tuned) on a specific business task

**Best for:** Productizing a model within a specific business domain

**Examples:**
- Internal safety red-teaming exams
- Domain-specific business tasks
- Partner scenarios
<!-- /row -->

<!-- block -->

<img src="media/shared/20251208_115758.webp" alt="" style="display: block; max-width: 613px; width: 613px;; margin-left: auto; margin-right: auto">

<!-- block -->

***

<!-- block -->

<div class="callout">### 💡 There's a third type of eval, potentially the most exciting…</div>
---
## 🧪 DIY Evals

<!-- block -->

<div class="callout">Lightweight, informal tests done by developers or researchers to gauge a model's abilities, creativity, or quirks – often playful or exploratory

**Best for:** Quickly building an intuition on capabilities of a new model, especially for your most common use cases</div>

<!-- block -->

***

<!-- block -->

### 🔍 Notable Examples

<!-- block -->

<!-- row -->
#### **Will Smith eating spaghetti** – the original AI [video](https://www.youtube.com/watch?v=XQr4Xklqzw8) that broke the internet
<!-- col -->
<img src="media/shared/20251208_121859.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- /row -->

<!-- block -->

<!-- row -->
<img src="media/shared/20251208_121945.webp" alt="" style="display: block; max-width: 355.5px; width: 355.5px;;;;; margin-left: auto; margin-right: auto">
<!-- col -->
#### **Simon Willison** – SVG of a pelican riding a bicycle ([reference](https://simonwillison.net/2025/Nov/18/gemini-3/))
<!-- /row -->

<!-- block -->

<!-- row -->
#### **Ethan Mollick** – otter on an airplane using wifi ([reference](https://www.oneusefulthing.org/p/the-recent-history-of-ai-in-32-otters))
<!-- col -->
<img src="media/shared/20251208_122143.webp" alt="" style="display: block; max-width: 433.9921875px; width: 433.9921875px">
<!-- /row -->

<!-- block -->

<!-- row -->
<img src="media/shared/20251208_122606.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- col -->
#### **Counting to ten** using two hands ([video](https://x.com/fofrai/status/1973345533147349238?s=46&t=Ns__t-KY04DwitS6ZYa6FA))
<!-- /row -->

<!-- block -->

<!-- row -->
**Zero-shot visual reasoning tasks** ([paper](https://video-zero-shot.github.io/))
<!-- col -->
<img src="media/shared/20251208_122716.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- /row -->
---
## 🎯 Activity: Roll Your Own Eval

<!-- block -->

### **Time to try this yourself!**

In this activity, you'll create your own "DIY Eval" and test it with various models in Flora.

<!-- block -->

<!-- row -->
<div class="callout">### 💡 **Why This Works in Flora:**

One of the great things about 'model aggregators' like Flora is how they allow you to choose from a wide selection of models. The node-based workflow makes it easy to compare/contrast outputs from different models.</div>
<!-- col -->
<img src="media/shared/20251208_123608.webp" alt="" style="display: block; max-width: 471.9921875px; width: 471.9921875px">
<!-- /row -->

<!-- block -->

***

<!-- block -->

### 📝 Example Evals

<!-- block -->

- *"Show a climber doing a heel hook on a 45° overhang"*
- *"Create an image of ___ in this specific knitting pattern"*
- *"Explain an optimal build for my D&D character"*

<!-- block -->

<details>
<summary>🏂 Billy's Personal Example: Snowboarding Tricks</summary>

- **Easy (non-generative):** "Identify the snowboarding trick being performed in this image"
- **Difficult (generative):** "Generate a short clip of a proper backside 720, with a tail grab"
   - 🔗‍️ [Example Flora project](https://app.florafauna.ai/join-project/1ea82e9c-a667-46b2-aad3-2c6d450c4daf)

The key is choosing something **you understand deeply** so you can immediately spot when the model gets it wrong!

</details>

<!-- block -->

***

<!-- block -->

### 🪜 Your Task

<!-- block -->

**1. Think of something you understand deeply** & can critique effectively, which may push the limits of current AI model capabilities.

<!-- block -->

**2. Form this into an image or video generation task** – should be "verifiable" (easy to tell whether the model succeeded or failed)

<!-- block -->

**3. Create a new project in Flora** involving:
- A single text node (your verifiable eval task)
- Three image or video nodes (each using a different model)

<!-- block -->

**4. Run the generations,** then compare the results from each image/video node.

<!-- block -->

**5. Determine** which model performed the best/worst on your eval.
---
## 💭 Discussion: Your Eval Results

<!-- block -->

<!-- row -->
<div class="callout">### 💭 **Billy will call on a few people to share their eval + outputs:**

- What's the **eval you came up with**?
- Which model performed **best/worst** at this eval?
- Did all models perform well? In other words, is your eval **"saturated"**?</div>
<!-- col -->
<img src="media/shared/20251208_124138.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- /row -->
---
## ⭐ Getting Serious About Evals

<!-- block -->

When evaluating models, most people don't go any further than simple **"vibe checks."**

<!-- block -->

<!-- row -->
### 👍 Yes, "vibes" are important!

**Example:** The [backlash](https://www.platformer.news/gpt-5-backlash-openai-lessons/) from the GPT 5 release revealed how much everyone valued the "vibes" of GPT 4o
<!-- col -->
### ⚠️ But vibes have limits

"Vibes" are a limited and ambiguous criteria for making informed decisions about which models to use.
<!-- /row -->

<!-- block -->

***

<!-- block -->

<div class="callout">### 💡 **The Solution:**

To build a robust and multi-faceted intuition around model capabilities, it's important to define **specific criteria** to assess.</div>

<!-- block -->

<img src="media/shared/20251208_124749.webp" alt="" style="display: block; max-width: 861px; width: 861px; margin-left: auto; margin-right: auto">

<!-- block -->

***

<!-- block -->

### 💭 Group Discussion

<!-- block -->

**What are important factors to consider when choosing/evaluating models?**

- Specifically for **text**?
- Specifically for **images & videos**?

<!-- block -->

<details>
<summary>📝 Possible Answers – Text Models</summary>

- **Instruction following & prompt understanding**
- **Factuality & calibrated uncertainty** (hallucination rate, citations)
- **Style & tone control** (voice matching, "vibes")
- **Context handling** (use of long inputs, retrieval accuracy)
- **Reasoning & tool use** (multi-step tasks, web search, etc.)
- **Speed & reliability** (latency, throughput, uptime)
- **Cost efficiency** (quality per $, quotas)
- **Product fit & UX** (desktop/mobile, sharing, attachments, API/SDK)
- **Safety & boundary handling** (appropriate refusals vs. over-permissiveness)

</details>

<!-- block -->

<details>
<summary>🖼️ Possible Answers – Image & Video Models</summary>

- **Prompt adherence & control** (edits, masks, poses, keyframes)
- **Spatial/temporal realism** (lighting, physics, motion coherence)
- **Aesthetics & composition** (taste, framing, color)
- **Subject/style consistency** (across frames/shots)
- **Output quality & artifacts** (resolution, fps/duration, flicker/banding)

</details>
---
## 🏆 Model Bake-Off: Setup

<!-- block -->

<img src="media/shared/20251208_114140.webp" alt="" style="display: block; max-width: 497px; width: 497px;;;;;;;;;;;;;;;;; margin-left: auto; margin-right: auto">

<!-- block -->

***

<!-- block -->

<div style="text-align: center">### **Let's run our own evals again, this time with a couple key differences:**</div>

<!-- block -->

<!-- row -->
#### 📊 Structured Grading
Actually **'grade' the outputs** on specific evaluation criteria (based on group consensus).
<!-- col -->
#### 💼 Real Business Task
Use an **actual business task** (relevant to BetterHelp) as the eval.
<!-- /row -->

<!-- block -->

<details>
<summary>🔍 What You'll Evaluate</summary>

![](media/shared/20251209_114620.webp)
***
We will use this [scorecard](https://docs.google.com/spreadsheets/d/1X0HO5AYAWEsPhAMUrSR_3wY5PgtFWIrwWUiCGbMN738/), covering...

### ⚔️ **Six models total:**
- Three image models:
   - Nano Banana Pro
   - Seedream 4.5
   - Reve
- Three video models:
   - Kling 2.5 Turbo Pro
   - Runway Gen-4 Turbo
   - Seedance 1.0 Pro
***
### 📋 **Three evaluation criteria:**
1. **Prompt adherence & control** (edits, masks, poses, keyframes)
2. **Spatial/temporal realism** (lighting, physics, motion coherence)
3. **Aesthetics & composition** (taste, framing, color)
***
![](media/shared/20251208_130849.webp)

</details>

<!-- block -->

***

<!-- block -->

### 🪜 Steps:
1. As a group, designate a "driver" to manage the Flora project, scorecard, and screenshare.
2. Create a copy of the [scorecard](https://docs.google.com/spreadsheets/d/1X0HO5AYAWEsPhAMUrSR_3wY5PgtFWIrwWUiCGbMN738/copy).
3. Open [the bake-off template](https://app.florafauna.ai/join-project/d77afe58-d8c8-4675-9ad6-8cf7acadd304) and clone the project.
4. As a group, brainstorm a "base prompt" for BetterHelp to add into the footer of the initial text node, then generate a full prompt.
   - Consider the type of images/videos that will be useful for BetterHelp capstone concepts.
5. Inspect the generated prompt in the initial text node - edit and refine as you see fit.
6. Once the initial prompt is complete, run the initial image generations for the three image models.
7. Evaluate the image generations in your scorecard.
   - Optionally, refine your initial text prompt and re-generate the initial images.
8. Run the video generations based on the initial images (no additional prompt).
9. Evaluate the video generations in your scorecard.

<!-- block -->

<div class="callout">### 🏁 **Let the bake-off begin!**</div>

<!-- block -->

<img src="media/shared/20251208_132123.webp" alt="" style="display: block; max-width: 604.984375px; width: 604.984375px;;;;;;; margin-left: auto; margin-right: auto">
---
## 👥 Bake-Off: Share Results

<!-- block -->

<!-- row -->
<div class="callout">### 💭 **Representative from each group (the designated "driver") shares:**

- **Your Flora project** – including your provided text prompt + starting image
- **Your scorecard** + rationale for top/bottom performing image and video models</div>
<!-- col -->
<img src="media/shared/20251208_132308.webp" alt="" style="display: block; max-width: 525px; width: 525px; margin-left: auto; margin-right: auto">
<!-- /row -->
---
## 📋 Assignment #7: Capstone Video Pre-Viz

<!-- block -->

<div class="callout">### 🎯 **Goal:**

Generate **'pre-viz' video** to use or later refine for your capstone project
- Similar to [Assignment #6](session.html?cohort=cohort-01&file=session-06&card=assignment-6-capstone-image-pre-viz), but for **videos** instead of images.</div>

<!-- block -->

***

<!-- block -->

### 💡 What You'll Experiment With

<!-- block -->

<!-- row -->
#### 🔍 Evaluating multiple video models
Compare different models using the criteria we practiced today
<!-- col -->
#### 🎞️ Two methods of generating videos
- From a **single image frame**
- From **two image frames** ('start' and 'end' frames)
<!-- /row -->

<!-- block -->

***

<!-- block -->

### 🪜 Steps

<!-- block -->

**1. Start with your best images** from Assignment #6 — pick 2 favorites to animate

**2. Experiment with video generation methods:**
- Generate videos from a **single image** (just the starting frame)
- Generate videos from **two images** (start + end frames you create)

**3. Compare multiple video models** using the evaluation criteria from today's bake-off

<!-- block -->

<details>
<summary>💡 Suggested Flora workflow</summary>

For each of your 2 starting images:
1. **Create an 'end frame'** – use a text prompt to generate where you want the video to end up
2. **Generate 2 videos:**
   - One from just the starting image (single-frame method)
   - One from start + end images (two-frame method)
3. **Try different video models** – compare results

This gives you ~4 videos total to evaluate and submit.

</details>

<!-- block -->

<div class="callout">#### ⚠️ **Leave out text overlays:**
- For these outputs, deliberately **skip text overlays** — they're better added in post-production using traditional design tools (which we'll cover in Session 8).
- If you're using a text node to help generate your prompt, **review the prompt before generating** as the LLM may include text overlay instructions. Remove any such references before running the image/video generation.</div>

<!-- block -->

***

<!-- block -->

### 📥 Submit Assignment #7

<!-- block -->

<div data-form="assignment-7">
  <label for="email">Email:</label>
  <input type="email" id="email" name="email" required placeholder="Use your @growthassistant.com email" />

***
  <label for="flora_project_url">Flora Project URL:</label>
  <input type="url" id="flora_project_url" name="flora_project_url" required placeholder="Share link to your Flora canvas" />

***
  <label for="top_video_model">Which video model performed best for you and why?</label>
  <textarea id="top_video_model" name="top_video_model" rows="3" required placeholder="Which model won and what made it stand out?"></textarea>

  <label for="single_vs_double_frame">Single-frame vs. two-frame: Which approach worked better?</label>
  <textarea id="single_vs_double_frame" name="single_vs_double_frame" rows="3" required placeholder="Compare the two methods"></textarea>

***
  <label for="reflections">Any other reflections or challenges? (optional)</label>
  <textarea id="reflections" name="reflections" rows="3" placeholder="What worked well? What was difficult?"></textarea>

***
  <button type="submit">Submit Assignment</button>
</div>
---
## ⭐ Session #7 Recap

<!-- block -->

<img src="media/shared/20251208_105722.webp" alt="" style="display: block; max-width: 808.9921875px; width: 808.9921875px; margin-left: auto; margin-right: auto">

<!-- block -->

### **Key Takeaways:**

- **⭐ Evals are essential** – Public benchmarks, proprietary tests, and DIY experiments each serve different purposes in understanding model capabilities

- **🧪 DIY evals build intuition fast** – Create simple, verifiable tasks based on your domain expertise to quickly assess what models can and can't do

- **📊 Move beyond vibes** – Define specific evaluation criteria (prompt adherence, realism, aesthetics, etc.) to make informed model choices

- **🏆 Systematic comparison reveals nuances** – Running structured bake-offs with scorecards helps identify which models excel at which tasks

- **🎬 Apply to your capstone** – Use evaluation insights to guide your video pre-viz generation and refine your creative process

<!-- block -->

***

<!-- block -->

<div class="callout">### 🔜 **Coming Up Next:**

In our next session, we'll review your video pre-viz outputs and continue building toward the final capstone deliverables.

See you there!</div>
