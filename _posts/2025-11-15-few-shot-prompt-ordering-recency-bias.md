---
layout: default
title: "Few-shot prompt ordering: the impact of example position"
description: 'Investigating positional bias in few-shot prompting. While "Lost in the Middle" suggests boundary importance, the specific ordering of examples remains an important factor for performance stability.'
date: 2025-11-15 00:00:00 +0000
---

Few-shot prompting is a standard technique in NLP engineering. While we frequently discuss selection strategies (choosing **which** examples to use), the **ordering** of these examples often receives less attention. We typically default to random ordering or static lists. However, given the known positional biases in **LLMs**, it makes sense to treat example ordering as an optimization variable rather than a constant.

### The mechanism: primacy, recency, and the U-curve

The assumption that models process all context equally is often incorrect. Research into attention mechanisms reveals a **U-shaped performance curve** (often referred to as the "Lost in the Middle" phenomenon). Although newer long-context architectures are mitigating this issue, information at the boundaries (beginning and end) is still typically prioritized over the middle.

The direction of the bias depends on the architecture:

- **Primacy Bias**: Causal masking creates an inherent preference for early tokens. Larger, more capable models often favor the first examples presented
- **Recency Bias**: Mechanisms like Rotary Positional Embeddings (RoPE) and attention weight decay can cause the model to favor the most recent tokens. This is often more pronounced in smaller models or when the semantic quality of options is low

### Experiment: the best-last strategy

For context-dependent tasks, such as intent classification or complex reasoning, we can test the hypothesis that maximizing recency helps the model.

Instead of random placement, we can order examples by **semantic similarity**. The logic is to place the examples most similar to the current query closest to the generation point (the end of the prompt).

```python
from sklearn.metrics.pairwise import cosine_similarity

def order_examples_best_last(query_embedding, example_embeddings, examples):
    """
    Sorts examples by similarity to the query in ascending order.
    The most relevant example appears last (closest to generation).
    """
    similarities = cosine_similarity(
        [query_embedding],
        example_embeddings
    )[0]

    # Sort ascending: least similar first, most similar last
    sorted_indices = similarities.argsort()
    return [examples[i] for i in sorted_indices]

# Usage
ordered = order_examples_best_last(
    query_emb,
    few_shot_embs,
    few_shot_examples
)
prompt = f"{instruction}\n" + "\n".join(ordered) + f"\n{query}"
```

### Observations and impact

Research on intent recognition datasets shows this "best last" strategy **increased** accuracy by **0.2–1.7%**.

It is important to note two constraints:

1. **Semantic Variance**: The effect correlates with variance; if all examples are equidistant from the query, ordering impact diminishes
2. **Model Size**: As noted in the mechanism section, larger models might benefit from a "best first" strategy due to primacy bias

For tasks with limited context, this difference seems marginal. However, in production environments, prompt ordering is a zero-cost hyperparameter. It requires no model fine-tuning and no additional inference latency.

### Broader application

This principle extends beyond classification. Instruction-tuned models can flip preferences based solely on the order of presentation. This positional bias is particularly evident at higher temperatures ($T=1$), where adherence to ambiguous instructions can fluctuate.

### Conclusion

Positional bias is an architectural reality. It is not necessarily a bug to be fixed, but a behavior to be characterized.

If you observe inconsistent performance in your few-shot tasks, don't assume the model attends equally to all examples. Verify the distribution of your examples. If you feel that the model ignores your instructions, check the order — your best examples might be lost in the middle.
