## 👋 Welcome to Live Session 3!

<!-- block -->

<img src="media/shared/20251205_155657.webp" alt="" style="display: block; max-width: 808px; width: 808px;; margin-left: auto; margin-right: auto">

<!-- block -->

<div class="callout">### Today we'll cover:
- **Concept Warm-Up** – applying your concepts to a shared starting image
- **Model Evaluation Overview** – understanding how to choose the right models
- **DIY Evals Activity** – creating your own eval and testing models
- **Model Bake-Off** – systematically comparing models in groups</div>
---
## 🎨 Concept Warm-Up

<!-- block -->

<!-- row -->
<div class="callout">### **The Challenge:**

Everyone will create a video using the same [Hungryroot starting image](https://drive.google.com/file/d/1HZufQaT1JfdjkoUhOofv6fJyVY_LW39P/view?usp=sharing).

How many different directions can we take this?</div>
<!-- col -->
<img src="media/shared/20260202_150046.webp" alt="" style="display: block; max-width: 462.75px; width: 462.75px;;;;;; margin-left: auto; margin-right: auto">
<!-- /row -->

<!-- block -->

***

<!-- block -->

### **Steps** (~7 min):

<!-- block -->

1. [Download](https://drive.google.com/file/d/1HZufQaT1JfdjkoUhOofv6fJyVY_LW39P/view?usp=sharing) the starting image and brainstorm different ways you could make it 'move.'
- Consider ideas and insights from past assignments, like your Hungryroot 'system prompt' and concept ideas.
2. Drag the starting image into Flora.
3. Branch the starting image into a video node, then prompt a specific video based on the image.
   - Optionally, generate an additional frame, which could be fed into the video model (i.e. generate video from two frames instead of one).
4. Generate!
5. When Billy calls time, everyone shares their output via Slack simultaneously.

<!-- block -->

***

<!-- block -->

<div class="callout">### **Tip:**

Don't overthink it — this is a quick warm-up to see your concept come to life. You'll have plenty of time to refine in Module E.</div>
---
## 📢 Concept Warm-Up: Reveal

<!-- block -->

<!-- row -->
### **Everyone shares their output via Slack at the same time!**

After the reveal, we'll discuss:
- What **different approaches** did people take?
- Which outputs feel most **"on-brand"** for Hungryroot?
- What made some **work better** than others?
<!-- col -->
<img src="media/shared/20260202_150105.webp" alt="" style="display: block; max-width: 455px; width: 455px;; margin-left: auto; margin-right: auto">
<!-- /row -->

<!-- block -->

***

<!-- block -->

<div class="callout">That last question — "what made some work better?" — is exactly what we'll tackle next.

Let's build a **systematic framework** for evaluating AI outputs...</div>
---
## 📊 Types of AI Evals

<!-- block -->

<div style="text-align: center">### **"Evals" (also known as "benchmarks") play a central role in the AI industry.**</div>

<!-- block -->

<img src="media/shared/20251208_115431.webp" alt="" style="display: block; max-width: 725.9921875px; width: 725.9921875px;;;;;;;;;;;;;;;; margin-left: auto; margin-right: auto">

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

<img src="media/shared/20251208_115758.webp" alt="" style="display: block; max-width: 613px; width: 613px;;;;;;;;;;;;;;; margin-left: auto; margin-right: auto">

<!-- block -->

<div class="callout">### 💡 There's a third type of eval, potentially the most exciting…</div>

<!-- block -->

***

<!-- block -->

### 🧪 DIY Evals
- Lightweight, informal tests done by developers or researchers to gauge a model's abilities, creativity, or quirks – often playful or exploratory
- **Best for:** Quickly building an intuition on capabilities of a new model, especially for your most common use cases

<!-- block -->

<details>
<summary>Notable DIY Eval Examples</summary>

*These famous "DIY evals" have been used to test AI model capabilities:*

***

<!-- row -->
#### **Will Smith eating spaghetti** – the original AI [video](https://www.youtube.com/watch?v=XQr4Xklqzw8) that broke the internet
<!-- col -->
<img src="media/shared/20251208_121859.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- /row -->

***

<!-- row -->
<img src="media/shared/20251208_121945.webp" alt="" style="display: block; max-width: 355.5px; width: 355.5px; margin-left: auto; margin-right: auto">
<!-- col -->
#### **Simon Willison** – SVG of a pelican riding a bicycle ([reference](https://simonwillison.net/2025/Nov/18/gemini-3/))
<!-- /row -->

***

<!-- row -->
#### **Ethan Mollick** – otter on an airplane using wifi ([reference](https://www.oneusefulthing.org/p/the-recent-history-of-ai-in-32-otters))
<!-- col -->
<img src="media/shared/20251208_122143.webp" alt="" style="display: block; max-width: 433.9921875px; width: 433.9921875px">
<!-- /row -->
<!-- row -->
**Bonus:** [Follow-up from Ethan Mollick](https://www.oneusefulthing.org/p/the-shape-of-ai-jaggedness-bottlenecks)
<!-- col -->
![](media/shared/20260202_131445.webp)
<!-- /row -->

***

<!-- row -->
<img src="media/shared/20251208_122606.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- col -->
#### **Counting to ten** using two hands ([video](https://x.com/fofrai/status/1973345533147349238?s=46&t=Ns__t-KY04DwitS6ZYa6FA))
<!-- /row -->

***

<!-- row -->
**Zero-shot visual reasoning tasks** ([paper](https://video-zero-shot.github.io/))
<!-- col -->
<img src="media/shared/20251208_122716.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- /row -->

</details>
---
## ⭐ Key Evaluation Criteria

<!-- block -->

<img src="media/shared/20251208_124749.webp" alt="" style="display: block; max-width: 522px; width: 522px; margin-left: auto; margin-right: auto">

<!-- block -->

### **What factors matter when choosing models?**

<!-- block -->

<details>
<summary>Text Models</summary>

- 📋 **Instruction following & prompt understanding**
- ✅ **Factuality & calibrated uncertainty** (hallucination rate, citations)
- 🎭 **Style & tone control** (voice matching, "vibes")
- 📚 **Context handling** (use of long inputs, retrieval accuracy)
- 🧠 **Reasoning & tool use** (multi-step tasks, web search, etc.)
- ⚡ **Speed & reliability** (latency, throughput, uptime)
- 💰 **Cost efficiency** (quality per $, quotas)

</details>

<!-- block -->

<details>
<summary>Image & Video Models</summary>

- 🎯 **Prompt adherence & control** (edits, masks, poses, keyframes)
- 🌍 **Spatial/temporal realism** (lighting, physics, motion coherence)
- 🖼️ **Aesthetics & composition** (taste, framing, color)
- 🔄 **Subject/style consistency** (across frames/shots)
- ✨ **Output quality & artifacts** (resolution, fps/duration, flicker/banding)

</details>

<!-- block -->

<div class="callout">### 💡 **Key Insight:**

When evaluating models, most people don't go any further than simple **"vibe checks."**

Yes, vibes are important! But to make informed decisions, define **specific criteria** to assess.</div>
---
## 🧪 Activity: Roll Your Own Eval

<!-- block -->

### **Time to try this yourself!**

In this activity, you'll create your own "DIY Eval" and test it with various models in Flora.

<!-- block -->

### 📝 Example Evals
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

<!-- row -->
<div class="callout">### 💡 **Why This Works in Flora:**

One of the great things about 'model aggregators' like Flora is how they allow you to choose from a wide selection of models. The node-based workflow makes it easy to compare/contrast outputs from different models.</div>
<!-- col -->
<img src="media/shared/20251208_123608.webp" alt="" style="display: block; max-width: 471.9921875px; width: 471.9921875px">
<!-- /row -->

<!-- block -->

***

<!-- block -->

### 🪜 Your Task (~10 min)

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
<div class="callout">### **Billy will call on a few people to share their eval + outputs:**

- What's the **eval you came up with**?
- Which model performed **best/worst** at this eval?
- Did all models perform well? In other words, is your eval **"saturated"**?</div>
<!-- col -->
<img src="media/shared/20251208_124138.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
<!-- /row -->
---
## 🏆 Model Bake-Off: Setup

<!-- block -->

### **Now let's put these evaluation skills into practice with a structured bake-off!**

<!-- block -->

<img src="media/shared/20251208_132123.webp" alt="" style="display: block; max-width: 605px; width: 605px;; margin-left: auto; margin-right: auto">

<!-- block -->

***

<!-- block -->

<div class="callout">### **What's a Bake-Off?**

A structured comparison where you run the **same prompt** through **multiple models** and score them against **specific criteria**.

This moves you from "vibes-based" model selection to **informed, evidence-based decisions**.</div>

<!-- block -->

***

<!-- block -->

### **What You'll Evaluate:**

<!-- block -->

<img src="media/shared/20251209_114620.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">

<!-- block -->

***

<!-- block -->

<img src="media/shared/20251208_130849.webp" alt="" style="display: block; margin-left: auto; margin-right: auto">
---
## 🏆 Model Bake-Off: Execution

<!-- block -->

### **Time to run your bake-off!**

<!-- block -->

<!-- row -->
<div class="callout">### **Setup:**

We will break out into **small groups of ~4-5 people**

Each group will:
1. **Choose a shared prompt** based on one of your concept briefs
2. **Run it through 4 models** (choose 2 image models & 2 video models)
3. **Score each output** using the evaluation criteria
4. **Discuss and compare** results within your group</div>
<!-- col -->
<img src="media/shared/20260202_163939.webp" alt="" style="display: block; max-width: 563.21875px; width: 563.21875px;;;;;;;;;;; margin-left: auto; margin-right: auto">
<!-- /row -->

<!-- block -->

***

<!-- block -->

<!-- row -->
### 👣 Steps:

**1. Create a copy** of the [bake-off scorecard](https://docs.google.com/spreadsheets/d/1X0HO5AYAWEsPhAMUrSR_3wY5PgtFWIrwWUiCGbMN738/copy)

**2. Elect a "Flora driver" to set up the Flora project:**
  - 2 image nodes
        - As a group, choose two different image models to test
  - 4 video nodes (two connected to each image node)
     - As a group, choose two different video models to test
 - Indicate your chosen image/video models in the scorecard

**3. Write a text prompt** based on one of your group's concept briefs, then copy it into each of the two image nodes

**4. Run the generations** in each the two image nodes

**5. Score the output** (1-5) of each of the two image generations against the evaluation criteria

**6. Run the generations** in each of the four video nodes
- Optionally, add an additional text prompt to guide the video generations (same for all four nodes)

**7. Score the output** (1-5) of each of the four video generations against the evaluation criteria
<!-- col -->
<img src="media/shared/20260210_152834.webp" alt="" style="display: block; max-width: 378.015625px; width: 378.015625px;;;;; margin-left: auto; margin-right: auto">
<!-- /row -->

<!-- block -->

<div class="callout">### **Remember:**

The goal isn't to find the "best" model overall — it's to find the **best model for YOUR specific use case**.

Different models excel at different tasks.</div>
---
## 📢 Bake-Off: Share Results

<!-- block -->

<!-- row -->
<img src="media/shared/20251208_132308.webp" alt="" style="display: block; max-width: 525px; width: 525px; margin-left: auto; margin-right: auto">
<!-- col -->
### **Each group shares:**
- **Your scorecard** + rationale for top/bottom performing models
- **Surprises** – any unexpected results?
- **Recommendations** – which models would you use for what?
<!-- /row -->

<!-- block -->

***

<!-- block -->

<div class="callout">### **Discussion:**

- Did different groups get **different results** with the same models?
- What does this tell us about the importance of **testing on YOUR specific tasks**?
- How might your **model choices differ** between exploration (cheap/fast) vs. final production (quality)?</div>
---
## ⭐ Recap

<!-- block -->

<img src="media/shared/20251208_102253.webp" alt="" style="display: block; max-width: 909.9921875px; width: 909.9921875px;;;; margin-left: auto; margin-right: auto">

<!-- block -->

### **Key Takeaways from Live Session 3:**
- **DIY evals build intuition fast** – Create simple, verifiable tasks based on your expertise to quickly assess what models can and can't do.
- **Model evaluation matters** – Go beyond vibes; define specific criteria to make informed choices.
- **Bake-offs reveal model strengths** – Structured comparison on YOUR tasks shows which models work best for your specific needs.
- **Context matters** – The "best" model depends on your use case, not universal benchmarks.

<!-- block -->

***

<!-- block -->

<div class="callout">### **Up Next: Module E (Async)**

In [Module E](session.html?cohort=cohort-02&file=module-e&card=module-e-pre-viz-channel-adaptation), you'll use your system prompt to brainstorm concepts, create image and video pre-viz for your capstone, and adapt your work for different channels.

This is where your capstone really takes shape!</div>