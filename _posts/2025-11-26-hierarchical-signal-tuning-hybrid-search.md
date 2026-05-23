---
layout: default
title: "Hierarchical signal tuning: optimizing components before fusion"
description: "Fusion algorithms like linear combination or RRF cannot fix poor input signals. Effective hybrid search requires a bottom-up optimization strategy: tuning field weights within BM25 and embedding strategies within dense components before attempting to merge them."
date: 2025-11-26 00:00:00 +0000
---

Hybrid search combines dense and sparse retrieval to improve ranking quality. Standard implementations assume that component systems ($S_{\text{dense}}$ and $S_{\text{BM25}}$) provide valid input signals. This assumption fails in production.

Fusion methods such as linear combination and Reciprocal Rank Fusion (RRF) optimize how components are merged. They do not optimize the components themselves. Tuning $\alpha$ or RRF constant $k$ yields minimal improvement when input rankings are corrupted.

### The component problem: unweighted field heterogeneity

Documents contain structured fields: title, body, and metadata. Standard BM25 implementations treat all fields equally. This ignores signal density.

Two common errors:

**1. The "Blob" Approach**: Concatenating all fields into single text. Title matches become equal to body matches. Positional signal is lost.

**2. The "Flat" Approach**: Querying fields with equal weight (default `multi_match` in Elasticsearch). Term frequency in long fields dominates short but high-signal fields.

**Concrete example**:

Query: `connection timeout`

- **Doc A (Relevant)**: Title contains "Connection Timeout"
- **Doc B (Noise)**: Body contains "...issue not related to connection timeout..." (long troubleshooting log)

Flat BM25 often ranks Doc B higher due to term frequency scaling with document length. The sparse component recommends incorrect documents.

### Why RRF does not solve this

RRF is often assumed to eliminate component tuning requirements. The formula:

$$RRF(d) = \sum_{r \in \text{rankings}} \frac{1}{k + r(d)}$$

RRF normalizes score distributions. It does not correct ranking errors. If unweighted BM25 ranks noise at position #1 and signal at position #10, RRF propagates this error. Aggregation does not create relevance from poor rankings.

### Stage 1: component-level optimization

Component rankings must be fixed before fusion is applied. BM25 is treated as a weighted sum:

$$S_{\text{BM25}}(q, d) = \sum_{f \in \text{fields}} w_f \cdot \text{BM25}(q, d_f)$$

**Optimization protocol**:

1. Disable fusion ($\alpha=0$ or disable dense component entirely)
2. Assign initial weights based on signal density hypothesis. Titles typically require $w_{\text{title}} \gg w_{\text{body}}$
3. Optimize for **NDCG@10** (precision at top ranks)
4. Monitor **HitRate@10** (recall constraint). Configurations that boost NDCG but reduce HitRate indicate over-filtering

Field weights force correct ranking order. Doc A (title match) must rank above Doc B (body noise) before reaching fusion stage.

### Stage 2: fusion-level optimization

After components are stabilized ($S_{\text{BM25}}^*$ and $S_{\text{dense}}^*$), fusion parameter is tuned:

$$R_{\text{final}} = \alpha \cdot S_{\text{dense}}^* + (1 - \alpha) \cdot S_{\text{BM25}}^*$$

With optimized inputs, $\alpha$ acts as semantic balancer rather than noise filter. Optimization surface becomes smoother. Optimal values are more stable across query types.

### Validation workflow: sequential optimization

Simultaneous optimization of all parameters ($w_{\text{title}}, w_{\text{body}}, \alpha$) creates combinatorial explosion. Sequential approach is more efficient:

1. **Step 1 (Sparse)**: Fix $\alpha=0$. Optimize field weights for NDCG@10 and HitRate@10. Freeze configuration
2. **Step 2 (Dense)**: Fix $\alpha=1$. Optimize embedding model or chunking strategy. Freeze configuration
3. **Step 3 (Fusion)**: Sweep $\alpha \in [0.0, 1.0]$ or RRF constant $k$

This coordinate descent approach reduces search space while maintaining optimization quality.

### Practical implementation notes

Field weight optimization requires validation set stratification. Query types (factual vs conceptual) may require different weight configurations. If optimal weights vary significantly across strata, per-query routing should be considered.

For legal/compliance corpora with structured sections (statute references, definitions, procedures), hierarchical tuning typically yields 3–5% NDCG@10 improvement over flat $\alpha=0.5$ baseline. Latency remains unchanged.

### Conclusion

Hybrid search quality is bounded by component quality. Fusion algorithms cannot compensate for poorly ranked inputs.

Optimization must follow hierarchy: fields → components → fusion. This bottom-up approach produces measurable performance gains that cannot be achieved through fusion parameter tuning alone.

---

<p align="center">
<i>Effective ensemble methods require effective base models. Optimize the parts before optimizing the whole.</i>
</p>
