// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-",
    title: "",
    section: "Navigation",
    handler: () => {
      window.location.href = "/";
    },
  },{id: "nav-blog",
          title: "blog",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/index.html";
          },
        },{id: "nav-about",
          title: "about",
          description: "",
          section: "Navigation",
          handler: () => {
            window.location.href = "/about/";
          },
        },{id: "post-architecture-design-a-constraint-satisfaction-approach",
        
          title: "Architecture design: a constraint-satisfaction approach",
        
        description: "Methodology for reducing the architectural search space through hierarchical constraint definition: Problem, Boundaries, and Trade-offs.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/architecture-design-constraint-satisfaction/";
          
        },
      },{id: "post-classification-with-llms-getting-accurate-probabilities-from-structured-output",
        
          title: "Classification with LLMs: getting accurate probabilities from structured output",
        
        description: "Verbalized confidence in JSON schema provides fast probability estimates for classification tasks. Optimization patterns improve calibration.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/llm-classification-accurate-probabilities/";
          
        },
      },{id: "post-token-optimization-three-production-patterns-that-reduce-llm-costs-by-70",
        
          title: "Token optimization: three production patterns that reduce LLM costs by 70%",
        
        description: "API-level caching, semantic similarity-based caching, and dynamic compression with LLMLingua form a layered approach to token reduction. Each pattern targets different inefficiencies in the prompt processing pipeline.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/token-optimization-layered-architecture/";
          
        },
      },{id: "post-hierarchical-signal-tuning-optimizing-components-before-fusion",
        
          title: "Hierarchical signal tuning: optimizing components before fusion",
        
        description: "Fusion algorithms like Linear Combination or RRF cannot fix poor input signals. Effective hybrid search requires a bottom-up optimization strategy: tuning field weights within BM25 and embedding strategies within Dense components before attempting to merge them.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/hierarchical-signal-tuning-hybrid-search/";
          
        },
      },{id: "post-jensen-shannon-divergence-for-meaningful-clustering",
        
          title: "Jensen-Shannon divergence for meaningful clustering",
        
        description: "Silhouette Score validates geometry, not meaning. Using Jensen-Shannon Divergence to measure feature distribution divergence bridges the gap between mathematical separation and interpretability.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/jensen-shannon-clustering-metric/";
          
        },
      },{id: "post-hybrid-intent-classification-the-rationale-for-production-grade-shallow-model-first-architectures",
        
          title: "Hybrid intent classification: the rationale for production-grade shallow-model-first architectures",
        
        description: "Production chatbots route most requests through fast shallow classifiers, escalating to Large Language Models (LLMs) only on low-confidence queries. This hybrid architecture mitigates the latency and cost overheads of monolithic LLM solutions, achieving significant speed gains while preserving high classification accuracy.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/hybrid-intent-classification/";
          
        },
      },{id: "post-few-shot-prompt-ordering-the-impact-of-example-position",
        
          title: "Few-shot prompt ordering: the impact of example position",
        
        description: "Investigating positional bias in few-shot prompting. While &#39;Lost in the Middle&#39; suggests boundary importance, the specific ordering of examples remains an important factor for performance stability.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/few-shot-prompt-ordering-recency-bias/";
          
        },
      },{id: "post-temporal-for-llm-pipelines-durable-execution-starter-pack",
        
          title: "Temporal for LLM pipelines: durable execution starter pack",
        
        description: "LLM agents often crash, losing state and expensive API work. Temporal provides durable execution for LLM pipelines: automatic state recovery, configurable retries, and long-running orchestration at the cost of determinism constraints and ops overhead.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/temporal-llm-pipelines-durable-execution/";
          
        },
      },{id: "post-graphrag-beyond-vector-search-for-connecting-the-dots",
        
          title: "GraphRAG: beyond vector search for connecting the dots",
        
        description: "Vector search finds similar text while GraphRAG finds connected facts. A look at the trade-offs, high indexing costs, and lighter-weight alternatives.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/graphrag-beyond-vector-search/";
          
        },
      },{id: "post-domain-driven-design-for-ai-systems-architectural-patterns-and-production-experience",
        
          title: "Domain-driven design for AI systems: architectural patterns and production experience",
        
        description: "Exploring how Domain-Driven Design principles (Bounded Contexts, Anti-Corruption Layer, Ubiquitous Language, Domain Events) enable modularity, safety, and traceability in production AI and LLM systems.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/domain-driven-design-ai-systems/";
          
        },
      },{id: "post-semantic-prompt-caching-when-llm-judge-beats-exact-match",
        
          title: "Semantic prompt caching: when LLM-judge beats exact match",
        
        description: "Standard prompt caching requires exact prefix match. LLM-Judge validates semantic equivalence, rescuing cache hits on paraphrases while adding controllable latency overhead.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/llm-judge-semantic-caching/";
          
        },
      },{id: "post-the-reranking-trap-when-cross-encoders-make-things-worse",
        
          title: "The reranking trap: when cross-encoders make things worse",
        
        description: "Cross-encoders and LLM rerankers promise better retrieval precision, but the 200% latency penalty, diversity collapse, and production failures reveal when this expensive step becomes counterproductive.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/reranking-trap/";
          
        },
      },{id: "post-structured-output-engineering-for-production-llms",
        
          title: "Structured output engineering for production LLMs",
        
        description: "Transitioning from 85% parse rates to production-grade reliability. Constrained Decoding guarantees format, Pydantic ensures correctness, token optimization cuts costs by 50%.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/structured-output-engineering-llms/";
          
        },
      },{id: "post-the-chunk-size-dilemma-identifying-the-optimal-value-in-rag-systems",
        
          title: "The chunk size dilemma: identifying the optimal value in RAG systems",
        
        description: "Finding the optimal chunk size is non-trivial: too small loses context, too large dilutes semantics through mean pooling. A systematic methodology for identifying the sweet spot.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/chunk-size-optimization-rag-systems/";
          
        },
      },{id: "post-mitigating-positional-bias-in-llm-as-a-judge-evaluation-the-swapping-technique",
        
          title: "Mitigating positional bias in LLM-as-a-judge evaluation: the swapping technique",
        
        description: "Large Language Model judges often exhibit a strong preference for the first presented option (position bias). A position-swapping methodology significantly improves agreement with human ratings.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/llm-judge-position-bias-swapping/";
          
        },
      },{id: "post-hybrid-retrieval-with-reciprocal-rank-fusion-solving-the-score-normalization-problem",
        
          title: "Hybrid retrieval with reciprocal rank fusion: solving the score normalization problem",
        
        description: "Pure vector search isn&#39;t always enough. Weighted averaging of BM25 and vector scores breaks due to incompatible scales. Reciprocal Rank Fusion solves this by using ranks instead of scores.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/hybrid-retrieval-rrf-rank-fusion/";
          
        },
      },{id: "post-llm-orchestration-a-pragmatic-guide-to-complexity",
        
          title: "LLM orchestration: a pragmatic guide to complexity",
        
        description: "Most production apps are simple chains, yet everyone is building agents. Here&#39;s a clear framework on when you really need loops, graphs, and agents in your LLM app.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/llm-orchestration-pragmatic-guide/";
          
        },
      },{id: "post-how-qdrant-39-s-scalar-quantization-cut-our-rag-latency-by-3x",
        
          title: "How Qdrant&#39;s scalar quantization cut our RAG latency by 3x",
        
        description: "A deep dive into how we cut RAG retrieval latency by 3x and costs by 65% using Qdrant&#39;s scalar quantization and a hybrid storage strategy, without sacrificing search quality.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/qdrant-quantization-cuts-rag-latency/";
          
        },
      },{id: "post-why-vision-language-models-ignore-visual-evidence-and-how-to-fix-it",
        
          title: "Why vision-language models ignore visual evidence (and how to fix it)",
        
        description: "Vision-Language Models have a strong contextual bias, prioritizing &quot;logical&quot; conclusions over visual facts. We fixed this in a production case by explicitly telling the model to ignore what it thought it knew.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/vlm-context-bias-case-study/";
          
        },
      },{id: "post-our-agents-argued-endlessly-here-39-s-how-a-hybrid-ai-pattern-tamed-llm-chaos",
        
          title: "Our agents argued endlessly. Here&#39;s how a hybrid AI pattern tamed LLM chaos...",
        
        description: "A deep dive into building a medical ranking PoC where pure LLM reasoning failed, and how a hybrid pattern combining LLM feature extraction with a deterministic rule engine achieved stable, auditable results.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/hybrid-ai-pattern-for-high-stakes-ranking/";
          
        },
      },{id: "post-vision-language-model-pipeline-debugging-lessons-from-visual-monitoring",
        
          title: "Vision-language model pipeline debugging: lessons from visual monitoring",
        
        description: "Hard-won insights from building Proof of Concept Vision-Language Model pipelines for visual monitoring, where hallucinations hide in plain sight, preprocessing decisions make or break everything, and the question is: can we forget classical Computer Vision?",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/vlm-pipeline-debugging-visual-monitoring-lessons/";
          
        },
      },{id: "post-machine-learning-metrics-for-undefined-projects-3-critical-mistakes",
        
          title: "Machine learning metrics for undefined projects: 3 critical mistakes",
        
        description: "When building ML solutions without established playbooks, the wrong approach to metrics and validation can derail projects before you prove they work. A pragmatic framework for research, baselines, and deployment constraints.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/ml-metrics-undefined-projects-framework/";
          
        },
      },{id: "post-pragmatic-llm-debugging-a-survival-guide-to-chaos",
        
          title: "Pragmatic LLM debugging: a survival guide to chaos",
        
        description: "My approach to breaking down complex RAG and agent systems when time is short, golden datasets are missing, and quality needs a fast boost.",
        section: "Posts",
        handler: () => {
          
            window.location.href = "/blog/2025/pragmatic-llm-debugging-copy/";
          
        },
      },{id: "books-the-godfather",
          title: 'The Godfather',
          description: "",
          section: "Books",handler: () => {
              window.location.href = "/books/the_godfather/";
            },},{id: "news-a-simple-inline-announcement",
          title: 'A simple inline announcement.',
          description: "",
          section: "News",},{id: "news-a-long-announcement-with-details",
          title: 'A long announcement with details',
          description: "",
          section: "News",handler: () => {
              window.location.href = "/news/announcement_2/";
            },},{id: "news-a-simple-inline-announcement-with-markdown-emoji-sparkles-smile",
          title: 'A simple inline announcement with Markdown emoji! :sparkles: :smile:',
          description: "",
          section: "News",},{id: "projects-project-1",
          title: 'project 1',
          description: "with background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/1_project/";
            },},{id: "projects-project-2",
          title: 'project 2',
          description: "a project with a background image and giscus comments",
          section: "Projects",handler: () => {
              window.location.href = "/projects/2_project/";
            },},{id: "projects-project-3-with-very-long-name",
          title: 'project 3 with very long name',
          description: "a project that redirects to another website",
          section: "Projects",handler: () => {
              window.location.href = "/projects/3_project/";
            },},{id: "projects-project-4",
          title: 'project 4',
          description: "another without an image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/4_project/";
            },},{id: "projects-project-5",
          title: 'project 5',
          description: "a project with a background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/5_project/";
            },},{id: "projects-project-6",
          title: 'project 6',
          description: "a project with no image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/6_project/";
            },},{id: "projects-project-7",
          title: 'project 7',
          description: "with background image",
          section: "Projects",handler: () => {
              window.location.href = "/projects/7_project/";
            },},{id: "projects-project-8",
          title: 'project 8',
          description: "an other project with a background image and giscus comments",
          section: "Projects",handler: () => {
              window.location.href = "/projects/8_project/";
            },},{id: "projects-project-9",
          title: 'project 9',
          description: "another project with an image 🎉",
          section: "Projects",handler: () => {
              window.location.href = "/projects/9_project/";
            },},{
        id: 'social-email',
        title: 'email',
        section: 'Socials',
        handler: () => {
          window.open("mailto:%61%76%63%68%61%75%7A%6F%76@%67%6D%61%69%6C.%63%6F%6D", "_blank");
        },
      },{
        id: 'social-linkedin',
        title: 'LinkedIn',
        section: 'Socials',
        handler: () => {
          window.open("https://www.linkedin.com/in/avchauzov", "_blank");
        },
      },{
        id: 'social-github',
        title: 'GitHub',
        section: 'Socials',
        handler: () => {
          window.open("https://github.com/avchauzov", "_blank");
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
