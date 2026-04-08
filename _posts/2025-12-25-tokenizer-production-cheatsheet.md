---
layout: default
title: "Tokenizers: production economics cheat-sheet"
description: "Compact reference for tokenizer selection, metrics, and failure modes in production LLM systems."
date: 2025-12-25 00:00:00 +0000
---

Tokenization is the exchange rate between raw text and compute: it converts text → tokens → cost, latency, and context usage. Word-level tokenization creates very large vocabularies (hundreds of thousands to over a million entries); character-level creates 5–10× longer sequences making transformer attention prohibitive. Subword tokenization balances both: frequent sequences become single tokens, rare characters decompose into bytes, controlling vocabulary size and sequence length simultaneously.

In practice, two metrics determine whether a tokenizer is production-viable:

- **TpW** (Tokens per Word) measures language efficiency:
  - Thresholds: <1.5 OK (≈1.3 baseline), 1.5–2.0 Warning, >2.0 Bad
  - Context impact: 8k window ≈ 6150 words at 1.3 TpW vs ≈ 2660 words at 3.0 TpW (56% loss)
- **CpT** (Characters per Token) measures code efficiency:
  - Thresholds: >2.0 OK, 1.25–2.0 Warning, <1.25 Bad (whitespace waste)
  - Lossless round-trip `decode(encode(text)) == text` is required for code/structured data

Production risks include whitespace boundaries, digit splitting, glitch tokens, and normalization traps.

## Algorithm comparison

Four families dominate production systems, each optimizing different constraints:

---

| Family         | Core Mechanism              | Strength                  | Weakness                                             | Primary Users                                    |
| -------------- | --------------------------- | ------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| **BPE**        | Merge frequent pairs        | Simple, fast, greedy      | Inconsistent number splitting                        | Decoder-style LMs, RoBERTa-style encoders        |
| **WordPiece**  | Merge by information gain   | Better morpheme alignment | Mostly legacy                                        | Encoder-only transformers (BERT-style)           |
| **Unigram**    | Start large, prune by loss  | Supports regularization   | Slower training (EM algorithm)                       | Encoder–decoder seq2seq, multilingual seq2seq    |
| **Byte-level** | Base vocabulary = 256 bytes | Zero unknown tokens       | Can inflate token count by several× for some scripts | Frontier chat models, large open-weight chat LMs |

---

**Critical implementation details**:

- **Pre-tokenization boundaries matter**: Regex rules prevent cross-category merges. Without strict boundaries, the algorithm tokenizes `123` as one token but splits `1234` into `12 + 34`, breaking arithmetic consistency
- **Byte-level fallback**: Byte fallback guarantees coverage; tokenization cost differs across languages

## Tokenizer selection decision matrix

Match tokenizer architecture to workload characteristics:

---

| Use Case                     | Recommended Tokenizer     | Vocabulary Size | Rationale                                              |
| ---------------------------- | ------------------------- | --------------- | ------------------------------------------------------ |
| **English-only (RAG, chat)** | Standard BPE              | 32k–50k         | Compact embeddings, max speed                          |
| **Multilingual (CJK heavy)** | Large vocab BPE/Unigram   | 100k–200k       | Avoids character-level fallback, reduces TpW           |
| **Code generation**          | Whitespace-aware BPE      | 50k–80k         | Preserves indentation structure, lossless round-trip   |
| **Domain-specific**          | Extend existing tokenizer | +5k–10k terms   | Add medical/legal jargon to prevent over-fragmentation |

---

**Rules of thumb**:

- If TpW doubles vs baseline, treat it as an infrastructure issue — API cost doubles, context halves
- Vocabulary scaling: ~60k vocab is optimal for 7B models, while ~200k is justified for ~70B models. Beyond ~200k vocabulary, embedding memory and serving cost grow linearly, while compression gains become marginal (<5%). Rare tokens (<0.0001% frequency) remain under-trained even in large vocabularies

## Production failure modes

### 1. Whitespace boundary mismatch

**Symptom**: Model generates awkwardly or fails to continue prompts correctly.

**Cause**: Tokenizers distinguish `"word"` and `" word"` as different tokens. If a prompt ends with a space, the model expects the next token to merge with that space. But tokenization already split them — breaking continuation patterns learned during training.

**Mitigation**: Token Healing (re-tokenize boundary) or template hygiene (avoid trailing spaces, use explicit markers).

### 2. Inconsistent digit splitting

**Symptom**: Degraded performance on structured identifiers (IDs, SKUs, timestamps).

**Cause**: BPE tokenizes `710` as one token, `711` as two (`7`, `11`); digit boundaries are unpredictable, breaking place-value consistency.

**Mitigation**: Digit isolation (pre-tokenization regex) or right-to-left tokenization, which can substantially improve multi-digit reasoning.

### 3. Glitch tokens (under-trained embeddings)

**Symptom**: Specific strings cause hallucinations, refusals, or infinite loops.

**Cause**: Token exists in vocabulary but was filtered from model's training corpus; embedding remains near random initialization. These tokens can be detected via embedding-weight signals and tokenizer configuration audits.

**Mitigation**: Audit token frequency (<100 occurrences in 1GB corpus are risky), normalize inputs to canonical forms.

Detect glitch token candidates:

```python
# Detect glitch token candidates
from collections import Counter
token_freq = Counter(tokenizer.encode(large_corpus))
rare_tokens = [tid for tid in range(vocab_size) if token_freq.get(tid, 0) < 100]
```

### 4. Unicode normalization traps

**Symptom**: Visually identical text produces different outputs; safety filters bypassed.

**Cause**: Homoglyphs (Cyrillic `а` vs Latin `a`) tokenize differently despite visual identity; used for prompt injection.

**Mitigation**: Apply NFKC normalization before tokenization (trade-off: may alter legitimate rare Unicode)

Apply normalization:

```python
import unicodedata
normalized = unicodedata.normalize('NFKC', user_input)
```

## Minimal benchmark recipe

Test compression efficiency across representative data types:

```python
import tiktoken

# Replace with your encoding (e.g. cl100k_base for OpenAI)
encoding_name = "your-encoding"
enc = tiktoken.get_encoding(encoding_name)

samples = {
    "english": "The quick brown fox jumps over the lazy dog.",
    "russian": "Быстрая коричневая лиса перепрыгивает через ленивую собаку.",
    "chinese": "敏捷的棕色狐狸跳过懒狗。",
    "japanese": "素早い茶色の狐が怠けた犬を飛び越える。",
    "code": "def process(data):\n    return [x for x in data]",
    "json": '{"status": "active", "count": 42}',
    "logs": "[2024-01-15 10:23:45] ERROR: Connection timeout"
}

for label, text in samples.items():
    tokens = len(enc.encode(text))
    words = len(text.split())
    chars = len(text)
    tpw = tokens / words if words > 0 else 0
    cpt = chars / tokens if tokens > 0 else 0
    print(f"{label:8} {tokens:3} tok  {tpw:.2f} TpW  {cpt:.2f} CpT")
```

**Expected ranges**:

---

| Category | TpW     | CpT     |
| -------- | ------- | ------- |
| English  | 1.2–1.4 | 3.3–4.0 |
| Russian  | 1.4–1.8 | 2.5–3.3 |
| Chinese  | —       | 1.4–2.0 |
| Japanese | —       | 1.4–2.0 |
| Code     | 1.5–2.0 | 1.7–2.5 |

---

## When to train custom tokenizer

**Do train custom** when:

- Target language TpW > 2.5 with standard tokenizers (TpW can drop substantially with custom tokenizer depending on corpus and vocab size)
- Domain-specific corpus >100MB with high OOV rate (medical terms, legal jargon)

**Vocabulary extension pattern** (for fine-tuning):

When extending vocabulary for domain-specific terms, initialize new embeddings as averages of constituent tokens:

```python
new_tokens = ["cytokine", "interleukin", "CD4+"]
tokenizer.add_tokens(new_tokens)
model.resize_token_embeddings(len(tokenizer))

# Initialize as average of constituent tokens (converges 5–10× faster)
for token in new_tokens:
    token_id = tokenizer.convert_tokens_to_ids(token)
    original_ids = tokenizer.encode(token, add_special_tokens=False)
    model.embeddings.weight[token_id] = model.embeddings.weight[original_ids].mean(dim=0)
```

---

<p align="center">
<i>Tokenization determines the exchange rate between human text and computational resources. Efficient tokenizers reduce API costs 2–5× and preserve context capacity.</i>
</p>
