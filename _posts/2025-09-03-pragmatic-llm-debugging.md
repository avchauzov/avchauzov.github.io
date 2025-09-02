---
layout: full-width
title: "Pragmatic LLM Debugging: A Survival Guide to Chaos"
description: My approach to breaking down complex RAG and agent systems when time is short, golden datasets are missing, and quality needs a fast boost.
---

Lately, I've been diving deep into prototyping and debugging LLM applications — from RAG to multimodal agents. The circumstances are almost always the same: no time for complex solutions, no perfect datasets, and a pressing need for high quality right now (or yesterday). This forced me to develop a pragmatic, almost detective-like approach to debugging, which I want to share.

### Step 1: Simplify and Isolate

When a system behaves unpredictably, my first reaction is to **disconnect everything non-essential**. Any "enhancing" but optional steps (like complex re-rankers or additional prompts) are temporarily removed. This helps isolate the core of the problem. If a task is too complex, I try swapping a giant model for something smaller and faster. It's surprising how often this not only speeds up iterations but also **improves stability** for a specific task.

### Step 2: A Granular Breakdown

After simplifying, I begin a step-by-step analysis, where each component is tested separately. Think of it as examining every clue at a crime scene.

- **For RAG Systems:** I follow the entire chain. First, I check what the retriever is actually finding. Are the chunks relevant? Is context being lost? **LLM-as-a-Judge** with a simple boolean score (e.g., 'relevant' or 'not relevant') can do 80% of the job and help to **check retrieval quality without manual labeling.**

- **For Multimodal Systems (VLMs):** If the input is an image, I verify what the model "sees" in the crop. Problems often arise from incorrect preprocessing (tiny crop or noisy context) or when the model hallucinates details that aren't there — a classic _multimodal hallucination_. Crucially, I also step back and ask: **is the model even capable of performing** this task, or are we asking for the impossible?

- **For Agentic Systems:** **Modular testing** is key. I break down complex instructions into simple prompts and test one after another, increasing complexity. With tracing tools like Langfuse, you can see the agent's entire "thoughts" and pinpoint exactly **where its logic went off track.** More classical ML tools like **Weights & Biases** are also useful, but on the later stages, especially if we have custom metrics to observe.

<p align="center">
<i>To understand the agent, you must become the agent.</i>
</p>

### Step 3: The Pursuit of Consistency

The goal of debugging isn't just to find a bug, but to achieve stable, predictable behavior. To do this, I heavily rely on **structured and granular output**. I instruct the model to return its response in JSON format and even apply post-processing to force the output into the required schema. This granularity is not just for reliability in the moment; it also makes it much easier to **spot performance drift** over time.

### The Guiding Principle: Interpretability

Finally, the most important point, which underpins this entire approach:

<p align="center">
<i>Every decision the system makes must be explainable with human logic. If I can't explain why an agent chose a particular tool or why a RAG system gave a specific answer, then we don't understand the system.</i>
</p>

This pragmatic approach — from simplification to a detailed breakdown — helps me quickly manage complex systems that, at first glance, seem like uncontrollable black boxes. It proves that even without perfect conditions, a structured, iterative process can lead to high-quality results.
