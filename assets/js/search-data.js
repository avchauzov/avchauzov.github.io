// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

ninja.data = [{
        id: "post-blog-2026-prompt-caching-in-production",
        title: "Prompt caching in production: where the savings disappear",
        description: "KV cache reuse can cut inference costs and latency substantially on paper. Most production deployments capture a fraction of that gap, and the reason is structural rather than a missing configuration flag.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2026/prompt-caching-in-production/";
        },
      },{
        id: "post-blog-2026-agent-memory-write-path",
        title: "Why agent memory degrades in production",
        description: "What happens to agent memory stores after weeks of production use, and what the read path never exposes.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2026/agent-memory-write-path/";
        },
      },{
        id: "post-blog-2026-context-engineering-production-patterns",
        title: "Context engineering as a production discipline",
        description: "Failure modes, architectural patterns, and evidence from real systems.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2026/context-engineering-production-patterns/";
        },
      },{
        id: "post-blog-2026-evaluation-metrics-user-satisfaction-gap",
        title: "Why LLM evaluation metrics look stable but customers are unhappy",
        description: "Classic metrics hide the failures users notice. Production evaluation should measure friction, drift, and task completion.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2026/evaluation-metrics-user-satisfaction-gap/";
        },
      },{
        id: "post-blog-2026-routing-quality-context-limits",
        title: "Context limits degrade routing quality faster than generation",
        description: "Routing and classification under long prompts: score dilution, margin collapse, routing collapse, and practical caps.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2026/routing-quality-context-limits/";
        },
      },{
        id: "post-blog-2026-rag-knowledge-foundation-layer",
        title: "RAG fails upstream",
        description: "Why most RAG failures originate in the data preparation layer, and what to do about it.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2026/rag-knowledge-foundation-layer/";
        },
      },{
        id: "post-blog-2026-intent-routing-architecture-tradeoffs",
        title: "Embeddings for intent classification: architecture trade-offs",
        description: "Practical guide to building intent classifiers with embeddings. When shallow classifiers beat fine-tuning, how to handle confidence thresholds, and what actually matters in production.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2026/intent-routing-architecture-tradeoffs/";
        },
      },{
        id: "post-blog-2025-similarity-metrics-embeddings",
        title: "Similarity metrics for embeddings",
        description: "Why almost always cosine and what actually works?",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/similarity-metrics-embeddings/";
        },
      },{
        id: "post-blog-2025-tokenizer-production-cheatsheet",
        title: "Tokenizers: production economics cheat-sheet",
        description: "Compact reference for tokenizer selection, metrics, and failure modes in production LLM systems.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/tokenizer-production-cheatsheet/";
        },
      },{
        id: "post-blog-2025-metric-gap-e2e-evaluation",
        title: "The metric gap: bridging business outcomes and AI component optimization",
        description: "Why high component scores often mask system failures. A methodology for using E2E evaluation to prioritize engineering work.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/metric-gap-e2e-evaluation/";
        },
      },{
        id: "post-blog-2025-reflection-evaluation-agent-critic",
        title: "Reflection vs evaluation: why the Agent-Critic pattern fails without separation of concerns",
        description: "Architectural separation of reflection (context generation) and evaluation (quality gating) prevents confirmation bias, premature stopping, and infinite loops in multi-agent research systems.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/reflection-evaluation-agent-critic/";
        },
      },{
        id: "post-blog-2025-elasticsearch-hard-filters-rag-bottleneck",
        title: "Vector search + hard filters in Elasticsearch: the hidden RAG bottleneck",
        description: "HNSW graph topology breaks under metadata filtering. A hybrid retrieval strategy for production RAG systems.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/elasticsearch-hard-filters-rag-bottleneck/";
        },
      },{
        id: "post-blog-2025-architecture-design-constraint-satisfaction",
        title: "Architecture design: a constraint-satisfaction approach",
        description: "Methodology for reducing the architectural search space through hierarchical constraint definition: problem, boundaries, and trade-offs.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/architecture-design-constraint-satisfaction/";
        },
      },{
        id: "post-blog-2025-llm-classification-accurate-probabilities",
        title: "Classification with LLMs: getting accurate probabilities from structured output",
        description: "Verbalized confidence in JSON schema provides fast probability estimates for classification tasks. Optimization patterns improve calibration.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/llm-classification-accurate-probabilities/";
        },
      },{
        id: "post-blog-2025-token-optimization-layered-architecture",
        title: "Token optimization: three production patterns that reduce LLM costs by 70%",
        description: "API-level caching, semantic similarity-based caching, and dynamic compression with LLMLingua form a layered approach to token reduction. Each pattern targets different inefficiencies in the prompt processing pipeline.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/token-optimization-layered-architecture/";
        },
      },{
        id: "post-blog-2025-hierarchical-signal-tuning-hybrid-search",
        title: "Hierarchical signal tuning: optimizing components before fusion",
        description: "Fusion algorithms like linear combination or RRF cannot fix poor input signals. Effective hybrid search requires a bottom-up optimization strategy: tuning field weights within BM25 and embedding strategies within dense components before attempting to merge them.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/hierarchical-signal-tuning-hybrid-search/";
        },
      },{
        id: "post-blog-2025-jensen-shannon-clustering-metric",
        title: "Jensen-Shannon divergence for meaningful clustering",
        description: "Silhouette score validates geometry, not meaning. Using Jensen-Shannon divergence to measure feature distribution divergence bridges the gap between mathematical separation and interpretability.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/jensen-shannon-clustering-metric/";
        },
      },{
        id: "post-blog-2025-hybrid-intent-classification",
        title: "Hybrid intent classification: compact-encoder-first routing for production systems",
        description: "Production chatbots route most requests through fast compact encoder classifiers, escalating to LLMs only on low-confidence queries. This hybrid architecture mitigates the latency and cost overheads of monolithic LLM solutions, achieving significant speed gains while preserving high classification accuracy.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/hybrid-intent-classification/";
        },
      },{
        id: "post-blog-2025-few-shot-prompt-ordering-recency-bias",
        title: "Few-shot prompt ordering: the impact of example position",
        description: "Investigating positional bias in few-shot prompting. While \"Lost in the Middle\" suggests boundary importance, the specific ordering of examples remains an important factor for performance stability.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/few-shot-prompt-ordering-recency-bias/";
        },
      },{
        id: "post-blog-2025-temporal-llm-pipelines-durable-execution",
        title: "Temporal for LLM pipelines: durable execution starter pack",
        description: "LLM agents often crash, losing state and expensive API work. Temporal provides durable execution for LLM pipelines: automatic state recovery, configurable retries, and long-running orchestration at the cost of determinism constraints and ops overhead.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/temporal-llm-pipelines-durable-execution/";
        },
      },{
        id: "post-blog-2025-graphrag-beyond-vector-search",
        title: "GraphRAG: beyond vector search for connecting the dots",
        description: "Vector search finds similar text while GraphRAG finds connected facts. A look at the trade-offs, high indexing costs, and lighter-weight alternatives.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/graphrag-beyond-vector-search/";
        },
      },{
        id: "post-blog-2025-domain-driven-design-ai-systems",
        title: "Domain-driven design for AI systems: architectural patterns and production experience",
        description: "Exploring how domain-driven design principles (bounded contexts, anti-corruption layer, ubiquitous language, domain events) enable modularity, safety, and traceability in production AI and LLM systems.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/domain-driven-design-ai-systems/";
        },
      },{
        id: "post-blog-2025-llm-judge-semantic-caching",
        title: "Semantic prompt caching: when LLM-judge beats exact match",
        description: "Standard prompt caching requires exact prefix match. LLM-Judge validates semantic equivalence, rescuing cache hits on paraphrases while adding controllable latency overhead.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/llm-judge-semantic-caching/";
        },
      },{
        id: "post-blog-2025-reranking-trap",
        title: "The reranking trap: when cross-encoders make things worse",
        description: "Cross-encoders and LLM rerankers promise better retrieval precision, but the 200% latency penalty, diversity collapse, and production failures reveal when this expensive step becomes counterproductive.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/reranking-trap/";
        },
      },{
        id: "post-blog-2025-structured-output-engineering-llms",
        title: "Structured output engineering for production LLMs",
        description: "Transitioning from 85% parse rates to production-grade reliability. Constrained decoding guarantees format, Pydantic ensures correctness, token optimization cuts costs by 50%.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/structured-output-engineering-llms/";
        },
      },{
        id: "post-blog-2025-chunk-size-optimization-rag-systems",
        title: "The chunk size dilemma: identifying the optimal value in RAG systems",
        description: "Finding the optimal chunk size is non-trivial: too small loses context, too large dilutes semantics through mean pooling. A systematic methodology for identifying the sweet spot.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/chunk-size-optimization-rag-systems/";
        },
      },{
        id: "post-blog-2025-llm-judge-position-bias-swapping",
        title: "Mitigating positional bias in LLM-as-a-judge evaluation: the swapping technique",
        description: "LLM judges often exhibit a strong preference for the first presented option (position bias). A position-swapping methodology significantly improves agreement with human ratings.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/llm-judge-position-bias-swapping/";
        },
      },{
        id: "post-blog-2025-hybrid-retrieval-rrf-rank-fusion",
        title: "Hybrid retrieval with RRF: solving the score normalization problem",
        description: "Pure vector search isn't always enough. Weighted averaging of BM25 and vector scores breaks due to incompatible scales. RRF solves this by using ranks instead of scores.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/hybrid-retrieval-rrf-rank-fusion/";
        },
      },{
        id: "post-blog-2025-llm-orchestration-pragmatic-guide",
        title: "LLM orchestration: a pragmatic guide to complexity",
        description: "Most production apps are simple chains, yet everyone is building agents. Here's a clear framework on when you really need loops, graphs, and agents in your LLM app.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/llm-orchestration-pragmatic-guide/";
        },
      },{
        id: "post-blog-2025-qdrant-quantization-cuts-rag-latency",
        title: "How Qdrant's scalar quantization cut our RAG latency by 3x",
        description: "A deep dive into how we cut RAG retrieval latency by 3x and costs by 65% using Qdrant's scalar quantization and a hybrid storage strategy, without sacrificing search quality.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/qdrant-quantization-cuts-rag-latency/";
        },
      },{
        id: "post-blog-2025-vlm-context-bias-case-study",
        title: "Why VLMs ignore visual evidence (and how to fix it)",
        description: "VLMs have a strong contextual bias, prioritizing logical conclusions over visual facts. We fixed this in a production case by explicitly telling the model to ignore what it thought it knew.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/vlm-context-bias-case-study/";
        },
      },{
        id: "post-blog-2025-hybrid-ai-pattern-for-high-stakes-ranking",
        title: "Our agents argued endlessly. Here's how a hybrid AI pattern tamed LLM chaos",
        description: "A deep dive into building a medical ranking PoC where pure LLM reasoning failed, and how a hybrid pattern combining LLM feature extraction with a deterministic rule engine achieved stable, auditable results.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/hybrid-ai-pattern-for-high-stakes-ranking/";
        },
      },{
        id: "post-blog-2025-vlm-pipeline-debugging-visual-monitoring-lessons",
        title: "VLM pipeline debugging: lessons from visual monitoring",
        description: "Hard-won insights from building proof-of-concept VLM pipelines for visual monitoring, where hallucinations hide in plain sight, preprocessing decisions make or break everything, and the question is: can we forget classical computer vision?",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/vlm-pipeline-debugging-visual-monitoring-lessons/";
        },
      },{
        id: "post-blog-2025-ml-metrics-undefined-projects-framework",
        title: "Machine learning metrics for undefined projects: 3 critical mistakes",
        description: "When building ML solutions without established playbooks, the wrong approach to metrics and validation can derail projects before you prove they work. A pragmatic framework for research, baselines, and deployment constraints.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/ml-metrics-undefined-projects-framework/";
        },
      },{
        id: "post-blog-2025-pragmatic-llm-debugging",
        title: "Pragmatic LLM debugging: a survival guide to chaos",
        description: "My approach to breaking down complex RAG and agent systems when time is short, golden datasets are missing, and quality needs a fast boost.",
        section: "Posts",
        handler: () => {
          window.location.href = "/blog/2025/pragmatic-llm-debugging/";
        },
      },{
      id: 'light-theme',
      title: 'Change theme to light',
      description: 'Change the theme of the site to Light',
      section: 'Theme',
      handler: () => {
        setThemeSetting("light");
      },
    },
    {
      id: 'dark-theme',
      title: 'Change theme to dark',
      description: 'Change the theme of the site to Dark',
      section: 'Theme',
      handler: () => {
        setThemeSetting("dark");
      },
    },
    {
      id: 'system-theme',
      title: 'Use system default theme',
      description: 'Change the theme of the site to System Default',
      section: 'Theme',
      handler: () => {
        setThemeSetting("system");
      },
    },];
