# Intelligence Ideas: Efficiency Plan

## Goal
Produce usable, representative “top ideas” for TEXT questions while keeping runtime and dependencies reasonable.

## Current Issues (Why results are generic)
- Ideas are extracted from `question_text + answer_text`, so question words dominate every answer.
- `extract_key_phrases` returns unique single tokens only (no phrases, no frequencies).
- No lemmatization or domain stopwords; common words (“data”, “structures”) stay.

## Most Efficient Solution (Minimal change, high impact)
### 1) Extract ideas from answers only
- Keep sentiment on `question_text + answer_text` if desired.
- Use `answer_text` alone for idea extraction so the question doesn’t pollute ideas.

### 2) Add dynamic stopwords from question text
- Tokenize the label and exclude those terms from idea extraction.
- This prevents label words (e.g., “data”, “structures”) from dominating top ideas.

### 3) Use KeyBERT for phrase extraction
- Rank candidate phrases by semantic similarity with the answer set.
- Prefer phrases (bigrams/trigrams) for usable “top ideas.”

### 4) Add domain stopwords + lemmatization
- Add a small custom stopword list for domain noise.
- Lemmatize to collapse variants (improve, improved, improvement).

## Implementation Outline (Detailed)
### A) Add KeyBERT dependency
- Add `keybert` and a sentence-transformer model to `apps/intelligence-ms/requirements.txt`.
- Suggested: `keybert>=0.8.5` and `sentence-transformers>=3.0.0`.
- Ensure model is downloaded at runtime or baked into the image.

### B) Extend `SentimentAnalyzer` with a KeyBERT extractor
- New method: `extract_keyphrases(answers: List[str], question_text: str) -> List[str]`.
- Build dynamic stopwords from `question_text`:
  - Tokenize, lowercase, remove punctuation, filter short tokens.
  - Merge with NLTK stopwords and a small domain stopword list.
- Lemmatize tokens before comparison (use NLTK WordNet lemmatizer).
- Use KeyBERT with:
  - `keyphrase_ngram_range=(1, 3)`
  - `stop_words=dynamic_stopwords`
  - `top_n=10` (or configurable)
- Input text to KeyBERT:
  - Concatenate answers into a single document for coherent global phrases.
  - Optionally pass a list of documents if you want diversity.

### C) Update gRPC handler to use KeyBERT output
- In `AnalyzeQuestion`, call `extract_keyphrases` with `answers` and `question_text`.
- Populate `aggregated_extracted_ideas` from KeyBERT phrases (string list).
- Keep sentiment logic unchanged or restrict to answers only if desired.

### D) Node analytics aggregation
- In `apps/analytics-ms/src/analytics/analytics.service.ts`, prefer
  `aggregated_extracted_ideas` when present.
- Avoid re-counting ideas from per-answer keywords if the aggregated list exists.

## Suggested Settings
- KeyBERT n-grams: (1, 3)
- top_k ideas: 10–15
- Dynamic stopwords: NLTK stopwords + domain list + question-text tokens
- Model: `all-MiniLM-L6-v2` (fast and good quality)

## Validation Steps
- Run refresh on a known form.
- Verify top ideas are phrases like “more examples”, “clear explanations”, “lab sessions”.
- Compare before/after.

## Optional Enhancements (later)
- Add a fallback TF-IDF extractor if KeyBERT fails or is too slow.
- Cache KeyBERT model in memory to reduce per-request overhead.
- Persist phrase scores for transparency and tuning.
- Store TF-IDF scores for transparency.

## Files to Change
- `apps/intelligence-ms/requirements.txt`
- `apps/intelligence-ms/intelligence/sentiment_analyzer.py`
- `apps/intelligence-ms/intelligence/servicer.py`
- `apps/analytics-ms/src/analytics/analytics.service.ts`
