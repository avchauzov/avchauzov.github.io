---
layout: default
title: "The Reranking Trap: When Cross-Encoders Make Things Worse"
description: "Cross-encoders and LLM rerankers promise better retrieval precision, but the 200% latency penalty, diversity collapse, and production failures reveal when this expensive step becomes counterproductive."
date: 2025-10-27 00:00:00 +0000
---

Reranking has become a standard recommendation for improving RAG system quality. The narrative is straightforward: initial retrieval with **bi-encoders** casts a wide net, then **cross-encoders** or **LLM rerankers** refine the results through deeper semantic analysis. This two-stage architecture appears in virtually every production RAG guide.

Production systems show different results. Adding neural rerankers introduces latency penalties reaching **200%**, systematically suppresses result diversity, and often fails to improve quality for common query patterns. For high-throughput applications with strict latency requirements, this architectural choice becomes a bottleneck rather than an optimization.

### How Rerankers Work

**Cross-encoders** process query-document pairs as a single concatenated sequence, applying full self-attention across both inputs. This provides high precision but requires `N` forward passes for `N` candidates. Each pass encodes the complete pair.

**LLM rerankers** fall into two categories:

- _Pointwise_ approaches evaluate each pair independently, often generating reasoning traces before scoring.
- _Listwise_ methods process multiple documents in a single forward pass, significantly reducing inference overhead compared to pointwise alternatives.

**Late interaction models** (**ColBERT**) represent a middle ground. They compute token-level embeddings for queries and documents separately, then perform **MaxSim** matching at retrieval time. This preserves some cross-encoder precision while maintaining better scalability.

### The Three Problems

**Latency kills throughput**. Bi-encoders work fast because they precompute document embeddings offline, enabling approximate nearest neighbor (ANN) search in milliseconds. **Reranking cannot leverage precomputation** - it must evaluate the interaction between a specific query and document.

Pointwise LLM rerankers demonstrate **2-2.7x higher latency** than listwise alternatives due to sequential autoregressive decoding. In-context ranking with full fine-tuning exhibits exponential latency growth. At `N=500` documents, query latency reaches **~1.15 seconds** on a 7B model. Even efficient alternatives like ColBERT still increase query latency compared to pure vector search.

This computational load restricts practical application to small candidate sets - typically `k≤50`. **The high per-query computational cost** makes them unsuitable for high-throughput systems or initial retrieval stages.

**Diversity collapse happens by design**. Rerankers optimized exclusively for relevance systematically reduce result diversity in the top-`k` set.

Cross-encoders and pointwise LLM scorers assign scalar relevance scores to individual query-document pairs. This makes systems sensitive to redundancy in candidate lists. Documents containing diverse but non-optimal facts get filtered out, even when they provide valuable alternative perspectives. If the top candidates include five documents expressing the same idea with slight variations, the reranker places them all at the top. A document with a different viewpoint gets suppressed.

Clustering-based grouping strategies before reranking make things worse. K-Means clustering on BERT embeddings rewards redundancy rather than utility - semantically similar documents cluster together regardless of their complementary information value. For queries requiring comprehensive coverage, aggressive reranking that filters conflicting documents prevents LLM generators from accessing necessary information.

Maximal Marginal Relevance (MMR) was designed specifically to address this problem by explicitly trading relevance for diversity - but the tradeoff remains fundamental.

**Reranking often provides no benefit**. I've noticed in deployed RAG systems that reranking frequently fails to improve metrics or actively degrades them.

With strong bi-encoders, correct documents for basic fact-retrieval queries are often already first. Additional cross-encoder passes become redundant computational waste. **Garbage in, garbage out**. If the bi-encoder failed to include relevant information in the top-`k` candidates, the reranker has nothing meaningful to rank. It cannot _find_ missed documents, only _re-sort_ what it receives.

High-precision requirements reveal additional limitations. Academic search systems implementing citation-graph traversal expand candidate sets through reference networks, introducing substantial noise. LLM rerankers struggle to restore precision after this expansion - the noise-to-signal ratio becomes too high for effective filtering.

### When Reranking Actually Works

Reranking proves valuable in specific scenarios where the computational cost justifies precision gains.

**Hard candidates** requiring nuanced distinction benefit from cross-encoders. When initial retrievers return many semantically similar but redundant candidates, deep pairwise interaction (cross-attention) distinguishes subtle relevance nuances that bi-encoders miss.

**Complex instruction-following** queries (e.g., BRIGHT benchmark tasks requiring specific algorithmic approaches or theorem applications) need advanced rerankers. These models generate reasoning traces that capture logical relationships unavailable through simple semantic similarity.

**High-stakes domains** - legal search, medical diagnosis - where small precision gains justify significant latency increases. For these high-risk research tasks, reranking remains defensible. For high-throughput applications requiring sub-100ms responses, the tradeoff becomes unacceptable.

### Better Approaches

Before adding an expensive reranking step, consider more effective alternatives.

**Embedding model adaptation** often provides the best ROI. Fine-tuning bi-encoder models on domain-specific datasets can increase Context Recall by **+95%**, compared to an 8% recall improvement from adding LLM rerankers at the cost of increased latency. For scenarios requiring substantial quality gains without latency penalties, this approach delivers better system-level performance.

**Late interaction architectures** like ColBERT offer a viable compromise when response time constraints are strict. Token-level matching during retrieval provides precision approaching cross-encoders while maintaining scalability to large corpora.

**Context compression** through summarization-based approaches scales linearly `O(N)` when the challenge involves fitting many relevant but redundant documents into limited context windows. This avoids expensive candidate list analysis while addressing the core constraint.

**Maximal Marginal Relevance (MMR)** provides an algorithmic alternative that explicitly trades relevance for diversity through a balancing parameter `lambda`. The algorithm incorporates query similarity `(sim_1)` against dissimilarity with already-selected documents `(sim_2)`. **MMR is always a tradeoff** - increasing diversity deliberately reduces overall relevance, but avoids neural reranking's computational costs.

**GraphRAG** proves necessary for multi-hop or logical reasoning tasks requiring structured knowledge. Vector search followed by semantic reranking cannot effectively model hierarchical structures, causal chains, or logical dependencies critical for these scenarios. However, GraphRAG introduces excessive context for simple queries and should be avoided when tasks don't require deep contextual hierarchy.

**Decision framework**: Start with embedding adaptation. If latency permits and you have hard candidates or complex instructions, add reranking. For diversity-focused applications, consider MMR. For multi-hop reasoning, evaluate GraphRAG.

**Implementation priority**: In advanced RAG architectures, reranking should follow baseline pipeline stabilization (quality chunking, strong embeddings). It serves as an early optimization step to establish solid Recall@k and Groundedness metrics before pursuing more complex enhancements.

### Conclusion

Neural reranking isn't a universal improvement - it's a precision-latency tradeoff. The significant latency penalty, systematic diversity suppression, and failure modes on common query patterns contradict its framing as a mandatory step.

Effective deployment requires understanding when this expensive step provides measurable value. For most high-throughput systems, embedding adaptation or late-interaction models deliver better results. The decision to add reranking should be driven by empirical measurement against your latency budget, not architectural convention.

---

<p align="center">
<i>
If your bi-encoder already works well, don't add reranking. If you need precision gains and can afford the latency cost, measure first.</i>
</p>
