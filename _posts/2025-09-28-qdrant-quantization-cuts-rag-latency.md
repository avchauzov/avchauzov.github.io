---
title: "How Qdrant's scalar quantization cut our RAG latency by 3x"
description: "A deep dive into how we cut RAG retrieval latency by 3x and costs by 65% using Qdrant's scalar quantization and a hybrid storage strategy, without sacrificing search quality."
date: 2025-09-28 00:00:00 +0000
---

I was building a RAG system for an internal technical documentation search: API references, architecture guides, and troubleshooting docs. The database had around 400k chunks embedded with a large embedding model (3072 dimensions). The system worked, but it was slow and expensive. We also had plans to add more data, so we needed to push some limits.

### The bottleneck

Median retrieval latency was **~900ms**. Such high baseline latency made more advanced RAG techniques impractical, like query augmentation or **Hypothetical Document Embeddings (HyDE)**, which require multiple database lookups and would further increase response times. Infrastructure costs were high as well, considering future plans to increase system complexity (and, therefore, costs).

### What I tried first

My first approach was predictable: lower the `hnsw_ef` parameter (i.e., make the **Hierarchical Navigable Small World** algorithm perform search less thoroughly). Median latency dropped **2x**, but the **Recall@10** metric fell from **0.93 to 0.79**. For downstream generation, this was an unacceptable loss in quality, as critical chunks were missing from the context.

The second idea was to reduce vector dimensionality. Some large embedding models natively support this via the `dimensions` parameter. However, we had plans to experiment with other models and implement multi-model approaches, so we needed an **infrastructure-level solution**.

### The solution

After several iterations of parameter tuning, I looked for a different approach. While reading the Qdrant documentation, I found **scalar quantization with a hybrid storage setup**. The idea is simple: compressed, quantized vectors (converted to `int8` format) are kept in **RAM for ultrafast initial search**, while the original, full-precision vectors are kept on **disk for accurate rescoring** of the top candidates.

```python
collection_config = {
    "vectors": {
        "size": 3072,
        "distance": "Cosine",
        "on_disk": True  # Originals on SSD
    },
    "quantization_config": {
        "scalar": {
            "type": "int8",
            "quantile": 0.99,
            "always_ram": True  # Quantized vectors always in RAM
        }
    }
}

search_params = {
    "hnsw_ef": 128,  # Back to the original value
    "quantization": {
        "rescore": True,  # Enable rescoring to preserve accuracy
        "oversampling": 2.0  # Fetch 2x more candidates to compensate for quantization errors
    }
}
```

To prevent the disk from becoming a new bottleneck, I also enabled asynchronous I/O in the Qdrant configuration:

```bash
QDRANT__STORAGE__PERFORMANCE__ASYNC_SCORER=true
```

The quantized vectors sit in RAM, enabling a quick preliminary search. At this stage, Qdrant finds a group of potentially relevant documents. Then, Qdrant **asynchronously loads only the original, full-precision vectors** from the SSD for this small group of candidates and performs a final, accurate relevance calculation. This way, the expensive operations on full vectors are performed on a tiny subset of the data, having almost no impact on overall latency.

### The results

- **Median Latency**: 900ms → 300ms (3x ↓)
- **RAM usage**: 26GB → 7GB (3.7x ↓)
- **Monthly Costs ($)**: ~750 → ~260 (65% ↓)
- **Recall@10**: 0.93 → 0.91 (minor decline)

### The main takeaway

When debugging algorithm performance, we often focus on a subset of parameters while treating everything else as "good defaults". The real wins come from questioning **all assumptions at once** — algorithm, storage, memory architecture. Nothing is optimal until you prove it is.
