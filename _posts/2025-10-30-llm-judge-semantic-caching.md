---
title: "Semantic prompt caching: when LLM-judge beats exact match"
description: "Standard prompt caching requires exact prefix match. LLM-Judge validates semantic equivalence, rescuing cache hits on paraphrases while adding controllable latency overhead."
date: 2025-10-30 00:00:00 +0000
---

Prompt caching cuts latency by **85%** — but breaks completely on paraphrases. Change "Show sales data" to "Display sales data" and you get a cache miss, forcing full regeneration at 10x the cost.

The reason is simple: KV-Cache works at token level. The system reuses precomputed Key-Value tensors only when input sequences match exactly. No semantic understanding at this layer.

## The LLM-judge approach

Instead of exact matching, use a small LLM to validate semantic equivalence. The judge determines if a cached query-response pair works for the new query — checking intent, not tokens.

```python
def semantic_cache_lookup(query, vector_store, judge_llm):
    # Fast embedding filter (FAISS, <50ms)
    candidates = vector_store.similarity_search(query, k=3, threshold=0.85)

    if not candidates:
        return None  # No semantic candidates

    # LLM-Judge validation (~100 input tokens, ~50 output tokens)
    for cached_query, cached_response in candidates:
        prompt = f"""\
            Query 1: {cached_query}
            Query 2: {query}
            Cached Response: {cached_response}

            Is the cached response valid for Query 2? Answer YES or NO.
        """

        judgment = judge_llm.generate(prompt, max_tokens=5)
        if judgment.strip().upper() == "YES":
            return cached_response  # Cache hit

    return None  # Semantic validation failed
```

Fast embedding filter + deeper judge validation. Two stages, different purposes.

## The latency problem

**Critical constraint: TTFT budget**. TTFT (Time To First Token) is what users actually feel — how long until they see the first word. The judge adds a full inference cycle. For a 7B model processing ~150 tokens, expect **150–250ms overhead**.

Do the math: if your target TTFT is 300ms and exact-match caching delivers 240ms, adding a 200ms judge makes things worse.

**Graceful failure is mandatory**. Judge is an optimization, not a dependency. Set aggressive timeout (200–350ms). Any failure (timeout, API error, parse error) must default to cache miss and proceed to generation. Never block user requests waiting for judge.

## Economics: when judge calls pay off

**Long outputs make the economics work**. If your typical response is 2,000 tokens at \$6/MTok (\$0.012 per response) and judge costs 150 tokens at \$1/MTok (\$0.00015), the judge is **80x cheaper** than regeneration. Cache hit rates above 15% make this profitable.

**Paraphrase-heavy workloads see immediate wins**. I've seen this work best in customer support systems where users ask the same thing 20 different ways ("reset password" vs "can't log in" vs "forgot credentials"). Technical documentation queries with varied terminology but identical intent.

High semantic match rate (40–60% from embeddings) means the judge converts many near-misses into hits.

## Skip it when

**Short outputs (<500 tokens)**: judge overhead approaches regeneration cost.

**Strict latency requirements (<200ms)**: no room for judge inference. Use embedding-only caching or accept exact-match limits.

**Context-dependent queries create false equivalence**. The judge must validate more than query text. "What's the weather?" needs location + timestamp metadata. "Recommend products for me" from different users needs user ID validation. Context mismatch = cache miss.

## Implementation notes

**Use White-Box confidence scores when available**. This avoids separate judge calls but requires API support for token probabilities (e.g., `logprobs` parameter). Best used as **write-time filter** to prevent caching low-confidence responses.

Logic:

1. Generate response with `return_logprobs=True`
2. Calculate confidence (geometric mean of token probabilities)
3. Only cache if confidence > threshold (e.g., 0.90)

```python
response = llm.generate(query, return_logprobs=True)
confidence = np.exp(np.mean(response.token_logprobs))

if confidence > 0.90:
    vector_store.add(query, response.text)  # Cache only high-confidence

return response.text
```

This adds **zero latency to retrieval** — validation happens at write time, not read time.

**Multi-turn conversations**: include conversation state in equivalence check. Same query in different dialogue contexts needs different responses.

**Monitor false positive rates**. Wrong cached responses hurt users. Track through downstream metrics (feedback, task success) and adjust thresholds.
