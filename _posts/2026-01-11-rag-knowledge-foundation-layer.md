---
layout: default
title: "RAG fails upstream"
description: "Why most RAG failures originate in the data preparation layer, and what to do about it."
date: 2026-01-11 00:00:00 +0000
---

Most RAG debugging sessions swap around the same stock: prompt, embedding model, hyperparameters, reranker. Even when retrieval metrics improve, the system still gives wrong answers, because the problem usually started earlier — before any query was issued.

**Retrieval-Augmented Generation (RAG)** systems fail at three distinct points: generation, retrieval, and knowledge preparation. The first two receive most of the engineering attention, while the third — often called the **knowledge foundation layer** — is where failures most often originate and least often get diagnosed.

## The knowledge layer nobody names

**ECL replaces ETL**. Standard ETL thinking treats document ingestion as a solved problem: parse, chunk, embed, index. What gets overlooked is that meaning does not transfer automatically through this pipeline, which is why a better mental model is ECL: Extract, Contextualize, Link. The contextualize step is where most production failures occur. It involves mapping source schemas to normalized representations, establishing metadata that will govern retrieval scope, and making chunking decisions that cannot be corrected downstream.

## Chunking as architecture

Chunk boundaries determine what the model can retrieve and what it cannot, which is why chunking is an architectural decision.

**Flat chunking breaks multi-hop reasoning**. On multi-hop synthesis tasks, a standard flat RAG pipeline achieves **33%** accuracy, while indexing with hierarchical representations — storing both raw chunks and LLM-generated cluster summaries in a single flat store — reaches **85%** on the same benchmark, not because retrieval improved, but because what was indexed changed.

**Format-agnostic chunking destroys structure**. Applying text embedding logic to structured data treats every format as prose, erasing the relationships that make it meaningful: knowledge graph edges are severed, tables lose row-column structure, and multi-column layouts collapse into linear text. JSON is a simpler version of the same issue — tokenizers fragment syntax into structural noise, shifting the vector's semantic center. Converting these objects into natural language representations before embedding improves recall and **Mean Reciprocal Rank (MRR)** by roughly **20%** while reducing token counts.

**Parsing failures start before chunking**. In head-to-head comparisons across real enterprise documents, common parsers:

- Returned incomplete outputs on skewed or poorly scanned documents
- Merged text from unrelated layout boxes in complex magazine-style layouts
- Stripped all table formatting from financial filings, rendering the data uninterpretable

Parsing failures are not edge cases — they poison the context window before the first embedding is computed.

## Metadata is not tagging

The default approach to metadata is taxonomic: add a few labels for filtering, but it is easy to miss the structural role metadata plays in a functioning knowledge foundation.

**Metadata governs applicability**. Without fields that define scope — plan tier, enrollment date, region, effective date — retrieval cannot determine whether a returned passage is relevant to this user's condition. A topically relevant chunk about warranty terms is useless if it applies to a different product tier, but the system blends it into the answer anyway — high similarity score, wrong answer.

**Temporal metadata is a special case**. Without supersession rules and effective dates in the schema, systems retrieve historical truths with high confidence — the document is correct, but for a version of the world that no longer exists.

**Schema design cannot be retrofitted**. Decisions about which attributes to capture, how to represent them, and which fields to enforce need to happen at ingestion time. Changing the schema later requires full re-ingestion, and there is no patch that can be applied at query time.

## Query enrichment: when it helps, when it hurts

**Hypothetical Document Embeddings (HyDE)** generates a hypothetical answer before retrieval, then embeds that answer instead of the original query, which transforms the search from question-to-answer matching into answer-to-answer matching — a better-defined problem for dense retrieval.

The gains are real but conditional:

- On tasks with significant vocabulary mismatch, HyDE improves retrieval accuracy by up to **25%**
- On the TREC-COVID dataset, query rewriting boosted nDCG@10 by **5.1%** by standardizing varied medical queries to corpus-preferred nomenclature

The losses are also real:

- On the FiQA financial benchmark, prompt-only rewriting dropped nDCG@10 by **9%** and Recall@10 by **9.4%** — the rewriter discarded the precise jargon that made the original query retrievable
- For factual numerical domains, hallucinated figures in the hypothetical document actively misdirect the embedding
- Full pipeline latency: HyDE combined with hybrid search reached **11.7s** per query versus **1.4s** for standard embeddings

**HyPE moves the cost to index time**. A more production-viable alternative is **Hypothetical Prompt Embeddings (HyPE)**: generate synthetic questions per chunk at indexing time and embed those instead, turning retrieval into question-to-question matching. This improves context precision by up to **42 percentage points** with zero query-time latency overhead — the enrichment cost is paid once, at ingestion, which is exactly where it belongs.

## Evaluation, tracing, and index health

**Offline retrieval metrics** — Precision@k, Recall@k, MRR — are fast, cheap, and do not require an LLM call. They can catch chunking failures, metadata gaps, and embedding model mismatches before any prompt is written. Most teams run them post-deployment; running them as part of the ingestion pipeline changes what gets caught and when.

**Synthetic eval datasets require careful construction**. Generating queries with a generic prompt produces a shallow dataset that tests only the happy path. A more reliable approach is a reverse workflow — extract a specific fact from a chunk, then generate a query that can only be answered by that chunk.

**Index degradation at scale** is non-linear and frequently misdiagnosed. HNSW indexes suffer local minima traps as the corpus grows: results with high similarity scores (0.85+) that are topically irrelevant start appearing in top-k, and long-tail queries degrade in recall first.

In controlled testing, scaling from 10k to 200k vectors caused search latency to spike **12.3x** — from 90ms to 1,129ms — just to maintain recall. Increasing `ef_search` to recover recall doubles latency with each step, eventually defeating the purpose of approximate search entirely. The correct fix is scheduled full index rebuilds at defined corpus size thresholds (`1M`, `5M`, `10M` vectors) with recalculated graph parameters — not incremental appending to the same index.

**Tracing requires persistent identifiers** at every stage: source document, chunk ID, embedding version. Without them, failure mode and failure source are indistinguishable.

## What to enforce: four rules

1. **Think about how to process structured data before embedding it**. Raw JSON, tables, and knowledge graph nodes all carry meaning that standard tokenizers will fragment; converting structured objects into natural language representations preserves that meaning at the cost of a one-time ingestion step
2. **Define metadata schema before indexing, not after**. Temporal attributes, scope fields, and authority constraints cannot be retrofitted without full re-ingestion
3. **Test HyPE for production**. Paying the enrichment cost at index time avoids per-query latency overhead; reserve query-time expansion for cases where corpus terminology is genuinely unstable
4. **Rebuild HNSW indexes, do not append indefinitely**. Schedule full rebuilds at defined corpus size thresholds with recalculated graph parameters

---

<p align="center">
<i>Decisions made at ingestion time set the ceiling for everything downstream. Retrieval cannot recover information that chunking destroyed, and generation cannot recover context that retrieval missed.</i>
</p>
