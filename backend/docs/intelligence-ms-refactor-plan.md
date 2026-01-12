# Intelligence MS Refactor Plan (Abstractive Cluster Summaries)

## Status
- Draft plan for future implementation.
- Summaries are one sentence per cluster.
- Enhanced (abstractive) mode is always active.
- No TF-IDF or YAKE anywhere in the idea pipeline.
- No raw answer text is returned as a cluster label or summary.
- Database schema stays unchanged (raw answers still stored as today).

## Goals
- Generate one short, abstractive summary sentence for each cluster of similar answers.
- Ensure summaries never expose verbatim answer text.
- Reduce complexity and runtime fragility while keeping output quality.
- Eliminate runtime model downloads and runtime proto generation.
- Make analytics stats idempotent and accurate.

## Non-goals
- No multi-language support in this refactor.
- No online APIs or external hosted models.
- No TF-IDF, YAKE, or extractive summaries.
- No change in database choice or schema (MongoDB stays as-is).

## Current State (Summary)
- Sentiment and idea extraction are in `apps/intelligence-ms/intelligence/sentiment_analyzer.py`.
- Ideas are produced via clustering + KeyBERT + optional LLM summarizer.
- Runtime downloads are triggered for NLTK and HuggingFace models.
- Proto stubs are generated at startup in `apps/intelligence-ms/main.py`.
- Stats are updated incrementally and drift if questions are reprocessed.

## Pain Points
- Heavy dependencies and runtime downloads make startup slow and fragile.
- Summarizer is optional and can return empty or partial results.
- Representative snippet can leak raw answer text if used as labels.
- Sentiment is biased by question text, not just answers.
- Stats drift over time due to non-idempotent updates.

## Target Architecture
```
gRPC Servicer
  -> SentimentAnalyzer (answer-only)
  -> IdeaSummarizer (clustering + abstractive summary)
  -> MongoDBManager (idempotent writes + aggregate stats on read)
```

## Required Outputs
- One summary sentence per cluster.
- Each summary is short (6-12 words target), single sentence, paraphrased.
- No verbatim phrases from answers or question text.
- For every cluster: summary + count (returned via new `cluster_summaries` field; DB schema unchanged).

## Proposed Modules
1) `intelligence/idea_summarizer.py`
   - Owns embeddings, clustering, summarization, and safety checks.
2) `intelligence/sentiment_analyzer.py` (or `sentiment.py`)
   - Focused on sentiment only.
3) `intelligence/config.py`
   - Centralizes model IDs, thresholds, and limits.

## Data Flow (End-to-end)
1) Normalize inputs
   - Trim whitespace, drop empty answers.
   - Optionally deduplicate exact duplicates.
2) Sentiment (answer-only)
   - Score each answer independently.
   - Aggregate mean score and label.
3) Embeddings
   - Embed each answer with a local sentence-transformer.
4) Clustering
   - Group similar answers with a distance-threshold algorithm.
5) Cluster summarization (abstractive)
   - Build a cluster input text from representative answers.
   - Generate one short sentence per cluster.
6) Safety checks
   - Enforce no direct phrase overlap with answers/question.
7) Persist results
   - Store cluster summaries in the existing `aggregated_extracted_ideas` field.
   - Keep per-answer payload (including raw answer text) unchanged.
8) Return response
   - Provide summaries, counts, and aggregate sentiment.

## Clustering Strategy (No TF-IDF/YAKE)
### Algorithm
- Use `AgglomerativeClustering` with cosine distance.
- Set `n_clusters=None` and `distance_threshold` to auto-determine clusters.
- This avoids manual k selection and keeps dependency set stable.

### Parameters (initial defaults)
- `CLUSTER_DISTANCE_THRESHOLD = 0.35` (cosine distance)
- `CLUSTER_MIN_SIZE = 2` (merge singletons)
- `CLUSTER_MAX_COUNT = 8` (cap to avoid micro-clusters)

### Singleton Handling
- If a cluster has only 1 answer, merge it into the nearest cluster by cosine distance.
- If all answers are unique and far apart, fall back to 1 cluster.

### Representative Answers (for summarization input only)
- For each cluster, pick the top N answers closest to the cluster centroid.
- Cap by `MAX_CLUSTER_EXAMPLES = 8`.
- This keeps the model input short and focused without quoting any single answer in the output.

## Abstractive Summarization (Always Active)
### Model Choice
Chosen: `google/flan-t5-small`
- Pros: small, instruction-following, good for short paraphrases.
- Cons: needs prompt discipline to avoid copying phrases.

Fallback-only (if flan quality is unacceptable): `sshleifer/distilbart-cnn-12-6`
- Pros: robust summarization.
- Cons: tends to be more extractive; higher copy risk.

### Prompt (for T5-style models)
```
Summarize the feedback into one short sentence (6-12 words).
Paraphrase. Do not quote or reuse phrases from the input.
Avoid filler like "users say" or "feedback indicates".
Feedback:
<cluster_text>
```

### Generation Settings
- `do_sample = False`
- `num_beams = 4`
- `max_new_tokens = 18`
- `min_new_tokens = 6`
- `no_repeat_ngram_size = 3`
- `length_penalty = 0.8`

### Post-processing Rules
- Ensure a single sentence ending with a period.
- Remove leading labels ("Summary:", "Assistant:").
- Title-case first character.
- Enforce 4-12 word range; if outside, re-run once with stricter prompt.

## No-Verbatim Guard (Required)
### Overlap Check
- Compute 4-gram overlap between summary and each answer.
- Also check overlap against the question text.
- If overlap ratio exceeds threshold (e.g., > 0.15), reject and re-run.

### Second-pass Prompt (Stricter)
```
Rewrite in new words only. Do not reuse any 3-word sequence from the input.
Produce one short sentence (6-12 words).
```

### Last-resort Fallback (Still Abstractive)
- Extract candidate topic terms using POS-tagged nouns and adjectives.
- Build a neutral template:
  - "Feedback centers on <topic1> and <topic2>."
  - "Responses highlight <topic1> and concerns about <topic2>."
- The template is generated text and contains no input sentences.
- This is still "enhanced" output, not TF-IDF or YAKE.

## Representative Snippet Usage (Internal Only)
- The current `_representative_snippet` function can remain for diagnostics and sampling.
- It must never be used as a public cluster label or summary.
- It can help select representative answers for the summarizer input.

## Sentiment Pipeline Refactor
### Changes
- Sentiment uses only answer text (no question text concatenation).
- Replace hand-written lexicon with NLTK VADER for more stable polarity.
- Keep aggregate sentiment as mean of per-answer scores.

### Notes
- VADER requires `vader_lexicon` data; cache it at build time.

## API and Proto Considerations
- gRPC is actively used by analytics-ms (`apps/analytics-ms/src/analytics/analytics.service.ts`).
- Keep the gRPC service and preserve existing fields for compatibility.
- Use `aggregated_extracted_ideas` to return cluster summaries (document the semantic change).
- Add a new optional field: `repeated ClusterSummary cluster_summaries` where `ClusterSummary` includes `summary` + `count`.
- Update analytics-ms to prefer `cluster_summaries` and fall back to `aggregated_extracted_ideas` if absent.

### Impacted Updates (Must Do)
- `apps/intelligence-ms/proto/analytics.proto`: add `message ClusterSummary` and field on `AnalysisResponse`.
- Regenerate gRPC stubs and update import fixes if still used.
- `apps/intelligence-ms/intelligence/servicer.py`: populate `cluster_summaries` and keep `aggregated_extracted_ideas` for compatibility.
- `apps/analytics-ms/src/analytics/analytics.service.ts`: read `cluster_summaries` first, then fallback.
- Update any local clients/tests that deserialize `AnalysisResponse`:
  - `apps/intelligence-ms/test_client.py`
  - `apps/intelligence-ms/run_local_test.py`
  - `apps/intelligence-ms/README.md` examples
- Search and update any other references to `aggregated_extracted_ideas` usage.

## Storage Model Updates
### Analyses Collection (No Schema Change)
Store exactly what exists today:
- `answers` array with raw `answer_text` and per-answer sentiment.
- `aggregate_sentiment_score` and `aggregate_sentiment_label`.
- `aggregated_extracted_ideas` now contains cluster summaries.

### Stats
- Compute sentiment stats and idea stats by aggregation, not incremental counters.
- Avoid drifting counts on reprocessing the same question.

## Build and Runtime Changes
### Proto Generation
- Move `grpc_tools.protoc` invocation to build or CI.
- Remove `generate_proto_files()` from runtime `main.py`.

### Model and NLTK Caching
- Add a `scripts/cache_models.py` to pre-download:
  - Flan-T5 small
  - MiniLM embeddings model
  - NLTK corpora (punkt, stopwords, wordnet, vader_lexicon)
- Set `TRANSFORMERS_OFFLINE=1` and `HF_HOME` for runtime.
- Fail fast at startup if required artifacts are missing.

## Dependency Cleanup
### Remove if unused
- `keybert`, `pandas`, `pydantic`, `pydantic-settings`
- Any unused TensorFlow references in README or code

### Keep
- `transformers`, `torch`, `sentence-transformers`, `scikit-learn`, `nltk`
- `grpcio`, `grpcio-tools`, `pymongo`, `python-dotenv`

## Observability
- Log cluster counts, input sizes, summary generation time.
- Log summary rejection counts (overlap guard).
- Export basic metrics if observability stack exists.

## Tests
### Unit Tests
- Summarizer returns one sentence per cluster.
- Summary has no 4-gram overlap with inputs.
- Fallback template is used when model output is rejected.

### Integration Tests
- gRPC `AnalyzeQuestion` returns summaries with expected count.
- Sentiment aggregation matches expected mean.

### Regression Tests
- Fixed set of inputs with snapshot summaries for stability.
- Random seed control in summarizer where applicable.

## Rollout Plan
1) Implement new summarizer behind a feature flag.
2) Run shadow mode: old vs new summaries stored side by side.
3) Compare overlap violations and summary acceptance rates.
4) Switch to new output once stable.
5) Remove old paths (KeyBERT, legacy clustering) after stabilization.

## Dedicated Tools for This Task
The plan uses a dedicated local abstractive summarization model, which is the standard tool class for "summarize a cluster of similar sentences into one sentence":
- `flan-t5-small` (instruction-based abstractive summarization)
- `distilbart-cnn` (summarization, more extractive, less preferred)

Topic models like BERTopic or extractive methods like TextRank are not used because the requirement is strictly abstractive and no raw text.

## Task Breakdown (Implementation Checklist)
1) Create `idea_summarizer.py` with:
   - Embedding loader
   - Clustering logic
   - Abstractive summarization and guard
2) Refactor `sentiment_analyzer.py` to answer-only sentiment.
3) Update `servicer.py` to use `IdeaSummarizer`.
4) Keep DB schema unchanged; adjust writes to reuse existing fields.
5) Update proto to add `ClusterSummary` and `cluster_summaries`; regenerate stubs.
6) Update analytics-ms to consume `cluster_summaries` with fallback.
7) Update local clients/tests/docs to reflect the new field.
8) Add model cache script and Dockerfile updates.
9) Update `requirements.txt` and README.
10) Add tests for summaries, overlap guard, and cluster counts.
11) Remove old KeyBERT and summarizer code paths.

## Confirmed Decisions
- Summary model: `google/flan-t5-small`.
- Cluster threshold: `0.35` cosine distance.
- Sentiment: VADER, answer-only.
- gRPC stays (analytics-ms uses it).
- DB schema unchanged; avoid drift via aggregation on read.
- No runtime downloads; pre-cache and fail fast.
- Include counts via `ClusterSummary { summary, count }`.
