---
layout: default
title: "ML Metrics for Undefined Projects: 3 Critical Mistakes"
description: When building ML solutions without established playbooks, the wrong approach to metrics and validation can derail projects before you prove they work. A pragmatic framework for research, baselines, and deployment constraints.
date: 2025-09-05 00:00:00 +0000
---

I've worked on enough ML projects where there's no established playbook — niche recommendation systems, custom logic chatbots, experimental RAG applications. The pattern is often the same: vague requirements, no clear success criteria, and pressure to "just start building". This forced me to develop a deliberate approach to standardizing the process, which I want to share.

### Step 0: Don't Skip Research

Before touching any code, I spend a few days reading. Not just academic papers, but **actual production case studies**. How did similar companies solve adjacent problems? What metrics did they track? What failed?

This upfront research pays off massively. A few days of focused research can save you from building in the wrong direction entirely.

### Mistake #1: Starting with Model Metrics

When a project is undefined (and therefore business metrics aren't clear), my instinct used to be: "Let's build a prototype and see what accuracy we get". This is wrong.

**What works**: Speak with management first. Understand the cases they're trying to solve. Spend time creating test/validation datasets that reflect **real success scenarios**. For example, if you're building a document classifier, don't just track **F1-score**. Measure "hours saved per week" or "error rate in downstream processes." This clarity prevents overwork and helps you ship faster.

### Mistake #2: Ignoring Deployment Constraints Early

A model that can't be deployed will not become a product.

**What works**: Set hard limits upfront and communicate them. If your model needs **2s** to respond but users expect **500ms**, you know immediately that you need to rethink the architecture. Always measure both success metrics **and** proximity to deployment constraints (latency, cost, memory). This dual tracking helps you understand when to stop optimizing or when to split the task into smaller, deployable pieces.

### Mistake #3: No Baseline, No Validation

We all know it, most of us forget it. A simple baseline with proper business metrics beats a complex ML model that you can't validate properly.

**Example**: Before building any model, try a simple rule-based baseline first. Measure business impact (not **F1-score** or **AUC**). Establish your initial ROI — this becomes your **minimum viable success threshold**. Then iterate from there.

### The Must-Have Stages

Before writing any training code:

- **Research phase**: Study 5–10 production case studies and their metrics
- **Business metric definition**: Define minimum viable improvement threshold
- **Baseline building and measuring**: Test if rules/heuristics can solve this (at least partially)
- **Deployment constraints**: Set max cost per prediction and latency limits
- **Validation plan**: Define how to prove production impact (**A/B test**, shadow mode)

---

<p align="center">
<i>In undefined projects, your job isn't to build the best model. It's to prove that the right solution exists, then build the simplest version that creates measurable value.</i>
</p>
