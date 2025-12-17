---
layout: default
title: "Hybrid retrieval with reciprocal rank fusion: solving the score normalization problem"
description: "Pure vector search isn't always enough. Weighted averaging of BM25 and vector scores breaks due to incompatible scales. Reciprocal Rank Fusion solves this by using ranks instead of scores."
date: 2025-10-06 00:00:00 +0000
---

Vector search excels at semantic understanding but fails on exact matches: product codes, error messages, and abbreviations. The obvious solution is combining **BM25** lexical scores with vector similarity. The problem? Their scores are incompatible, and naive normalization can even make results worse.

**Reciprocal Rank Fusion (RRF)** solves this by ignoring scores entirely and using **document ranks** instead. It's simple, requires minimal tuning, and works effectively in production.

## Why weighted averaging fails

The naive approach to hybrid search uses weighted combination of scores:

```python
combined_score = alpha * vector_score + (1 - alpha) * normalized_bm25_score
```

This approach is flawed because **BM25** and cosine similarity scores exist in different spaces and, more importantly, come from **different distributions**. **BM25** scores are unbounded, while cosine similarity lives in the `[0, 1]` range.

Consider a concrete example with three documents:

---

| Document | BM25 Score | BM25 Rank | Norm. BM25 | Vector Score | Vector Rank | Combined (α=0.5) | Final Rank |
| -------- | ---------- | --------- | ---------- | ------------ | ----------- | ---------------- | ---------- |
| Doc A    | 15.2       | #1        | 1.0        | 0.73         | #3          | **0.865**        | **#1**     |
| Doc B    | 4.8        | #3        | 0.0        | 0.91         | #1          | 0.455            | #3         |
| Doc C    | 8.1        | #2        | 0.33       | 0.85         | #2          | 0.590            | #2         |

---

**Doc B** ranks #1 in vector search (most semantically relevant) and #3 in BM25. **Doc A** ranks #1 in BM25 but #3 in vector search. After weighted averaging with `α=0.5`, **Doc A wins the final ranking** despite being semantically weakest.

The problem: normalization aligns score ranges but can't fix the **distribution mismatch**. When BM25 produces one extreme outlier (15.2 vs 8.1 vs 4.8), Min-Max normalization compresses the middle documents into a narrow band. The vector component's distinctions (0.91 vs 0.85 vs 0.73) get overwhelmed by BM25's normalized spread (1.0 vs 0.33 vs 0.0).

You could tune `alpha` to balance the components, but the **unboundedness** of BM25 distribution makes it extremely challenging. As a result, any chosen `alpha` will be suboptimal for many queries.

## Reciprocal rank fusion: ranks instead of scores

RRF approaches the problem from a different angle: it switches from scores to ranks and calculates a fusion score based on them:

```python
RRF_score(d) = Σ 1 / (k + rank(d))
```

Here, `rank(d)` is the document's position in each ranked list (starting from 1), and `k` is a smoothing constant (typically 60).

**Example**: Consider how RRF weighs different results. Suppose we have two search systems (BM25 and Vector) and two documents, A and B.

- **Document A** is ranked #1 by BM25 (a perfect keyword match) but is only ranked #25 by the vector search (semantically less relevant).
- **Document B** is ranked #5 by both BM25 and vector search, showing consistent relevance.

From a user perspective, we'd prefer to see consistently relevant results (even if not perfect by one criterion) rather than a result that excels in one dimension but fails in another. Which one should be ranked higher? Let's calculate their scores with `k=60`:

- Score for **Document A**:
  `1/(60 + 1) + 1/(60 + 25) = 1/61 + 1/85 ≈ 0.0164 + 0.0118 ≈ 0.0282`

- Score for **Document B**:
  `1/(60 + 5) + 1/(60 + 5) = 2/65 ≈ 0.0308`

In this scenario, **Document B wins**. This is the desired outcome.

This demonstrates the core principle of RRF: it values reliable **consensus** over a single, brilliant-but-contradictory result.

Why does this matter? This mechanism makes your search results more **robust**. It prevents situations where a document that is good on only one dimension (e.g., perfect keywords but wrong meaning) incorrectly bubbles up to the top. RRF acts as a smart tie-breaker that trusts the agreement between your different search methods.

**Why this works**:

- **Score-agnostic**: A rank is a universal measure, whether it comes from a BM25 score of 8.3 or a cosine similarity of 0.9.
- **Consensus-driven**: Documents ranking high across multiple systems are a strong signal of true relevance.
- **Smoothing**: The constant `k` (e.g., 60) prevents extreme bias toward top-ranked results. While it's tunable, the default often works well.

## When to use hybrid retrieval

Hybrid search isn't always necessary. Use it when **exact matches matter**, such as for product IDs, error codes, legal citations, or domain-specific terms. Vector embeddings alone are not well-suited for these tasks.

It's also crucial to **validate both retrieval paths independently**. If one path consistently returns low-quality results, fixing that retriever is more important than choosing a fusion method.

## Implementation (from scratch)

RRF is integrated into many vector databases, but let's implement it from scratch to understand the mechanics.

```python
from typing import List, Dict, Tuple

def reciprocal_rank_fusion(
    search_results_dict: Dict[str, List[str]],
    k: int = 60
) -> List[Tuple[str, float]]:
    """
    Perform Reciprocal Rank Fusion on multiple ranked lists.

    Args:
        search_results_dict: Dictionary mapping retrieval method name
                           to ranked list of document IDs
        k: Smoothing constant (default: 60)

    Returns:
        List of (doc_id, rrf_score) tuples, sorted by score descending
    """
    rrf_scores = {}

    for retriever_name, doc_ids in search_results_dict.items():
        for rank, doc_id in enumerate(doc_ids, start=1):
            if doc_id not in rrf_scores:
                rrf_scores[doc_id] = 0.0
            rrf_scores[doc_id] += 1.0 / (k + rank)

    # Sort by RRF score descending
    sorted_results = sorted(
        rrf_scores.items(),
        key=lambda x: x[1],
        reverse=True
    )

    return sorted_results


# Example usage
if __name__ == "__main__":
    # Simulated search results from two retrievers
    search_results = {
        "bm25": ["doc1", "doc3", "doc5", "doc2", "doc4"],
        "vector": ["doc2", "doc1", "doc4", "doc5", "doc3"]
    }

    fused_results = reciprocal_rank_fusion(search_results, k=60)

    print("RRF Results:")
    for doc_id, score in fused_results[:3]:
        print(f"{doc_id}: {score:.4f}")
```

**Key Considerations**:

- **Retrieval Window**: It's good practice to fetch more results from each retriever than you ultimately need (e.g., 2x your target). This gives RRF a larger pool of candidates to fuse and re-rank.
- **The k parameter**: While `k=60` is a balanced default, you can experiment. A lower `k` (e.g., 10–20) gives more weight to top ranks, while a higher `k` (e.g., 80–100) flattens the curve, giving deeper results more influence.

## Production results

Based on published benchmarks and case studies, hybrid retrieval with RRF typically shows:

**Quality improvements**:

- Recall on queries with specific identifiers: +25–30%
- Overall recall improvement: up to 30% compared to single-method retrieval
- NDCG@k improvements: hybrid search consistently ranks highest across benchmark datasets

**Latency characteristics**:

- Pure vector search: ~55ms (p50)
- Hybrid search with RRF: ~65ms (p50), ~90ms (p95)
- Fusion overhead: ~10ms

The latency increase comes primarily from running two retrieval paths. Parallel execution keeps this overhead manageable.

## The full architecture

RRF often serves as a key component in a multi-stage retrieval cascade. For example:

1. **Stage 1: Retrieval**. Fetch candidates using hybrid search (e.g., 128 from BM25 + 128 from Vector) → up to 256 candidates.
2. **Stage 2: Fusion**. Apply RRF to the candidate pool → 32 finalists.
3. **Stage 3: Reranking**. Use a powerful cross-encoder to rerank the finalists → 8 final results.

## The core principle

RRF solves the score normalization problem that breaks simple weighted averaging. When both retrieval methods produce reasonable results independently, RRF's rank-based fusion effectively surfaces the most relevant documents through consensus.
