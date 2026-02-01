---
layout: default
title: "Embeddings for intent classification: architecture trade-offs"
description: "Practical guide to building intent classifiers with embeddings. When shallow classifiers beat fine-tuning, how to handle confidence thresholds, and what actually matters in production."
date: 2026-01-04 00:00:00 +0000
---

Intent classification in chatbots is not just an ML task. It is a routing layer that determines resource consumption of the entire system. Wrong architecture forces expensive LLM calls for trivial queries, burning budget and increasing latency.

Previously, we discussed how fine-tuned BERT can be a better alternative to the LLM-based classification. Now, let's consider an even simpler solution: embeddings + shallow classifier — when it works, when it fails, and whether you need to fine-tune the encoder.

## The canonical architecture

The pattern splits inference into two stages:

1. **Feature extraction**: Frozen encoder (MiniLM, E5, BGE, or similar) converts text to dense vector. Single forward pass, shared across all downstream tasks
2. **Classification head**: Lightweight model (Logistic Regression, Linear SVM) operates on the vector. Inference is matrix multiplication — microseconds on CPU

### Why this often wins over fine-tuned BERT

Real-world benchmarks (Banking77, CLINC150) show the trade-offs:

---

| Metric               | Embeddings + LR     | Fine-tuned BERT         |
| -------------------- | ------------------- | ----------------------- |
| Accuracy             | 92–93%              | 93–95%                  |
| Latency (CPU)        | 4–20ms              | 50–300ms                |
| Training time        | Seconds             | Hours                   |
| Multi-tenant scaling | One encoder for all | Separate model per task |

---

The accuracy gap is 1–3%. The latency gap is 5–15x. For most production cases, this trade-off favors embeddings.

The core limitation: frozen encoder cannot adapt to domain-specific vocabulary. If terminology differs significantly from pretraining corpus, semantically different intents may map to similar regions in embedding space.

Once the architecture is set, embedding quality becomes the main variable.

## Embedding dimensionality

Default 768 dimensions are often excessive for intent routing. Dimensionality directly impacts memory (index size scales linearly) and latency (scoring is O(d) per candidate).

Practical approaches to reduction:

---

| Method                  | Description                    | Typical quality loss         |
| ----------------------- | ------------------------------ | ---------------------------- |
| PCA post-processing     | Reduce 768→256 on your dataset | <1% (often)                  |
| Matryoshka (MRL) models | Truncate vector at inference   | Depends on cutoff            |
| Binary quantization     | 1 bit per dimension            | 2–5%, but 32x memory savings |

---

Run ablation before accepting d=768 as given. For routing tasks, 256 dimensions are often sufficient.

## Shallow classifier selection

In practice, two linear models dominate:

**Logistic Regression**

Default choice. Outputs calibrated probabilities — critical for confidence-based routing. Inference is dot product. Works well when embedding space is linearly separable (which it usually is with modern encoders).

**Linear SVM**

Better generalization on small or noisy data (<50 samples per class). Margin-based optimization is less sensitive to outliers. Downside: no native probability output — requires calibration wrapper.

```python
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.svm import LinearSVC

# Default choice
clf = LogisticRegression(max_iter=1000, C=1.0)

# For small/noisy data — SVM with calibration
clf = CalibratedClassifierCV(
    LinearSVC(C=1.0, max_iter=10000),
    method='sigmoid'
)
```

Non-linear models (Random Forest, deep MLP) typically do not improve over linear ones. The representation is already separable — added complexity increases latency without accuracy gain.

## Training data strategies

**Real labeled data**: High accuracy on frequent queries, expensive to collect, poor coverage of rare cases.

**Synthetic data (LLM-generated)**: Fast to scale, but risks distribution shift and style bias. Critical point: generate hard negatives — queries that share keywords with an intent but have different meaning.

**Hybrid approach**: Real data for frequent queries ("head"), synthetic for rare cases ("tail"). Apply round-trip filtering: generate example → classify with stronger model → discard if mismatch.

Hard negatives matter more than volume. Example: query "What documents are NOT needed for mortgage?" should not match intent "Mortgage document list". Adding such near-miss examples to training improves Out-of-Scope (OOS) detection — AUROC can jump from 0.91 to 0.98.

## Confidence and routing

Logistic Regression outputs calibrated probabilities by design. The practical challenge is not calibration — it is setting thresholds.

### Per-class thresholds

Global threshold (e.g., 0.7 for all intents) fails when intents have different cluster densities in embedding space. Narrow intent like "password reset" needs higher threshold (0.9) than broad intent like "general complaint" (0.6).

Automatic threshold formula: `T_i = max(0.5, μ_i - α·σ_i)` where μ and σ are mean and standard deviation of confidence scores on validation set for intent i.

### Tiered routing

Do not make routing binary. Three zones work better:

---

| Confidence         | Action                                    |
| ------------------ | ----------------------------------------- |
| > τ_high           | Deterministic response or API call        |
| τ_low < c ≤ τ_high | Route to LLM for verification             |
| < τ_low            | Fallback: human handoff or "I don't know" |

---

Middle zone catches uncertain cases without expensive LLM calls for obvious ones. This reduces average cost by 40–60% compared to routing everything through LLM.

### Out-of-scope detection

Out-of-Scope queries (user asks something outside known intents) are tricky. Classifier will still output some class with non-trivial confidence.

Options:

- Train explicit OOS class using samples from open-domain datasets
- Use distance to class centroids in embedding space — large distance signals OOS
- Set conservative τ_low and route uncertain queries to fallback

## Common failure modes

Most failures are not classifier bugs, but representation limits.

**Negation blindness**

Mean pooling loses syntactic structure. "Denies chest pain" embeds similarly to "has chest pain" because dominant tokens are the same.

Mitigation: For high-stakes domains (medical, legal), add rule-based layer or LLM verification for edge cases.

**Fine-grained intent collapse**

Semantically close intents (`card_arrival` vs `card_tracking`) overlap in embedding space. Linear classifier cannot separate what encoder did not distinguish.

Mitigation: Merge into single intent with sub-classification, or fine-tune encoder with contrastive loss on hard pairs.

## Do you need to fine-tune the encoder?

Short answer: usually no. Off-the-shelf embeddings (E5, BGE, OpenAI, Cohere) handle most intent classification tasks.

### When frozen embeddings are sufficient

- Domain is close to general text (support tickets, FAQ, e-commerce)
- Intents are semantically distinct
- You have enough labeled data for the classifier head
- Accuracy on validation set meets requirements

### Signs that encoder quality is the bottleneck

- Close intents "collapse" — confusion matrix shows systematic errors between specific pairs
- Accuracy plateaus despite sufficient training data
- Domain has specialized terminology (medical codes, legal jargon, internal product names)

### Alternatives before full fine-tuning

1. **Try stronger encoder**: Switch from MiniLM to E5-large or BGE-large. Latency increases but may solve the problem

2. **Contrastive fine-tuning on hard pairs**: Lighter than full fine-tuning. Collect pairs of confused intents, train with contrastive loss. Often sufficient

3. **Add verification layer**: Keep fast classifier for 80% of queries, route confused pairs to LLM or cross-encoder for final decision

4. **LoRA/Adapters**: If you need fine-tuning but serve multiple tenants, parameter-efficient methods keep single base model with lightweight per-task modules

### When full fine-tuning is justified

- Significant domain shift (medical, legal, highly specialized)
- Classification depends on syntax (negations, conditionals)
- Sentence-pair tasks where cross-attention matters
- You have >1000 samples per class and can afford training time

Fine-tuning adapts embedding space itself — attention weights learn domain-specific patterns. But cost is real: hours of training, separate model per task, higher inference latency.

## Production considerations

For chatbot latency (<100ms end-to-end):

- Use small encoder (MiniLM, DistilBERT, TinyBERT)
- Export to ONNX, apply INT8 quantization — gives 2–5x speedup
- Add semantic cache for frequent queries — hash lookup is faster than any model

## Summary

Embeddings + shallow classifier is a strong production baseline. It scales across tenants, iterates in seconds, handles few-shot scenarios well.

The decision flow:

1. Start with off-the-shelf encoder + Logistic Regression
2. Check confusion matrix — if specific pairs collapse, try stronger encoder or contrastive tuning
3. Add tiered routing with per-class thresholds
4. Invest in hard negative generation — improves decision boundaries more than adding positive samples
5. Fine-tune encoder only if domain shift is significant and alternatives fail

Component metrics (F1, accuracy) are diagnostic tools. Optimize for business metrics: resolution rate, cost per query, fallback rate.

---

| Approach                | Latency        | Memory           | When to use                                |
| ----------------------- | -------------- | ---------------- | ------------------------------------------ |
| Frozen encoder + LR     | <20ms          | O(1)             | Default starting point                     |
| Stronger encoder + LR   | 30–50ms        | O(1)             | Close intents collapse                     |
| Contrastive fine-tuning | <20ms, 30–50ms | O(1)             | Hard pairs, moderate domain shift          |
| Full fine-tuning        | 50–300ms       | O(N) for N tasks | Significant domain shift, syntax-dependent |

---
