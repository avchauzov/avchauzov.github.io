---
title: "Token optimization: three production patterns that reduce LLM costs by 70%"
description: "API-level caching, semantic similarity-based caching, and dynamic compression with LLMLingua form a layered approach to token reduction. Each pattern targets different inefficiencies in the prompt processing pipeline."
date: 2025-12-02 00:00:00 +0000
math: true
---

Production LLM costs scale quadratically $O(N^2)$ with input length during the prefill phase. For RAG systems retrieving 10 documents at 500 tokens each, this means 5,000 input tokens per request before generation starts.

Three patterns reduce these costs: **API-level prompt caching** for static context, **semantic caching** for similar queries, and **dynamic compression** for long variable inputs. These are not alternatives — they stack. Each layer operates on tokens that survived previous filters.

## Pattern 1: API-level caching

Major LLM providers implement token-level caching at infrastructure level. The mechanism is simple: if your prompt prefix matches a cached prefix byte-for-byte, the API reuses computed attention states. Cost reduction is approximately **90%** for cached tokens

The constraint is positional. Cached content must be at the start of the messages array. One character difference breaks the cache.

**Primary Target**: System Context

Static instructions, few-shot examples, policy documents — anything that does not change between requests.

```python
from llm_client import LLMClient  # Abstract client interface

client = LLMClient()

# Model configuration
llm_model_name = "your-llm-model"  # Replace with your provider-specific model

# Static context positioned first
SYSTEM_CONTEXT = """You are a financial analyst.
Company guidelines: [1,000 tokens of static policies]
"""

def query_with_cache(user_query: str) -> str:
    response = client.generate(
        model=llm_model_name,
        messages=[
            {"role": "system", "content": SYSTEM_CONTEXT},  # Cached
            {"role": "user", "content": user_query}         # Variable
        ]
    )
    return response.content
```

**Common Implementation Error**: Placing timestamps or request IDs at the top of messages. This invalidates the cache immediately. Variable metadata goes to headers or end of user message.

**Savings**: 50–90% on static context. First request pays full cost. Subsequent requests with identical prefix hit cache.

## Pattern 2: semantic similarity caching

API caching requires exact token match. Semantic caching handles queries that are lexically different but semantically identical.

The implementation is straightforward: convert queries to embeddings, compare using cosine similarity. If similarity exceeds threshold $\theta$, return cached response.

```python
import numpy as np
from llm_client import LLMClient, EmbeddingClient  # Abstract client interfaces
from sklearn.metrics.pairwise import cosine_similarity

llm_client = LLMClient()
embedding_client = EmbeddingClient()

class SemanticCache:
    def __init__(self, threshold: float = 0.95, embedding_model_name: str = "your-embedding-model"):
        self.cache = {}  # {hash: (embedding, response)}
        self.threshold = threshold
        self.embedding_model_name = embedding_model_name

    def _embed(self, text: str) -> np.ndarray:
        response = embedding_client.create_embedding(
            model=self.embedding_model_name,
            input=text
        )
        return np.array(response.embedding)

    def get(self, query: str) -> str | None:
        query_emb = self._embed(query)

        for cached_emb, response in self.cache.values():
            similarity = cosine_similarity(
                query_emb.reshape(1, -1),
                cached_emb.reshape(1, -1)
            )[0][0]

            if similarity >= self.threshold:
                return response
        return None

    def set(self, query: str, response: str):
        query_emb = self._embed(query)
        self.cache[hash(query)] = (query_emb, response)

# Usage
cache = SemanticCache(threshold=0.95)

def query_with_semantic_cache(query: str, llm_model_name: str = "your-llm-model") -> str:
    cached = cache.get(query)
    if cached:
        return cached

    response = llm_client.generate(
        model=llm_model_name,
        messages=[{"role": "user", "content": query}]
    )
    response_text = response.content

    cache.set(query, response_text)
    return response_text
```

**Economics**: Embedding costs ~$0.0001 per query. LLM inference costs ~$0.01 per query. Break-even after 2–3 cache hits.

**Threshold Selection**: $\theta = 0.95$ is conservative. Lower values ($\theta = 0.90$) increase hit rate but risk semantic drift. For customer support or internal Q&A, hit rates of 30–50% are typical.

**Savings**: 10–50% depending on query patterns.

## Pattern 3: dynamic compression with LLMLingua-2

For long, unique context (RAG documents), caching does not help. Compression reduces token count by removing low-information content.

LLMLingua-2 reformulates prompt compression as token-level binary classification (Keep/Discard). Unlike the original LLMLingua that uses perplexity from causal models, LLMLingua-2 trains a compact BERT-based classifier on data distilled from larger models. This approach eliminates unidirectional context limitations and provides task-agnostic compression.

The key advantage: LLMLingua-2 is 3–6× faster than perplexity-based methods while maintaining higher accuracy on out-of-domain data.

```python
from llmlingua import PromptCompressor
from llm_client import LLMClient  # Abstract client interface

llm_client = LLMClient()

# Model configuration
compression_model_name = "your-compression-model"  # Replace with your compression model

compressor = PromptCompressor(
    model_name=compression_model_name,
    device_map="cpu",
    use_llmlingua2=True  # Explicit LLMLingua-2 mode
)

RETRIEVED_DOCS = """
Document 1: Apple Inc. reported revenue of $89.5 billion for Q3 2024...
Document 2: Services revenue grew 14% year-over-year to $23.1 billion...
[5 documents, ~300 words total]
"""

QUESTION = "What was Apple's Q3 revenue?"

def compress_and_query(context: str, question: str, rate: float = 0.5) -> str:
    # Compress with structural token preservation
    compressed = compressor.compress_prompt(
        context,
        rate=rate,           # Keep 50% of tokens
        force_tokens=['\n', '?']  # Preserve line breaks and questions
    )

    compressed_text = compressed["compressed_prompt"]

    # Metrics
    original_words = len(context.split())
    compressed_words = len(compressed_text.split())
    print(f"Compression: {original_words} → {compressed_words} words ({compressed_words/original_words:.1%})")

    # Model configuration
    llm_model_name = "your-llm-model"  # Replace with your provider-specific model

    response = llm_client.generate(
        model=llm_model_name,
        messages=[
            {"role": "system", "content": compressed_text},
            {"role": "user", "content": question}
        ]
    )
    return response.content
```

**Critical Parameter**: `force_tokens`

This parameter prevents removal of structurally important tokens (newlines, punctuation). Without it, compression can merge sentences and break document boundaries, degrading retrieval context.

**Performance Profile**: Compression adds 100–300ms latency for 8K tokens. But prefill cost $O(N^2)$ dominates for $N > 500$. At compression rate $r = 0.5$ (50% reduction), net speedup is approximately $1.7\times$.

**Accuracy Trade-off**: At $r \leq 0.2$ (keep 20% of tokens), accuracy loss is minimal (within 2%) for QA tasks. Beyond $r = 0.1$ (keep 10%), grammatical coherence degrades. For code or JSON, damage occurs earlier.

**Savings**: 50–80% on long context.

## Measurement

Token optimization requires tracking effective token usage, not just raw counts.

Key metrics:

- **Cache Hit Rate**: $\frac{\text{hits}}{\text{total requests}}$. Target: >30% for API cache, >40% for semantic cache
- **Effective Compression Ratio**: $\frac{\text{original tokens}}{\text{processed tokens}}$. Includes both caching and compression
- **Cost Reduction**: $1 - \frac{\text{current cost}}{\text{baseline cost}}$

```python
from dataclasses import dataclass

@dataclass
class TokenMetrics:
    total_input_tokens: int
    cached_input_tokens: int
    output_tokens: int
    cache_hits: int
    cache_misses: int

    def effective_cost(self, input_price: float = 0.01,
                      output_price: float = 0.03) -> float:
        """Cost in $/1K tokens (typical LLM API pricing)"""
        uncached = self.total_input_tokens - self.cached_input_tokens
        cached_cost = self.cached_input_tokens * (input_price * 0.1) / 1000
        uncached_cost = uncached * input_price / 1000
        output_cost = self.output_tokens * output_price / 1000
        return cached_cost + uncached_cost + output_cost

    def hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return self.cache_hits / total if total > 0 else 0.0
```

## Implementation strategy

These patterns form a hierarchy. Apply them in order:

**Layer 1 (API Caching)**: Apply first. Zero overhead for static prompts. Expected savings: 50–90%.

**Layer 2 (Semantic Caching)**: Add when queries show lexical variation but semantic similarity. Common in customer-facing systems. Expected savings: 10–50%.

**Layer 3 (Compression)**: Apply only when $N > 1000$ tokens. Compression overhead (100–300ms) must be justified by prefill cost reduction. Expected savings: 50–80%.

In production RAG:

1. System instructions cached at API level
2. User queries cached semantically
3. Retrieved documents compressed dynamically

## Edge cases and limitations

**API Cache Breaks Silently**

If prompt structure changes — reordering, adding metadata — cache misses occur without warning. Monitor hit rate. Drop below 20% indicates structural drift.

**Semantic Cache False Positives**

At $\theta = 0.90$, semantic drift becomes noticeable. For high-stakes applications (finance, medical), keep $\theta \geq 0.95$ or add manual validation for borderline cases.

**Compression Destroys Structure**

Token pruning breaks syntax for code, JSON, and reasoning chains (CoT). LLMLingua-2's BERT-based classification helps, but for code-heavy prompts, use function-level compression instead of token-level. Use `force_tokens` parameter to preserve critical structural elements (newlines, brackets, punctuation).

**Overhead Dominates Small Inputs**

For $N < 500$, compression latency exceeds prefill savings. The crossover point depends on hardware, but general rule: compress only when input exceeds 1,000 tokens.

**Embedding Model Drift**

Semantic cache depends on embedding model. If you update from one embedding model to another, cache becomes invalid. This requires migration or cache flush.

## Benchmarks

Internal RAG system (10-document retrieval, 500 tokens/document, 10,000 requests/day):

---

| Configuration      | Tokens/Request | Daily Cost | Savings | Latency ($P_{50}$) |
| ------------------ | -------------- | ---------- | ------- | ------------------ |
| Baseline           | 5000           | $500       | —       | 850ms              |
| + API Caching      | 2000           | $250       | 50%     | 850ms              |
| + Semantic Cache   | 1500           | $180       | 64%     | 820ms              |
| + Compression (2×) | 750            | $120       | 76%     | 1030ms             |

---

Compression adds ~200ms overhead. Acceptable for batch processing or async workflows. For real-time systems with $P_{95} < 500ms$ latency requirements, compression is typically excluded.

## When to use

**API Caching**: Always. No downside if you can structure prompts with static prefix.

**Semantic Caching**: When >20% of queries are semantically similar. Common in support chatbots, internal Q&A, FAQ systems.

**Compression**: When retrieved context regularly exceeds 1,000 tokens and latency tolerance is >500ms. Not suitable for real-time chat interfaces.
