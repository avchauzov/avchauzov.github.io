---
layout: default
title: "Similarity metrics for embeddings"
description: "Why almost always cosine and what actually works?"
date: 2025-12-29 00:00:00 +0000
---

In retrieval and RAG pipelines, the choice of similarity metric is rarely questioned. Default is cosine, and we move on. But a metric is not just a post-processing step. It is part of the model. It defines what "close" means in your embedding space.

## Why cosine similarity became de-facto standard

Cosine compares the direction of vectors, ignoring their magnitude (L2 norm). Mathematically it is just the dot product on normalized vectors.

Why this is convenient:

**Scale invariance**. A long document and a short summary about the same topic end up close. The norm of a vector (which often correlates with text length or token frequency) does not affect the result. This was critical in the TF-IDF era, and the habit carried over to dense embeddings.

**Bounded output**. Result is always in `[-1, 1]`. You can set threshold like `0.75` and it means something. Compare this to L2 distance where you need to guess what "distance 47.3" means in 768-dimensional space.

**Training alignment**. Most embedding models are trained with **InfoNCE (Information Noise Contrastive Estimation)** or Cosine Embedding Loss. Using a different metric at inference means violating geometric assumptions that the model learned during training.

Hidden assumptions that cosine makes:

- Semantic meaning is encoded in direction, not magnitude
- Norm is noise (artifact of text length, word frequency)
- Embedding space lives on hypersphere (due to LayerNorm or explicit normalization)

## Where cosine similarity breaks down

### Anisotropy problem

**What you observe**: All similarity scores compressed into narrow range like `0.92–0.98`. Documents that are clearly irrelevant have scores almost identical to relevant ones.

**Root cause**: Representation collapse. In transformer-based embedding models, embeddings tend to occupy a narrow cone in high-dimensional space. When everything points roughly the same direction, cosine loses discriminative power. Ranking becomes sensitive to floating-point noise. Small changes in query formulation can dramatically change top-k results because the margin between relevant and irrelevant is tiny.

### Frequency bias

**What you observe**: Documents with common vocabulary consistently rank lower than documents with rare words, even when semantically they should be closer.

**Root cause**: High-frequency tokens occupy constrained angular regions of embedding space. Cosine similarity between tokens in these crowded regions is artificially inflated, regardless of semantic relatedness.

### Noise amplification

**What you observe**: Empty strings, garbage inputs, or **Out-of-Distribution (OOD)** samples appear in top results with surprisingly high scores.

**Root cause**: Model encodes uncertainty through low vector norm. Cosine normalization (dividing by norm) stretches these "uncertain" vectors to unit length, making them indistinguishable from confident predictions. If you accidentally index garbage, it will match everything.

### Confidence signal loss

**What you observe**: In recommendations, niche items with perfect angle match crowd out popular items that a user would actually prefer.

**Root cause**: In **Matrix Factorization (MF)** and collaborative filtering, vector norm encodes meaningful signal — popularity for items, activity level for users. Cosine destroys this information. Research showed that using cosine on MF embeddings can produce mathematically arbitrary results because regularization creates scaling freedom that dot product ignores but cosine does not.

## Dot product: when it outperforms cosine

Key difference: dot product combines direction and magnitude. `A · B = ||A|| ||B|| cos(θ)`

This matters when norm carries useful signal:

**Confidence encoding**. In some self-supervised setups, norm correlates with model certainty. These methods use contrastive or non-contrastive objectives where prototypical, frequently-seen samples develop larger norms, while rare or OOD samples have smaller norms. Dot product down-weights these uncertain predictions.

**Popularity signal**. In **Recommendation System (RecSys)**, "long" item vector typically means popular or high-quality item. "Long" user vector means active user with stable preferences. You often want to boost popular items slightly, and dot product does this automatically.

**Feature intensity**. In sparse representations (TF-IDF), magnitude indicates how strongly a feature is present. A document where a keyword appears 10 times should score higher than a document where it appears once. Cosine normalizes this away.

Production advantages:

- Computationally cheaper (no `sqrt`, no division)
- Vector databases (Milvus, Pinecone, Faiss) optimize heavily for Inner Product

Risks to consider:

- Without normalization, long documents dominate results regardless of relevance
- Unbounded output makes threshold selection difficult

**Important note**: If vectors are already normalized (`||v||=1`), dot product and cosine produce identical ranking. In this case, choosing dot product is purely computational optimization.

## Euclidean distance (L2): correct but demanding

When it applies:

- Clustering algorithms (k-means is built on L2)
- Computer vision tasks (comparing pixel intensities)
- Data where magnitude has physical meaning

Why it is rarely used directly for retrieval:

**Distance concentration**. In high dimensions (>1000), ratio of maximum to minimum distance approaches 1. Mathematical result known as "curse of dimensionality". Distinction between nearest and farthest neighbor becomes statistically meaningless for uniformly distributed data. Search quality degrades.

**Outlier sensitivity**. Quadratic dependence on coordinate differences means single spike in one dimension dominates total distance. Model artifacts or noisy dimensions have outsized impact.

**Scale sensitivity**. Without normalization, longer vectors are always "farther" from query, even if semantically they are richer.

## Manhattan distance (L1): where it applies

Where it has legitimate use:

- Sparse vectors (BM25-style representations)
- Binary embeddings (where L1 reduces to Hamming distance) — used in production for first-stage retrieval with 32x memory savings
- Tabular data with interpretable per-feature meaning
- Histogram comparison in computer vision

Why it fails for dense embeddings:

**Why L1 fails for dense embeddings**.
L1 distance is axis-aligned: it assumes that each coordinate has independent semantic meaning. This assumption holds for tabular or sparse features, but breaks completely for neural embeddings, where meaning is distributed across rotated subspaces.

As a result, L1 distance is highly sensitive to arbitrary basis rotations introduced during training. Two semantically equivalent embeddings can have very different L1 distances depending on how the network chose its internal representation.

From a systems perspective, L1 is also poorly supported by **Approximate Nearest Neighbor (ANN)** indexes and hardware acceleration paths, making it both **geometrically unsound and operationally inefficient** for dense embeddings.

### Quick reference (mental map)

---

| Metric      | What it preserves        | What it discards       | Typical use case           |
| ----------- | ------------------------ | ---------------------- | -------------------------- |
| Cosine      | Angular semantics        | Magnitude / confidence | Text embeddings, RAG       |
| Dot product | Direction + norm         | Scale invariance       | RecSys, learned retrievers |
| L2          | Absolute geometry        | Robustness in high-d   | Clustering, ANN internals  |
| L1          | Axis-aligned differences | Rotational invariance  | Sparse / tabular features  |

---

## When metric choice becomes a problem

These symptoms indicate that the similarity metric is masking issues in embedding space rather than solving them:

- Top-k results have nearly identical scores (>0.95 similarity)
- Reranker gives no improvement — suggests first-stage retrieval is already broken
- Hard metadata filters severely hurt recall
- Embedding norms correlate with document quality but you are using cosine
- Long documents systematically win or lose regardless of actual relevance

## Core principle: what cosine hides

Cosine similarity dominates not because it is optimal, but because it hides modeling imperfections. It suppresses magnitude, smooths anisotropy, and produces stable rankings even when embedding space is poorly calibrated. This makes it a safe default — but also a lossy one.

It works well when embedding magnitude is poorly controlled, when space is anisotropic, and when semantic signal mostly lives in direction. This describes the majority of modern text embedding models — especially those trained with contrastive objectives.

Other metrics are not worse — they are stricter. Dot product preserves confidence and popularity encoded in vector norm. L2 exposes absolute geometric structure. L1 assumes axis-aligned meaning that dense embeddings do not have.

The important point is not to "pick the best metric", but to understand what information your embedding space actually encodes — and what your metric silently discards.
