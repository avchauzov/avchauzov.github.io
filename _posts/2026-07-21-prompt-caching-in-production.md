---
layout: default
title: "Prompt caching in production: where the savings disappear"
description: "KV cache reuse can cut inference costs and latency substantially on paper. Most production deployments capture a fraction of that gap, and the reason is structural rather than a missing configuration flag."
date: 2026-07-21 00:00:00 +0000
---

Prompt caching is one of the few inference optimizations that's easy to enable: through a configuration flag such as `enable_prefix_caching=True` in vLLM, automatically on OpenAI, or with a top-level `cache_control` on Anthropic and optional explicit breakpoints for finer control. Anthropic and OpenAI publish up to **90%** cost reduction and **80%** time-to-first-token improvement as ceiling numbers. What that looks like in practice is closer to Databricks' production batch-inference pipeline: a **2.5x** throughput increase and **3x** P50 latency reduction — achieved at a cache hit rate of only **30%**.

Yet production deployments often capture only a fraction of those ceiling numbers. The limiting factor is usually not the caching mechanism itself, but everything around it.

## What caching actually does

LLM inference runs in two phases. During **prefill**, the model processes the entire input sequence — every token in the prompt — and builds a key-value (KV) cache: attention key and value vectors computed per token/layer. This phase is compute-bound and scales with prompt length.

During **decode**, the model generates output tokens one at a time. Each step loads model weights and the growing KV cache from GPU memory. This phase is memory-bandwidth-bound — the bottleneck is how fast tensors can move, not how fast arithmetic can run.

Prefix caching exploits a structural redundancy: if two requests share an identical prefix — the same system prompt, the same document, the same tool schemas — the KV cache for that prefix can be computed once and reused for every subsequent request. Subsequent requests can skip most or all prefill computation for the cached portion, subject to block boundaries and implementation details. Only the unmatched suffix requires fresh prefill.

The savings are real, and they follow directly from the mechanism: since prefill for cached tokens is replaced by a cache lookup, those tokens are typically heavily discounted relative to standard input pricing. On self-hosted deployments using vLLM or SGLang, this shows up even more directly — the GPU cycles for that prefill simply aren't spent.

## Three ways prompt-caching savings disappear

### 1. Dynamic content in the wrong position

Prefix caching requires an **exact match on the token sequence from the start of the prompt**. Any variation ends the reusable prefix at that position; tokens after the divergence point require fresh prefill.

The common mistake: injecting per-request content (timestamps, request IDs, volatile session metadata, newly retrieved documents) near the beginning of the prompt, before the stable system instructions. A system prompt template that starts with `"Current time: {timestamp}"` has an effective cache hit rate of zero regardless of how much stable content follows.

The fix is mechanical: **static content first, dynamic content last**. Stable system instructions, tool schemas, few-shot examples, and shared reference context belong before request-specific content. User messages and any per-request variable content go at the end, after everything cacheable. A shared reference document reused across requests is cacheable; a per-request RAG result is not — order by reuse frequency, not by content type.

### 2. Round-robin load balancing across replicas

Single-replica caching works exactly as documented. The failure mode appears at scale.

A KV cache typically lives in GPU memory on a specific instance. Naive round-robin distributes requests uniformly across replicas, ignoring where each prefix is already cached. If only one of N replicas currently holds a prefix, the next request has only about a 1/N chance of reaching it. Requests routed elsewhere must repeat the prefill, potentially warming duplicate copies across the fleet.

Frequently reused prefixes may eventually become cached on every replica, but long-tail prefixes often do not survive long enough to reach that state. Autoscaling, cache eviction, limited KV capacity, and uneven request arrival continually reset the warm-up process. The result is duplicated computation and fragmented cache capacity rather than a permanent 1/N hit-rate ceiling.

Prefix-aware routing addresses this by tokenizing the incoming prompt, matching it against per-instance prefix state, and routing it to a worker with reusable overlap while accounting for current load. DigitalOcean reported up to a **108%** throughput improvement for the same hardware and workload when comparing cache-aware routing against round-robin.

This is the problem most teams don't encounter until they scale — and the reason production numbers often look worse than single-server benchmarks.

### 3. Agentic loops make cache hits progressively more expensive

Agent workloads have a cost structure that differs from request-response patterns in a non-obvious way.

In an agentic loop, each LLM call receives the full conversation history to date. If each turn adds roughly `d` tokens, the total volume of tokens processed across a `T`-turn session is `d + 2d + 3d + ... + Td ≈ O(T²)` — quadratic in the number of turns, even though any single call is only linear in its current length.

Caching reduces repeated prefill computation, but it does not eliminate the provider's accounting of cached-input tokens or the runtime cost of attending over a long context during decode. Under token-based API pricing, the cumulative cached-input volume still grows quadratically in this simplified model; it is merely charged at a lower per-token rate (sometimes as much as **10x** cheaper, depending on provider and model).

As a result, cached-input charges can eventually dominate costs that grow roughly linearly with the number of turns, such as a fixed amount of newly appended input and output per turn. The crossover depends on turn size, output length, model pricing, and the cache-read discount.

That crossover point isn't stable, either — it assumes the discount holds. Whenever the required prefix is missing — because of expiration, eviction, prompt changes, or routing to an unwarmed replica — the same tokens that were getting a discount suddenly don't: they're billed as full-price uncached input, or even at a premium cache-write rate. These events increase total cost and make it less predictable than the steady-state calculation suggests.

This is why aggressive context management — compaction, pruning, sub-agent isolation — isn't just about staying under context limits. It directly targets the quadratic term: shrinking or bounding the history that gets re-read on every call is what keeps the growth closer to linear instead of quadratic.

## What cache hit rate actually means in production

A reported **30%** cache hit ratio produced the **2.5x** throughput gain Databricks observed. That is not a contradiction: the impact of a hit ratio depends on which prefixes are reused, how long they are, and how much of the workload's latency comes from prefill. The same numerical hit ratio can produce very different results across workloads.

Reusing a `4,000`-token prefix eliminates roughly as much repeated prefill work as reusing one hundred `40`-token prefixes. The payoff therefore depends not only on the aggregate hit ratio, but on whether the workload contains long, stable, frequently repeated prefixes.

Two workload shapes reliably produce that: **batch inference over a shared corpus** — many requests against the same document, system prompt, or reference context, where precomputing the shared prefix makes that repeated prefill work nearly independent of request volume — and **multi-turn chat with stable system prompts**, where instructions, tool schemas, and prior history can be reused across turns, while only content appended beyond the reusable prefix requires fresh prefill.

Two shapes don't: **highly varied, short prompts** have no stable prefix worth caching, and prefill for them is fast regardless. **Workloads where prefill is already a small fraction of end-to-end latency** may see limited benefit, especially if cache lookup, memory pressure, or affinity-aware routing adds comparable overhead.

## The metric that matters before you optimize

Before tuning prompt structure or switching to prefix-aware routing, instrument cache reuse at the token level. vLLM exposes counters for cached and queried prefix tokens and an aggregate hit rate — but not a built-in breakdown by prompt segment. Attributing hits to the system prompt, tool schemas, or conversation history requires application-level tracing; tools like Langfuse can track the underlying token usage, but the segment mapping is on you.

What to look for:

- **Low reuse despite a stable system prompt** — likely prompt variation, unstable serialization, cache expiration, or eviction
- **High reuse but lower savings than expected** — likely a long uncached suffix or decode-dominated latency
- **Reuse degrading under load** — likely loss of cache locality or increased eviction pressure

---

<p align="center">
<i>Prompt caching is infrastructure, not configuration. Enabling it is the easy part. The gains come from aligning prompt structure, routing strategy, cache topology, and session architecture around a single constraint: repeated tokens must reach a worker or cache tier capable of reusing an unchanged prefix.</i>
</p>
