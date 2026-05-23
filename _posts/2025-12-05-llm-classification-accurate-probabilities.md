---
layout: default
title: "Classification with LLMs: getting accurate probabilities from structured output"
description: "Verbalized confidence in JSON schema provides fast probability estimates for classification tasks. Optimization patterns improve calibration."
date: 2025-12-05 00:00:00 +0000
---

Classification tasks (binary or multiclass) require both category and probability. Standard structured output approaches (Instructor, `json_mode`) return the category reliably, but confidence scores are often miscalibrated. Post-RLHF models are systematically overconfident, frequently clustering predictions at 0.85, 0.90, or 0.95 even when actual accuracy is lower.

### Base approach: verbalized confidence

The basic method is adding a `confidence_score: float` field to the Pydantic schema. This forces the model to self-assess probability during generation.

```python
from pydantic import BaseModel, Field

class Classification(BaseModel):
    reasoning: str  # Must come before category
    category: str
    confidence_score: float = Field(ge=0.0, le=1.0)

```

**Constraints and limitations**:

- Field ordering matters because of autoregressive generation dynamics. `reasoning` must precede `category` — if reasoning comes after, it cannot influence the classification decision because the token has already been sampled
- Raw scores are uncalibrated. They function well for relative ranking but fail as absolute probabilities. Production thresholds require post-hoc calibration

### Pattern: Post-processing calibration

Two main post-processing approaches can help to calibrate these outputs:

- **Temperature Scaling**: Learns a single parameter T that rescales confidence scores. Train T to minimize calibration error on validation set (<1000 samples sufficient). Simpler and faster, but assumes uniform miscalibration across all confidence ranges

- **Isotonic Regression**: Learns a non-decreasing mapping function from raw scores to calibrated probabilities. Handles complex patterns where the model is overconfident at some ranges (e.g., 0.8–0.9) but underconfident at others (e.g., 0.4–0.6). Requires more validation data (>1000 samples)

Use Temperature Scaling first. Switch to Isotonic only if **Expected Calibration Error (ECE)** remains high.

### Pattern: null category and safe harbor

Sometimes, adding classes like `"unknown"` or `"other"` to the classification enum works well. Without an escape hatch, constrained decoding forces the model to hallucinate the "least-bad" option to satisfy the schema.

Be **cautious** though — models often over-utilize the "unknown" bucket for ambiguous inputs to minimize theoretical error (laziness). The prompt must explicitly instruct the model to prioritize specific categories and use "unknown" only when evidence is strictly insufficient.

Example instruction:

```text
"Classify into one of: positive, negative, neutral, unknown.
Use 'unknown' ONLY if the text contains no sentiment indicators.
Ambiguous or mixed sentiment should still be classified as neutral."
```

### Pattern: two-stage generation

Strict `json_mode` acts as a muzzle. If the input is **Out-of-Distribution**, constrained decoding forces a hallucinated valid schema instead of a refusal.

Generate free-form text first, parse second. Libraries like Instructor (which supports multiple output modes including markdown+json) or BAML allow mixed-content responses. The model first outputs a natural language refusal or reasoning ("I cannot classify this image because..."), followed by the JSON block. The parser discards the text preamble and extracts only the valid JSON.

### Pattern: inference strategies

Trading compute and latency for higher accuracy is necessary for borderline cases.

- **Sampling Consistency**: Generate `k=5` responses at `temperature > 0.7`. The agreement rate becomes the confidence score. Cost increases `k`×, but this is the most reliable method for hallucination detection
- **Adaptive early stopping**: Generate samples sequentially (not in parallel). Stop when first 3 consecutive samples agree. If after 10 samples no consensus, return majority vote. This reduces average cost by 25–50% while maintaining accuracy for high-confidence cases
- **Sequential Refinement**: Instead of `k` parallel samples, use iterative improvement. The model critiques and corrects its previous attempt. This is more token-efficient than parallel sampling for similar accuracy gains

### Pattern: proxy scoring

Proprietary APIs often withhold logprobs which can be useful as a probability proxy.

Perform classification with the proprietary model. Then use a small open-source model to score that prediction. Since we have direct access to open-source model weights, we can evaluate the probability of the exact predicted answer.

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

def score_answer_probability(
    input_text: str,
    predicted_answer: str,
    scoring_model_name: str = "your-scoring-model"  # Replace with your model
) -> float:
    """
    Score probability that small model assigns to predicted_answer.
    Evaluates only answer tokens, not the full prompt.
    Returns: per-token geometric mean probability (length-normalized).
    """
    model = AutoModelForCausalLM.from_pretrained(scoring_model_name, device_map="auto")
    tokenizer = AutoTokenizer.from_pretrained(scoring_model_name)

    # Separate prompt and answer
    prompt = f"Classify: {input_text}\nAnswer:"
    prompt_ids = tokenizer.encode(prompt, return_tensors="pt").to(model.device)

    # Add leading space for correct tokenization
    ans = " " + predicted_answer if not predicted_answer.startswith(" ") else predicted_answer
    answer_ids = tokenizer.encode(ans, add_special_tokens=False)

    # Concatenation
    answer_tensor = torch.tensor(answer_ids, device=model.device).unsqueeze(0)
    full_ids = torch.cat([prompt_ids, answer_tensor], dim=1)

    with torch.no_grad():
        outputs = model(full_ids)
        logits = outputs.logits

    # Score only answer tokens
    prompt_len = prompt_ids.shape[1]
    answer_logprobs = []

    for i, token_id in enumerate(answer_ids):
        position = prompt_len + i - 1  # Causal shift
        token_logits = logits[0, position]
        probs = torch.softmax(token_logits, dim=-1)
        answer_logprobs.append(torch.log(probs[token_id]).item())

    # Return geometric mean (per-token score, comparable across answer lengths)
    return np.exp(np.mean(answer_logprobs))

# Usage
big_model_prediction = "positive"  # From proprietary model
proxy_confidence = score_answer_probability(input_text, big_model_prediction)
```

**Note**: Proxy score quality depends on prompt format matching. For production, use the same classification prompt structure for both models.

### Pattern: architecture and fallback

System-level decisions often outweigh the previous methods.

**Classical ML Fallback**: For routine classification with labeled data, BERT-like classifiers provide superior calibration (**ECE** < 10%) at 10× lower cost.

LLM classification is justified primarily when training data is unavailable or categories change frequently.

### Implementation priority

1. **Baseline**: Start with verbalized confidence + reasoning field + Null Category
2. **Calibration**:

   - Start with **Temperature Scaling** and measure **ECE** on validation set
   - If **ECE** > 0.1 after Temperature Scaling and you have >1000 samples, try **Isotonic Regression**
   - For binary classification specifically, **Platt Scaling** is an alternative to Isotonic

3. **High-Stakes**: For accuracy-critical paths, combine multiple patterns:
   - Use **Sampling Consistency** for hallucination detection
   - Use **Two-stage Generation** if **Out-of-Distribution** inputs are expected
   - Accept higher latency/cost as risk mitigation

Effective production classifiers use a hybrid approach: verbalized confidence for fast filtering, and sampling for borderline cases where the initial calibrated score falls in the uncertainty range (0.4–0.6).
