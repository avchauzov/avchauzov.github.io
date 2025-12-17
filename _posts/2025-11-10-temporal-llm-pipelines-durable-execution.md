---
layout: default
title: "Temporal for LLM pipelines: durable execution starter pack"
description: "LLM agents often crash, losing state and expensive API work. Temporal provides durable execution for LLM pipelines: automatic state recovery, configurable retries, and long-running orchestration at the cost of determinism constraints and ops overhead."
date: 2025-11-10 00:00:00 +0000
---

LLM pipelines are fragile, often crashing mid-process from API timeouts, rate limiting, or worker evictions. When a worker restarts, its state is gone, forcing potentially expensive re-runs that burn tokens on already completed work. Traditional orchestration tools like Airflow or Prefect get applied here, but they are mostly designed for batch ETL and don't handle state well for multi-hour agent loops.

Temporal solves this with **Durable Execution**. This is a programming model that:

- Lets processes resume exactly where they failed.
- Avoids re-executing expensive steps that already completed.

## What Temporal provides

Temporal is an orchestration platform built on three core primitives:

**Workflows** define business logic as code. A workflow can run for days or months, maintaining state in local variables that survive process crashes. The platform automatically persists execution history through event sourcing, allowing deterministic replay from any failure point. This eliminates external checkpointing systems.

**Activities** encapsulate non-deterministic operations—LLM API calls, database queries, external service interactions. Temporal applies configurable retry policies with exponential backoff automatically. Workflows don't track individual retry attempts—that happens automatically in the activity layer.

**Event History** records every workflow execution step (activity scheduling, completion, input/output data) as an immutable audit log. You get Time-Travel Debugging—replaying production failures locally with identical state reconstruction. For debugging non-deterministic AI behavior, this history lets you replay exact execution paths.

Workers poll task queues, take work, execute code, return results. Scale by adding more workers. State lives in Temporal Server's event log, not worker memory.

## When to use Temporal

The decision depends on pipeline characteristics and operational constraints.

**Use Temporal when**:

- **Long-running processes** (hours/days/months) where losing progress is expensive, **such as** multi-stage document analysis, conversational agents maintaining long-term state, or financial audit workflows.
- **Critical fault tolerance** requirements, **for example** in payment processing triggered by LLM agents, medical diagnosis pipelines, or any scenario requiring compensating transactions (part of the "Saga" pattern) to handle rollbacks.
- **Dynamic agent loops** where next steps are determined by LLM output at runtime, **including** ReAct agents, tool selection workflows, or multi-agent coordination that cannot be expressed as static DAGs.
- **Human-in-the-loop** approval flows, **like** HR recruitment or compliance pipelines, where processes must pause indefinitely for user input and resume without state loss.

**Don't use Temporal for**:

- **Simple batch jobs** (\<10 minutes) with low failure risk, **like** standard ETL/ELT tasks where Prefect or Airflow provide faster time-to-value with less operational overhead.
- **Stateless API services** requiring sub-100ms latency. Single synchronous LLM calls don't benefit from durable execution—they add unnecessary complexity.
- **Rapid prototyping** where determinism constraints slow iteration. Temporal requires learning distributed systems patterns (Event Sourcing, deterministic workflows) that increase initial development friction.

**Key tradeoff**: Temporal's core workflow code must be **strictly deterministic**. All non-deterministic operations (LLM calls, `time.now()`, random number generation) must be isolated in Activities. Violating this causes non-deterministic errors during event replay. This is a steep learning curve for AI developers used to standard imperative Python.

## Practical example: refactoring an LLM pipeline

Start with a fragile document parser that needs reliability. We'll refactor it step-by-step (incremental migration) instead of rewriting everything.

### Original pipeline

```python
def parse_document(doc_id: str):
    doc = db.fetch(doc_id)
    parsed = extract_text(doc.path)
    summary = openai_call(parsed)  # Fails on rate limit
    db.save_summary(doc_id, summary)
```

**Problems**: no state preservation, no retry logic, crashes lose progress.

### Step 1: basic workflow with durable state

- **Problem**: The original `parse_document` function is completely stateless. If the worker crashes, everything is lost, including the `doc_id` being processed.
- **Change**: We move from a simple Python function to a `DocumentWorkflow` class. State is now held in `self.state`, which Temporal automatically persists.

```python
from temporalio import workflow

@workflow.defn
class DocumentWorkflow:
    def __init__(self):
        self.state = {
            "doc_id": None,
            "parsed_text": None,
            "summary": None,
            "status": "pending"
        }

    @workflow.run
    async def run(self, doc_id: str) -> dict:
        self.state["doc_id"] = doc_id
        self.state["status"] = "processing"

        # Activities will go here

        return self.state
```

**Pattern**: Durable state in class variables. Temporal persists `self.state` automatically via event sourcing. Worker crashes no longer lose context.

### Step 2: LLM activity with retry policy

- **Problem**: Our `openai_call` has no retry logic. If it fails due to a rate limit (HTTP 429), the entire workflow fails instead of just waiting and trying again.
- **Change**: We wrap `openai_call` in an `Activity` (`generate_summary`). This isolates the non-deterministic code and allows the Workflow to add a `RetryPolicy`.

```python
from temporalio import activity
from datetime import timedelta
# Assuming 'openai' is initialized as AsyncOpenAI client
# from openai import AsyncOpenAI
# client = AsyncOpenAI()

# Model configuration
llm_model_name = "your-llm-model"  # Replace with your provider-specific model

@activity.defn
async def generate_summary(text: str) -> str:
    response = await openai.chat.completions.create(
        model=llm_model_name,
        messages=[{"role": "user", "content": f"Summarize: {text}"}]
    )
    return response.choices[0].message.content

# In workflow:
from temporalio.common import RetryPolicy

summary = await workflow.execute_activity(
    generate_summary,
    self.state["parsed_text"],
    retry_policy=RetryPolicy(
        initial_interval=timedelta(seconds=1),
        backoff_coefficient=2.0,
        maximum_attempts=5,
        maximum_interval=timedelta(seconds=60),
        non_retryable_error_types=["InvalidAPIKeyError", "AuthenticationError"]
    ),
    start_to_close_timeout=timedelta(seconds=30)
)
self.state["summary"] = summary
```

**Pattern**: Activities encapsulate non-deterministic LLM calls. Retry policy handles rate limits (HTTP 429) automatically with exponential backoff. `non_retryable_error_types` prevents wasted retries on permanent failures like auth errors.

`start_to_close_timeout` (30s) caps single attempt duration. `schedule_to_close_timeout` would cap total time including all retries—set higher (e.g., 5 minutes) to accommodate backoff periods.

### Step 3: human-in-the-loop via signals

- **Problem**: The process is fully automated. It cannot pause and wait for a human to approve the generated summary before saving it to the database.
- **Change**: We add `workflow.wait_condition` to allow the workflow to "sleep" (without consuming worker resources). We also add a `Signal` (`approve_summary`) to let an external user "wake" the workflow with an input.

```python
@workflow.defn
class DocumentWorkflow:
    def __init__(self):
        self.state = {...}
        self.approval_received = None  # Signal target

    @workflow.signal
    async def approve_summary(self, approved: bool):
        self.approval_received = approved

    @workflow.run
    async def run(self, doc_id: str) -> dict:
        # ... generate summary ...

        # Wait for human approval (can wait hours/days)
        await workflow.wait_condition(
            lambda: self.approval_received is not None,
            timeout=timedelta(days=7)
        )

        if not self.approval_received:
            self.state["status"] = "rejected"
            return self.state  # Compensating action

        # Continue processing...
```

**Pattern**: Workflows can pause via `wait_condition`. This pause consumes no worker resources and can last indefinitely. Use `timeout` to prevent infinite waits—best practice shown in the code.

### Step 4: query for status monitoring

- **Problem**: We have no idea what's happening inside a running workflow. Is it stuck or waiting for approval? The only way to know is to check logs or the database.
- **Change**: We add a `@workflow.query` method (`get_status`). This lets our UI (or any other service) synchronously read the workflow's internal `self.state` at any time without interrupting it.

```python
@workflow.query
def get_status(self) -> dict:
    return {
        "doc_id": self.state["doc_id"],
        "status": self.state["status"],
        "progress": "awaiting_approval" if self.approval_received is None else "processing"
    }
```

**Pattern**: Queries provide synchronous state access for UIs/dashboards without interrupting workflow execution. They are read-only by design (meaning they cannot change workflow state, only view it).

### Step 5: GPU resource isolation via task queues

- **Problem**: We have an expensive `run_local_model` Activity that requires a GPU. If a normal CPU worker picks it up, it will either crash (OOM) or block other tasks.
- **Change**: When executing the activity, we specify `task_queue="gpu-workers"`. This ensures only workers specifically configured to listen to that queue (and deployed on GPU machines) will execute this task.

```python
@activity.defn
async def run_local_model(text: str) -> str:
    # Requires GPU, expensive
    model = load_model()
    return model.generate(text)

# In workflow:
result = await workflow.execute_activity(
    run_local_model,
    text,
    task_queue="gpu-workers",  # Dedicated queue
    start_to_close_timeout=timedelta(minutes=10)
)

# Worker configuration
worker = Worker(
    client,
    task_queue="gpu-workers",
    workflows=[DocumentWorkflow],
    activities=[run_local_model],
    max_concurrent_activities=2  # Only 2 parallel GPU tasks
)
```

**Pattern**: Task queues isolate resource-intensive activities. Deploy workers with limited activity slots on GPU machines, preventing cascading failures and controlling costs. Implements Bulkhead pattern.

### Step 6: continue-as-new for long processes

- **Problem**: If the workflow processes 10,000 documents in a loop or runs for months (like a chatbot), its Event History becomes huge. This slows down replay/recovery.
- **Change**: We periodically check the history size (`workflow.info().get_current_history_length()`). If it exceeds a threshold, we use `workflow.continue_as_new()` to start a fresh workflow execution, carrying over the state but with a clean history.

```python
@workflow.run
async def run(self, doc_id: str, iteration: int = 0) -> dict:
    # Process document...

    # Check history size
    history_length = workflow.info().get_current_history_length()
    if history_length > 1000:
        # Start fresh workflow execution with current state
        workflow.continue_as_new(doc_id, iteration + 1)

    return self.state
```

**Pattern**: Continue-as-new prevents event history bloat by starting a new workflow execution with a clean history. **Warning**: This is not a "continue"; it's a "restart". The new run loses all `self.state` unless you explicitly pass the necessary data as arguments to the `continue_as_new` call.

### Complete integration

Full example with error handling:

```python
@workflow.defn
class DocumentWorkflow:
    def __init__(self):
        self.state = {"doc_id": None, "summary": None, "status": "pending"}
        self.approval_received = None

    @workflow.run
    async def run(self, doc_id: str) -> dict:
        self.state["doc_id"] = doc_id

        try:
            # Fetch with retry
            doc = await workflow.execute_activity(
                fetch_document,
                doc_id,
                retry_policy=RetryPolicy(maximum_attempts=3),
                start_to_close_timeout=timedelta(seconds=10)
            )

            # LLM with rate limit handling
            summary = await workflow.execute_activity(
                generate_summary,
                doc.text,
                retry_policy=RetryPolicy(
                    backoff_coefficient=2.0,
                    maximum_attempts=5,
                    non_retryable_error_types=["InvalidAPIKeyError"]
                ),
                start_to_close_timeout=timedelta(seconds=30)
            )
            self.state["summary"] = summary

            # Human approval
            await workflow.wait_condition(
                lambda: self.approval_received is not None,
                timeout=timedelta(hours=24)
            )

            if self.approval_received:
                await workflow.execute_activity(
                    save_results,
                    self.state,
                    start_to_close_timeout=timedelta(seconds=10)
                )
                self.state["status"] = "completed"
            else:
                self.state["status"] = "rejected"

        except Exception as e:
            self.state["status"] = "failed"
            self.state["error"] = str(e)

        return self.state

    @workflow.signal
    async def approve_summary(self, approved: bool):
        self.approval_received = approved

    @workflow.query
    def get_status(self) -> dict:
        return self.state
```

## Best practices

**Use exponential backoff for rate limits**. Set `backoff_coefficient` \> 1.5 (typically 2.0) and `maximum_interval` to prevent retry storms. Add jitter if calling shared services to avoid thundering herd effects.

**Store references, not large payloads**. Event History isn't designed for petabyte storage. For large LLM outputs or document content, store only S3 URLs or database IDs in workflow state. Fetch actual data in Activities.

**Monitor Event History size**. Workflows exceeding 1000–2000 events should implement Continue-as-new. High event counts degrade replay performance and risk hitting platform limits.

**Set appropriate timeouts**. `start_to_close_timeout` should exceed typical activity duration but fail stuck calls quickly. `schedule_to_close_timeout` should account for total retry time including backoff periods. Missing timeouts risk infinite hangs.

**Make Activities idempotent**. Temporal guarantees at-least-once execution. Activities may execute multiple times. Use idempotency keys for payments or other non-repeatable operations.

**Use Task Queues for resource isolation**. Deploy GPU workers on dedicated queues with `max_concurrent_activities` limits. This implements Bulkhead pattern, preventing resource exhaustion and controlling costs.

## Conclusion

Temporal trades upfront complexity for long-term reliability. The determinism constraint and operational overhead (self-hosted requires Cassandra/Postgres, Elasticsearch for Visibility) make it overkill for simple batch jobs or stateless services.

For LLM pipelines with expensive API calls, multi-hour execution times, or critical fault tolerance requirements, the architecture works. Automatic state recovery, configurable retry policies, and Time-Travel Debugging fix entire classes of production failures.

Add Temporal when failure recovery and durable orchestration become blocking issues, not as a default architecture choice.
