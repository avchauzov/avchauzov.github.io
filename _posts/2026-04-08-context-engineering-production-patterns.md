---
layout: default
title: "Context engineering as a production discipline"
description: "Failure modes, architectural patterns, and evidence from real systems."
date: 2026-04-08 00:00:00 +0000
---

Context window capacity has grown faster than our ability to use it well. As limits expanded from 4k to 128k to several million tokens, the default engineering response was straightforward: include more. In practice, this creates systems that are expensive to run, unpredictable under load, and increasingly difficult to debug as session length grows.

**Context engineering** is the discipline of treating context as a finite, governed resource. Not a buffer to fill, but a pipeline to assemble — per request, per session state, per agent step.

## Context engineering vs prompt engineering

Prompt engineering optimizes wording: role instructions, few-shot examples, chain-of-thought triggers. The unit of work is a single string.

Context engineering operates at the system level. It requires orchestration loops, memory tiers, and data pipelines — not better phrasing.

The shift is from static scripts to dynamic assembly.

## How context fails in production

Four failure modes appear consistently across production systems.

**Context rot** — as the window grows, precision drops. Models exhibit the "lost in the middle" effect: information placed at the center of a long context is systematically under-attended. Multi-hop reasoning degrades sharply past 16–32k tokens even when the answer is technically present.

**Instruction fade-out** — in long-running agent sessions (typically past **15–30** tool calls), system instructions placed at the beginning of the prompt lose influence. The model silently deviates from them — completing tasks prematurely, skipping error recovery, or changing output format.

**Tool bloat** — injecting large numbers of tool schemas upfront carries a significant token cost. **90** tools consume **~50,000+** tokens before a single reasoning step. When too many options are present, models spend disproportionate output budget on tool selection rather than task execution.

**Summary drift** — naive context compaction (summarizing history when the limit approaches) destroys exact operational details: file paths, variable names, identifiers. Agents that depend on these details after compaction fail silently, with no visible error.

## Patterns that address this

### Progressive disclosure

Load tool schemas in tiers, not upfront. At discovery, inject only names and short descriptions (~80 tokens per tool). Full schemas load only when the model explicitly selects a tool. This bounds token overhead regardless of total tool count.

**Caveat**: accuracy degrades past ~100 tools due to overlapping descriptions causing misactivation. Past that threshold, domain grouping or a meta-search tool becomes necessary.

### Sub-agent context isolation

Agentic architectures delegate exploratory subtasks — codebase search, document retrieval, log analysis — to sub-agents running in isolated context windows. The sub-agent processes thousands of tokens of intermediate results; the main orchestrator receives only a distilled summary.

This keeps the planner's context window bounded and prevents tool output accumulation — one of the most common sources of context bloat in multi-step pipelines.

### Tiered compaction with pressure thresholds

Rather than binary compaction (summarize everything when the limit is near), apply graduated pressure:

---

| Threshold  | Action                                                                |
| ---------- | --------------------------------------------------------------------- |
| ~80% usage | Observation masking — replace verbose tool outputs with file pointers |
| ~85% usage | Fast pruning — drop low-signal turns from working memory              |
| ~99% usage | Full LLM compaction — summarize episodic history                      |

---

The key architectural decision: recent turns bypass compaction entirely. **Episodic memory** (LLM-generated summary for strategic context) is kept separate from **working memory** (last N turns verbatim for operational detail).

### Event-driven system reminders

Rather than relying on system prompt instructions to persist across a long session, inject targeted reminders as `user` role messages immediately before the relevant LLM call. Single-purpose, maximum recency.

**Caveat**: strictly cap at three or fewer per session. Beyond that, the model treats them as background noise.

## Production evidence

The following cases illustrate how the patterns above translate into concrete architectural decisions.

### LinkedIn — tool schema management

**Problem**: Exposing thousands of internal tools via namespace-loaded schemas consumed prohibitive context on every request.

**Approach**: Replaced static schema injection with a meta-tool design. The agent issues keyword queries against an internal tool registry; only matched schemas are injected into the active context window.

**Outcome**: **70%** reduction in customer issue triage time; **3x** faster time-to-insight for internal data queries.

### Dropbox Dash — retrieval API consolidation

**Problem**: Connecting the model to dozens of app-specific retrieval APIs produced analysis paralysis — the model spent context budget on API selection rather than answering queries.

**Approach**: Replaced disparate APIs with a single universal search index backed by a knowledge graph. Complex query construction was isolated into a dedicated sub-agent, freeing the main planner's context window for reasoning.

### Spotify — parallel agent isolation

**Problem**: Sequential multi-step workflows accumulated context across planning, budget allocation, and media scheduling — unrelated state from early steps persisted into later ones.

**Approach**: Decomposed the pipeline into parallel agents (routing, goal resolution, budget, media planning), each operating in an isolated context window.

**Outcome**: Media plan creation time reduced from **15–30 minutes** to **5–10 seconds**.

---

The shared pattern across all three cases: decompose context ownership, never let a single window carry the full task state.

## The core constraint

Every token in the context window competes for the model's attention. Tool schemas, conversation history, retrieved documents, system instructions — all draw from the same finite budget.

The engineering question is not "how large is the window?" but "what deserves to be in it at this step?"

---

_Treating context as a dynamic, tiered pipeline — assembled per request, pruned under pressure, isolated across agents — is the difference between a system that scales and one that degrades silently as usage grows._
