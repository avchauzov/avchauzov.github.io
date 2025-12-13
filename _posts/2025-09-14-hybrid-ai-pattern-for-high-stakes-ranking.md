---
layout: default
title: "Our Agents Argued Endlessly. Here's How a Hybrid AI Pattern Tamed LLM Chaos"
description: "A deep dive into building a medical ranking PoC where pure LLM reasoning failed, and how a hybrid pattern combining LLM feature extraction with a deterministic rule engine achieved stable, auditable results."
date: 2025-09-14 00:00:00 +0000
---

Building multi-agent systems for high-stakes domains has taught me a crucial lesson: autonomy is a double-edged sword. While LLM-powered agents excel at understanding complex data, their non-deterministic nature can lead to chaos when predictable outcomes are non-negotiable. This is the story of a Proof-of-Concept where our agents got stuck in endless debate, and how we solved it not by making the agents "smarter," but by implementing a robust, hybrid AI pattern.

## Why Medical Ranking is a High-Stakes Game

The goal of our PoC was to rank medical drugs based on a variety of data sources. In a domain like medicine, the stakes are incredibly high. An unstable ranking that changes with each run is not just an inconvenience; it's a critical failure. A system that produces a "plausible-sounding but wrong" order of recommendations could have serious consequences. Therefore, our primary success criteria were not just accuracy, but also **stability, auditability, and predictability**. The final output had to be deterministic and its logic easily traceable.

## The Architecture: A Structured Multi-Agent Workflow

Our initial architecture was a modular graph built with **LangGraph**. It was not a simple hierarchy, but a structured workflow designed for clarity and control:

1. A **Reviewer Agent** would receive the initial query (e.g., "Find treatments for Type 2 Diabetes").
2. It would then dispatch tasks to multiple, specialized **Model Context Protocol (MCP) Agents**. Each of these agents was responsible for a specific data source, using the **MCP** to access medical knowledge bases, clinical trial results, and FDA databases — not for inter-agent communication.
3. Finally, a **Summarizer Agent** would collect the structured outputs from all MCP agents to synthesize and rank the final list.

The orchestration was handled by **LangGraph**; the problem emerged within the logical "brain" of the Summarizer.

## The Anatomy of a Loop: When Pure Reasoning Fails

Our first implementation gave the Summarizer agent autonomy to reason about the collected data and determine the best ranking. The result was a catastrophic failure. The agents were effectively **arguing in circles**, trapped in an endless debate with no resolution.

In initial tests, the reasoning-first agent often **exceeded 50+ iterations without converging**, cycling through similar top candidates. The financial cost was staggering:

- **~50 iterations** × 4 agents × ~1,000 tokens/call = **~200,000 tokens**
- Using a cost-effective LLM (at ~\$0.001 per 1k mixed tokens), this cost **~$0.20** per query for a result that was fundamentally unusable.

To combat this, we had to add explicit loop detection mechanisms — a clear sign that our core approach was flawed.

```python
# Early stopping mechanisms to prevent infinite loops
if current_ranking in ranking_history:
    logger.info("EARLY STOPPING: Exact ranking repetition detected")
    break

# Check for minimal changes (similarity > 95%)
if ranking_history:
    similarity = difflib.SequenceMatcher(
        None, str(previous_ranking), str(current_ranking)
    ).ratio()
    if similarity > 0.95:
        logger.info("EARLY STOPPING: Changes below threshold")
        break
```

## A Hybrid Solution: Combining LLM Perception with Formulaic Judgment

The breakthrough came when we redefined the agents' roles. Instead of having one agent handle both understanding and judgment, we split the responsibilities — a classic hybrid AI pattern.

- **LLM for Perception & Feature Extraction**: The MCP agents' primary role became extracting specific, structured attributes from unstructured text. They were no longer asked "what's important?" but rather "find the value for this specific field."
- **Deterministic Engine for Judgment & Ranking**: The Summarizer was stripped of its reasoning capabilities and rebuilt as a deterministic engine that applied a formulaic, weighted-scoring model to the structured data provided by the other agents.

We replaced simplistic criteria with medically relevant, quantifiable metrics:

- **Approval Status**: FDA Approved = 100, Phase 3 Trials = 50, Pre-clinical = 10.
- **Evidence Level**: Based on the GRADE framework. Level A (High) = 100, Level B (Moderate) = 70, Level C (Low) = 30.
- **Contraindication Score**: A risk factor where lower is better. We inverted it for scoring: (1 - num_critical_contraindications / 10) \* 100.

The core of the new Summarizer was a clear, auditable function. A key part of its robustness was handling missing data gracefully with default values.

```python
def calculate_drug_score(drug_profile: dict, weights: dict) -> float:
    """
    Calculates a deterministic score based on structured, pre-extracted features.
    """
    # Using .get() with default values handles edge cases and prevents errors
    approval_score = drug_profile.get("approval_status_score", 0)
    evidence_score = drug_profile.get("evidence_level_score", 0)
    contraindication_score = drug_profile.get("contraindication_score", 50)

    # The weighted scoring formula provides an auditable ranking logic
    weighted_score = (
        approval_score * weights.get("approval", 1.5) +
        evidence_score * weights.get("evidence", 1.0) +
        contraindication_score * weights.get("safety", 1.2)
    )
    return weighted_score
```

This new approach was remarkably effective. The system achieved a stable ranking in just 4 iterations. The stability and correctness were validated against a golden dataset of drug rankings. This also had a dramatic impact on cost:

- **~4 iterations** × 4 agents × ~1,000 tokens/call = **~16,000 tokens**
- This cost **~$0.016 per query**, representing a **92% cost savings** while delivering a superior, reliable result.

## Enterprise Implications: A Pattern for Trustworthy AI

This isn't just a story about one PoC; it's about a scalable pattern for building trustworthy AI systems in the enterprise. This hybrid approach is directly applicable to other high-stakes domains:

- **Finance**: For credit scoring or fraud detection, where an LLM can parse transaction notes for features, but a deterministic model must make the final risk assessment.
- **Legal Tech**: For ranking documents by relevance in e-discovery, where an LLM can summarize documents, but a rule-based engine ranks them based on specific legal criteria.
- **Industrial Safety**: For analyzing sensor data, where an LLM might interpret anomalous text-based alerts, but a state machine or rule engine must decide whether to trigger a shutdown.

The pattern allows businesses to leverage the power of LLMs for what they do best — understanding unstructured data — while cordoning off the critical decision-making logic in a component that is stable, auditable, and transparent.

## The Guiding Principle for High-Stakes AI

The "reasoning vs rules" debate is a false dichotomy. The reality is that robust AI systems require a thoughtful synthesis of both. For exploratory or creative tasks, a reasoning-first approach is often ideal. But for high-stakes, enterprise-grade applications demanding stability and auditability, the path to success is clear: start with a deterministic, formulaic framework. Grant autonomy and reasoning capabilities incrementally, always within the guardrails of a system you can trust and explain.

---

<p align="center">
<i>For systems where trust is paramount, use LLMs for perception, not judgment. Allow them to fill the spreadsheet, but let a deterministic engine do the math.</i>
</p>
