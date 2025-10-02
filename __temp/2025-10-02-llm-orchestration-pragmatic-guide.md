---
layout: full-width title: "LLM Orchestration: A Pragmatic Guide to Complexity"
description: "Most production apps are simple chains, yet everyone is building agents. Here’s a clear framework on when you really need loops, graphs, and agents in your LLM app."
date: 2025-10-02 00:00:00 +0000
---

The hype around "agents" often overshadows a simple truth: **over 95% of production LLM apps are simple Chains or Routers**. Many developers are building complex, token-burning state machines for tasks that don't require them.

This is a pragmatic guide to choosing the right orchestration pattern.

### The Spectrum of Complexity

- **Chain**: A fixed `A → B → C` flow. The simplest way to link LLM calls or functions.
- **Router**: An `if/else` gateway. A conditional step that directs input to the appropriate Chain or tool.
- **Graph**: A stateful workflow with loops. Nodes are steps (LLM calls, tools) and edges are the paths between them, allowing for cycles and retries.
- **Agent**: The "brain" or reasoning strategy (e.g., ReAct) that decides what to do next. It is often **implemented using a graph structure** to manage its execution.

### A Pragmatic Decision Framework

#### Use a **Chain** when:

- The workflow is **linear and predictable**.
- **Example**: Retrieve documents → Generate an answer → Format the output.

#### Use a **Router** when:

- You need to handle **diverse requests** or **optimize costs**.
- **Example**: Classify a user query. Route a simple "refund policy" request to a fast, cheap model, but route a complex "enterprise API integration" query to a more capable model.

#### Use a **Graph** when:

- You need **loops and retry logic**. If a tool fails, the graph can loop back and try again with different parameters.
- You require **state management** across multiple steps of a long-running task.
- **Example**: A SQL generation loop: `Generate SQL → Execute → (On Error) Loop back to 1 with feedback | (On Success) Format and return`.

#### Use an **Agent** when:

- You **cannot predict the sequence of steps in advance**. The task is open-ended and requires dynamic planning.
- The LLM needs to **decide which tools to call and in what order** based on intermediate results.
- **Example**: A research agent that iteratively searches Google, reads web pages, synthesizes findings, and decides on its next search query.

### The Real Cost of Complexity

More complexity means higher operational costs. The trade-offs are clear:

| Pattern                         | Latency       | Cost Profile                                       | Debugging |
| ------------------------------- | ------------- | -------------------------------------------------- | --------- |
| **Chain**                       | Low           | Baseline                                           | Easy      |
| **Router**                      | Low           | -85% (in some cases, by routing to cheaper models) | Easy      |
| **Graph**                       | Moderate-High | +Linear                                            | Hard      |
| **Agent / Multi-Agent Systems** | High (50s+)   | **3.7x+**                                          | Very Hard |

### The Pragmatic Migration Path

Don't start with complexity. Evolve based on need.

1.  **Always start with a Chain.** It’s simple, cheap, and easy to debug.
2.  Add a **Router** when you notice cost or quality anomalies for certain requests that could be handled by different models.
3.  Move to a **Graph** only when your Chain or Router frequently fails on edge cases that require **retries or validation loops**.
4.  Use an **Agent** only when the task is truly unpredictable.

**A simple test**: If you can write all the logic in `if/else` and `for` loops, you need a Graph _at most_. If even the _sequence of steps_ is unpredictable, only then reach for an Agent.

<p align="center"\>
<i>Don't add an agent because it's trendy. Add one because your Chain, Router, Graph failed, repeatedly.</i>
</p>
