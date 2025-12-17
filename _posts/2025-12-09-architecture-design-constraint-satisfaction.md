---
layout: default
title: "Architecture design: a constraint-satisfaction approach"
description: "Methodology for reducing the architectural search space through hierarchical constraint definition: Problem, Boundaries, and Trade-offs."
date: 2025-12-09 00:00:00 +0000
---

Engineers select technologies before defining constraints, but this inverts the design process. The result is predictable: systems that cannot be built within budget, systems the team cannot maintain, or systems that solve the wrong problem.

Architecture is not tool selection - it is constraint satisfaction. The solution space starts infinite and the architect reduces this space to 3–5 viable options through three layers of filtration. Each layer eliminates categories of solutions. Layer 1 defines what success means. Layer 2 eliminates what is impossible. Layer 3 clarifies what must be sacrificed.

### Layer 1: define the objective function

Define the system's objective function before any design. Without these definitions, technical validation is impossible.

**1. The criticality assessment**

Identify the specific negative outcome of _not_ having the system. If the impact cannot be quantified, the architecture cannot be justified. If the system is not critical, the optimal architecture is "do nothing."

- **Incorrect**: "We need to modernize the technology stack." (This is a tautology).
- **Correct**: "The current transaction drop-off rate is 15% due to latency. This results in a projected revenue loss of $X per annum."

**2. Quantifiable success metrics**

Qualitative descriptions ("high performance," "scalable") are not engineering requirements. Define metrics as strictly numerical.

- **Abstract**: "Real-time processing"
- **Concrete**: "Maximum allowable latency of 500ms for the 95th percentile (p95) of requests"

**3. Stakeholder identification**

Different stakeholders maximize different variables. This creates conflicting optimization goals and hidden veto points.

- **End users**: Maximize utility, minimize latency.
- **Engineering team**: Maximize maintainability, minimize operational complexity.
- **Business entity**: Minimize risk, maximize ROI.

### Layer 2: hard boundary constraints

These constraints are binary: if a solution does not meet these criteria, it is invalid, regardless of its other technical merits.

**1. Regulatory and compliance constraints**

Legal frameworks eliminate non-compliant regions immediately.

- **GDPR**: Mandates that data for citizens of the EU must reside within the EU.
- **HIPAA**: Mandates strict encryption standards, access controls, and audit logs for healthcare data.

**2. Economic constraints (Capital Expenditure and Operational Expenditure)**

Budget constraints exclude infrastructure classes (Enterprise Oracle vs PostgreSQL).

- **CAPEX (Capital Expenditure)**: The upfront cost to build the infrastructure.
- **OPEX (Operational Expenditure)**: The recurring cost to maintain the system over time.

If the budget for OPEX is low, managed services are excluded. Use simpler VPS hosting or serverless architectures.

**3. Organizational and human resource constraints**

Architecture must match team capabilities. Exotic technologies impose a "skill tax" that blocks maintenance.

- **Competency matrix**: If the team specializes in Python, introducing a Rust-based microservices architecture creates a "knowledge debt" that increases delivery time.
- **Team size**: A distributed system requires a minimum number of engineers for on-call rotation. A smaller team cannot support complex distributed topology.

**4. Load and scalability constraints**

Scale determines topology. Low load (< 100 RPS — requests per second) fits monolith. High load (> 10,000 RPS) requires sharding.

Designing for high load when the current requirement is low violates You Aren't Gonna Need It (YAGNI). This principle states: do not build functionality until it is actually needed. Premature optimization wastes resources and increases complexity.

### Layer 3: trade-off analysis (soft constraints)

After eliminating impossible solutions, the remaining options require trade-off analysis. No system can optimize all variables simultaneously.

**1. Latency vs consistency**

CAP theorem (Consistency, Availability, Partition tolerance): Network partitions force a choice between Consistency and Availability.

- **Strong consistency (ACID — Atomicity, Consistency, Isolation, Durability)**: Required for financial ledgers. Increases latency because nodes must coordinate.
- **Eventual consistency**: Acceptable for social feeds or analytics. Decreases latency as nodes accept writes independently.

**2. Complexity vs velocity**

This determines the choice between monolith and microservices.

- **Microservices**: High operational complexity, allows independent deployment (high velocity for large teams).
- **Monolith**: Low operational complexity, coupled deployment (high velocity for small teams).

For small teams, distributed system overhead (tracing, service mesh) outweighs decoupling benefits.

**3. Cost vs data freshness**

Processing cost scales inversely with latency tolerance. Real-time is 10–30× more expensive than batch.

- **Real-time stream processing**: High infrastructure cost; minimal delay.
- **Batch processing**: Low infrastructure cost; delay of minutes or hours.

If the business accepts 1-hour delay, streaming architecture wastes budget.

### Output: the reduced solution space

This methodology moves from an abstract desire to a concrete engineering specification.

- **Layer 1** provides the target metrics (e.g., p95 < 200ms).
- **Layer 2** provides the boundaries (e.g., Must use EU region, Budget < $X, Team knows Python).
- **Layer 3** defines the acceptable sacrifices (e.g., We accept eventual consistency to save cost).

Consequently, the infinite solution space collapses to a finite set of viable architectures (e.g., "Monolithic Python application with PostgreSQL (EU region) and read replicas").

Only after this stage is the creation of an architectural diagram justified.
