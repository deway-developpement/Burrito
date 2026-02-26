# intelligence-fn-rs

Rust serverless intelligence function for Burrito.

## Responsibilities
- Consume Knative CloudEvents produced from Redis Streams.
- Analyze text answers (sentiment + clustered idea summaries).
- Persist per-question analysis into MongoDB.
- Publish processing result events back to Redis Streams.
- Expose stats endpoints for sentiment and frequent ideas.

## Endpoints
- `POST /` CloudEvent entrypoint
- `GET /healthz`
- `GET /readyz`
- `GET /stats/sentiment`
- `GET /stats/ideas`

## Environment
- `INTELLIGENCE_FN_ADDR` default `0.0.0.0:8080`
- `REDIS_HOST` default `localhost`
- `REDIS_PORT` default `6379`
- `MONGODB_HOST`/`MONGODB_PORT`/`DATABASE_*` as backend services
- `ANALYTICS_INTELLIGENCE_RESULT_STREAM` default `analytics:intelligence:result:v1`
- `INTELLIGENCE_FN_MODEL_VERSION` default `speed-lexicon-v1`
- `INTELLIGENCE_SENTIMENT_LEXICON_PATH` default `assets/sentiment_words.json`
