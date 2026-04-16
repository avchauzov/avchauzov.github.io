---
layout: default
title: "Context limits degrade routing quality faster than generation"
description: "Routing and classification under long prompts: score dilution, margin collapse, routing collapse, and practical caps."
date: 2026-01-18 00:00:00 +0000
---

Context windows are growing, but more context does not always help. Long-form **analysis** and **summarization** benefit from comprehensive context; **routing and classification** are different — the model must emit a discrete decision on every call.

Past a threshold, additional context **degrades routing decisions** before the physical window fills.

In practice, routing quality often remains stable only within a limited fraction of the context window (around **40–50%** in reported setups); beyond that share, margins tend to collapse.

## The 40% cliff

**Qwen2.5-7B** on a **128k-scale** setup is one **documented case**: F1 falls from **0.56** to **0.30** across a narrow range of prompt lengths — a cliff, not a slow slope.

Routing quality shifts from stable to unreliable within a small increase in context, rather than degrading gradually. That curve is **one model's**; it illustrates the **usable-band** idea from the introduction, not a guarantee for every router.

## Why routing breaks differently than generation

Open-ended generation can smooth over uncertainty with generic phrasing; quality often declines gradually. **Routing** still forces a discrete choice every time, so **logit separation** matters more than fluency. The failure is not softer text but **wrong or nearly tied scores** among options.

## Score dilution → margin collapse → routing collapse

### Score dilution

Attention over the prompt is **softmax-normalized**: weights sum to one, so each new token spreads a fixed mass of "focus" thinner. Current architectures do not guarantee that the gap between the correct logit and distractors grows with context length. As length increases, probability on the intended class shrinks even when the routing instruction is still present — context acts as **structured noise for the routing decision**, not neutral background.

### Margin collapse

When routing instructions sit mid-context instead of at the edges, accuracy falls by **over 30%** relative to edge placement; adding a few hundred distractor tokens can suppress reasoning traces by **up to 50%** (Qwen3.5-27B). For routers, that reads as a shrinking **top-1 minus top-2** margin: adjacent intents or model tiers stop separating cleanly.

### Routing collapse

When the **top-1 vs top-2 margin** becomes too small (e.g. **< 0.10**), the router **stops separating** options and **defaults to the safest path**.

**Hard negatives** — retrieved chunks that appear relevant but imply the wrong route — act as additional distractors, further narrowing margins when placed alongside correct context.

## Minimal production rules

### Hard cap at ~40%

Start with a **conservative fraction** of `MODEL_CONTEXT_WINDOW` and adjust it based on observed margin stability; when over budget, truncate oldest history or documents first.

```python
# For 128k model: ~50k routing budget
ROUTING_CONTEXT_CAP_FRACTION = 0.4
MAX_ROUTING_TOKENS = int(MODEL_CONTEXT_WINDOW * ROUTING_CONTEXT_CAP_FRACTION)

def prepare_routing_context(query, history, retrieved_docs):
    context = build_prompt(query, history, retrieved_docs)
    tokens = tokenizer.encode(context)

    if len(tokens) > MAX_ROUTING_TOKENS:
        # Truncate oldest history first
        context = build_prompt(
            query,
            history[-N_RECENT_TURNS:],
            retrieved_docs[:TOP_K_DOCS],
        )

    return context
```

### Confidence-aware cascading

When the margin between the top two routes is small, treat the decision as unreliable and escalate to a stronger model instead of accepting a noisy route.

```python
def route_with_cascade(query, context):
    scores = router.predict_proba(query, context)
    best, second_best = sorted(scores, reverse=True)[:2]
    margin = best - second_best

    if margin < CONFIDENCE_THRESHOLD:  # e.g., 0.10
        return FALLBACK_MODEL

    return argmax(scores)
```

## When context can be larger

The **~40%** band (of declared capacity) applies when **margin quality** drives system behavior — **routing**, intent classification, model selection. Different tasks face different constraints:

- **Document QA** — When retrieval is high-precision, comprehensive context helps; the bottleneck is finding the right passage, not attention dilution alone
- **Code generation** — Cross-file dependencies may justify near-full windows when structure and imports matter more than a single routing decision
- **Summarization** — Errors are gradual, not binary; models can smooth over lost detail without catastrophic failure

The distinction: routing failures are **costly and discrete** (wrong model or route wastes budget or breaks the request). Generation failures are often **recoverable** through iteration or reranking.

## Summary

**Routing quality collapses before context windows fill**. Operate within the **first ~40%** of declared capacity, **monitor top-1 vs top-2 margins**, and **escalate** to stronger models when scores are unstable — not when the window is full.

---

| Rule                       | Purpose                        | Typical threshold    |
| -------------------------- | ------------------------------ | -------------------- |
| Hard cap at ~40%           | Prevent cliff-like degradation | ~50k for 128k models |
| Confidence-aware cascading | Escalate uncertain routes      | Margin below 0.10    |

---
