use std::{
    collections::{HashMap, HashSet},
    fs,
    net::SocketAddr,
    sync::Arc,
};

use anyhow::{anyhow, Context, Result};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use mongodb::{
    bson::{doc, Bson, DateTime as BsonDateTime, Document},
    Client as MongoClient, Database,
};
use redis::Client as RedisClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{error, info, warn};

#[derive(Clone)]
struct AppState {
    redis_client: RedisClient,
    mongo_db: Database,
    config: Arc<AppConfig>,
    model: Arc<ModelResources>,
}

#[derive(Clone)]
struct AppConfig {
    result_stream: String,
    model_version: String,
}

#[derive(Clone)]
struct ModelResources {
    positive_words: HashSet<String>,
    negative_words: HashSet<String>,
    stop_words: HashSet<String>,
}

#[derive(Debug, Deserialize)]
struct SentimentLexicon {
    positive: Vec<String>,
    negative: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct IntelligenceRequestEvent {
    job_id: String,
    form_id: String,
    snapshot_id: String,
    window_key: String,
    question_id: String,
    question_text: String,
    answers: Vec<String>,
    analysis_hash: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct IntelligenceResultEvent {
    job_id: String,
    form_id: String,
    snapshot_id: String,
    window_key: String,
    question_id: String,
    analysis_hash: String,
    success: bool,
    top_ideas: Vec<IdeaItem>,
    sentiment: Option<SentimentPayload>,
    analysis_error: Option<String>,
    last_enriched_at: String,
    model_version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct IdeaItem {
    idea: String,
    count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SentimentPayload {
    positive_pct: f64,
    neutral_pct: f64,
    negative_pct: f64,
}

#[derive(Debug, Clone)]
struct AnswerAnalysis {
    answer_text: String,
    sentiment_score: f64,
    sentiment_label: String,
}

#[derive(Debug, Clone)]
struct AnalysisOutput {
    answers: Vec<AnswerAnalysis>,
    top_ideas: Vec<IdeaItem>,
    sentiment: SentimentPayload,
    aggregate_sentiment_score: f64,
    aggregate_sentiment_label: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "intelligence_fn_rs=info,info".into()),
        )
        .init();

    let addr: SocketAddr = std::env::var("INTELLIGENCE_FN_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
        .parse()
        .context("invalid INTELLIGENCE_FN_ADDR")?;

    let redis_host = std::env::var("REDIS_HOST").unwrap_or_else(|_| "localhost".to_string());
    let redis_port = std::env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
    let redis_url = format!("redis://{}:{}/", redis_host, redis_port);
    let redis_client = RedisClient::open(redis_url).context("failed to create redis client")?;

    let mongo_uri = build_mongo_uri();
    let mongo_client = MongoClient::with_uri_str(&mongo_uri)
        .await
        .context("failed to connect to mongodb")?;

    let database_name = std::env::var("DATABASE_NAME").unwrap_or_else(|_| "burrito".to_string());
    let mongo_db = mongo_client.database(&database_name);

    let model = Arc::new(load_models()?);
    let config = Arc::new(AppConfig {
        result_stream: std::env::var("ANALYTICS_INTELLIGENCE_RESULT_STREAM")
            .unwrap_or_else(|_| "analytics:intelligence:result:v1".to_string()),
        model_version: std::env::var("INTELLIGENCE_FN_MODEL_VERSION")
            .unwrap_or_else(|_| "speed-lexicon-v1".to_string()),
    });

    let state = AppState {
        redis_client,
        mongo_db,
        config,
        model,
    };

    let app = Router::new()
        .route("/", post(handle_event))
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/stats/sentiment", get(get_sentiment_stats))
        .route("/stats/ideas", get(get_idea_stats))
        .with_state(state);

    info!(%addr, "intelligence-fn-rs listening");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .context("failed to bind socket")?;
    axum::serve(listener, app).await.context("server error")?;
    Ok(())
}

async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn readyz() -> impl IntoResponse {
    (StatusCode::OK, "ready")
}

async fn handle_event(State(state): State<AppState>, Json(body): Json<Value>) -> Response {
    let request = match parse_intelligence_request(&body) {
        Ok(request) => request,
        Err(error) => {
            warn!("invalid cloud event payload: {error}");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid payload: {error}") })),
            )
                .into_response();
        }
    };

    let result = match process_request(&state, &request).await {
        Ok(result) => result,
        Err(error) => {
            warn!(
                "analysis failed for question {}: {}",
                request.question_id, error
            );
            IntelligenceResultEvent {
                job_id: request.job_id.clone(),
                form_id: request.form_id.clone(),
                snapshot_id: request.snapshot_id.clone(),
                window_key: request.window_key.clone(),
                question_id: request.question_id.clone(),
                analysis_hash: request.analysis_hash.clone(),
                success: false,
                top_ideas: Vec::new(),
                sentiment: None,
                analysis_error: Some(error.to_string()),
                last_enriched_at: chrono::Utc::now().to_rfc3339(),
                model_version: state.config.model_version.clone(),
            }
        }
    };

    if let Err(error) = publish_result_event(&state, &result).await {
        error!("failed to publish intelligence result event: {error}");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to publish result event" })),
        )
            .into_response();
    }

    (StatusCode::ACCEPTED, Json(json!({ "accepted": true }))).into_response()
}

async fn process_request(
    state: &AppState,
    request: &IntelligenceRequestEvent,
) -> Result<IntelligenceResultEvent> {
    let output = analyze_answers(&state.model, &request.answers);
    save_analysis(&state.mongo_db, request, &output).await?;

    Ok(IntelligenceResultEvent {
        job_id: request.job_id.clone(),
        form_id: request.form_id.clone(),
        snapshot_id: request.snapshot_id.clone(),
        window_key: request.window_key.clone(),
        question_id: request.question_id.clone(),
        analysis_hash: request.analysis_hash.clone(),
        success: true,
        top_ideas: output.top_ideas,
        sentiment: Some(output.sentiment),
        analysis_error: None,
        last_enriched_at: chrono::Utc::now().to_rfc3339(),
        model_version: state.config.model_version.clone(),
    })
}

fn analyze_answers(model: &ModelResources, answers: &[String]) -> AnalysisOutput {
    let mut analyzed_answers = Vec::new();
    let mut sentiment_counts = (0_u32, 0_u32, 0_u32);

    for raw in answers {
        let answer_text = normalize_text(raw);
        if answer_text.is_empty() {
            continue;
        }

        let tokens = tokenize(&answer_text);
        let score = sentiment_score(&tokens, model);
        let label = if score >= 0.6 {
            "POSITIVE".to_string()
        } else if score <= 0.4 {
            "NEGATIVE".to_string()
        } else {
            "NEUTRAL".to_string()
        };

        match label.as_str() {
            "POSITIVE" => sentiment_counts.0 += 1,
            "NEGATIVE" => sentiment_counts.2 += 1,
            _ => sentiment_counts.1 += 1,
        }

        analyzed_answers.push(AnswerAnalysis {
            answer_text,
            sentiment_score: score,
            sentiment_label: label,
        });
    }

    let total_answers = analyzed_answers.len() as f64;
    let sentiment = if total_answers > 0.0 {
        SentimentPayload {
            positive_pct: (sentiment_counts.0 as f64 / total_answers) * 100.0,
            neutral_pct: (sentiment_counts.1 as f64 / total_answers) * 100.0,
            negative_pct: (sentiment_counts.2 as f64 / total_answers) * 100.0,
        }
    } else {
        SentimentPayload {
            positive_pct: 0.0,
            neutral_pct: 0.0,
            negative_pct: 0.0,
        }
    };

    let aggregate_sentiment_score = if analyzed_answers.is_empty() {
        0.5
    } else {
        analyzed_answers
            .iter()
            .map(|answer| answer.sentiment_score)
            .sum::<f64>()
            / analyzed_answers.len() as f64
    };

    let aggregate_sentiment_label = if aggregate_sentiment_score >= 0.6 {
        "POSITIVE".to_string()
    } else if aggregate_sentiment_score <= 0.4 {
        "NEGATIVE".to_string()
    } else {
        "NEUTRAL".to_string()
    };

    let top_ideas = cluster_and_summarize(&analyzed_answers, model);

    AnalysisOutput {
        answers: analyzed_answers,
        top_ideas,
        sentiment,
        aggregate_sentiment_score,
        aggregate_sentiment_label,
    }
}

fn cluster_and_summarize(answers: &[AnswerAnalysis], model: &ModelResources) -> Vec<IdeaItem> {
    #[derive(Clone)]
    struct Cluster {
        answer_indexes: Vec<usize>,
        token_counts: HashMap<String, usize>,
    }

    let mut clusters: Vec<Cluster> = Vec::new();
    let mut token_sets: Vec<HashSet<String>> = Vec::new();

    for (index, answer) in answers.iter().enumerate() {
        let set = tokenize_set(&answer.answer_text, &model.stop_words);
        if set.is_empty() {
            continue;
        }

        let mut best_match: Option<usize> = None;
        let mut best_score = 0.0_f64;

        for (cluster_index, existing) in token_sets.iter().enumerate() {
            let score = jaccard_similarity(existing, &set);
            if score > best_score {
                best_score = score;
                best_match = Some(cluster_index);
            }
        }

        if best_score >= 0.35 {
            if let Some(cluster_index) = best_match {
                token_sets[cluster_index].extend(set.iter().cloned());
                if let Some(cluster) = clusters.get_mut(cluster_index) {
                    cluster.answer_indexes.push(index);
                    for token in set {
                        *cluster.token_counts.entry(token).or_insert(0) += 1;
                    }
                }
                continue;
            }
        }

        let mut token_counts = HashMap::new();
        for token in &set {
            token_counts.insert(token.clone(), 1);
        }

        clusters.push(Cluster {
            answer_indexes: vec![index],
            token_counts,
        });
        token_sets.push(set);
    }

    let mut ideas: Vec<IdeaItem> = clusters
        .into_iter()
        .map(|cluster| {
            let mut ranked_terms: Vec<(&String, &usize)> = cluster.token_counts.iter().collect();
            ranked_terms.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));

            let terms: Vec<String> = ranked_terms
                .into_iter()
                .map(|(term, _)| term.clone())
                .filter(|term| !term.is_empty())
                .take(3)
                .collect();

            let summary = if terms.len() >= 2 {
                format!("Feedback highlights {} and {}.", terms[0], terms[1])
            } else if terms.len() == 1 {
                format!("Feedback repeatedly mentions {}.", terms[0])
            } else {
                "Feedback highlights mixed perspectives.".to_string()
            };

            IdeaItem {
                idea: summary,
                count: cluster.answer_indexes.len() as i32,
            }
        })
        .collect();

    ideas.sort_by(|left, right| {
        right
            .count
            .cmp(&left.count)
            .then_with(|| left.idea.cmp(&right.idea))
    });

    if ideas.is_empty() {
        return vec![IdeaItem {
            idea: "Feedback highlights mixed perspectives.".to_string(),
            count: 1,
        }];
    }

    ideas.truncate(10);
    ideas
}

fn tokenize(input: &str) -> Vec<String> {
    input
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|part| !part.trim().is_empty())
        .map(|part| part.to_ascii_lowercase())
        .collect()
}

fn tokenize_set(input: &str, stop_words: &HashSet<String>) -> HashSet<String> {
    tokenize(input)
        .into_iter()
        .filter(|token| token.len() > 2 && !stop_words.contains(token))
        .collect()
}

fn sentiment_score(tokens: &[String], model: &ModelResources) -> f64 {
    if tokens.is_empty() {
        return 0.5;
    }

    let mut score = 0.0_f64;
    for token in tokens {
        if model.positive_words.contains(token) {
            score += 1.0;
        }
        if model.negative_words.contains(token) {
            score -= 1.0;
        }
    }

    let normalized = (score / tokens.len() as f64).clamp(-1.0, 1.0);
    ((normalized + 1.0) / 2.0).clamp(0.0, 1.0)
}

fn jaccard_similarity(left: &HashSet<String>, right: &HashSet<String>) -> f64 {
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }

    let intersection = left.intersection(right).count() as f64;
    let union = left.union(right).count() as f64;
    if union <= f64::EPSILON {
        0.0
    } else {
        intersection / union
    }
}

fn normalize_text(input: &str) -> String {
    input
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn load_models() -> Result<ModelResources> {
    let lexicon_path = std::env::var("INTELLIGENCE_SENTIMENT_LEXICON_PATH")
        .unwrap_or_else(|_| "assets/sentiment_words.json".to_string());
    let lexicon_content = fs::read_to_string(&lexicon_path)
        .with_context(|| format!("failed to read lexicon file: {lexicon_path}"))?;

    let lexicon: SentimentLexicon =
        serde_json::from_str(&lexicon_content).context("failed to parse sentiment lexicon")?;

    if lexicon.positive.is_empty() || lexicon.negative.is_empty() {
        return Err(anyhow!(
            "sentiment lexicon must include positive and negative words"
        ));
    }

    let positive_words = lexicon
        .positive
        .into_iter()
        .map(|word| word.to_ascii_lowercase())
        .collect::<HashSet<_>>();
    let negative_words = lexicon
        .negative
        .into_iter()
        .map(|word| word.to_ascii_lowercase())
        .collect::<HashSet<_>>();

    let stop_words = [
        "the", "and", "with", "from", "that", "this", "have", "has", "were", "was", "are", "for",
        "too", "very", "but", "not", "you", "your", "our", "their", "they", "them", "about",
        "into", "when", "while", "where", "which", "what", "would", "could", "should",
    ]
    .iter()
    .map(|word| word.to_string())
    .collect::<HashSet<_>>();

    Ok(ModelResources {
        positive_words,
        negative_words,
        stop_words,
    })
}

async fn publish_result_event(
    state: &AppState,
    result: &IntelligenceResultEvent,
) -> Result<String> {
    let payload = serde_json::to_string(result).context("failed to encode result payload")?;
    let mut connection = state
        .redis_client
        .get_multiplexed_async_connection()
        .await
        .context("failed to create redis async connection")?;

    let message_id = redis::cmd("XADD")
        .arg(&state.config.result_stream)
        .arg("*")
        .arg("payload")
        .arg(payload)
        .query_async::<String>(&mut connection)
        .await
        .context("failed to publish result payload")?;

    Ok(message_id)
}

async fn save_analysis(
    db: &Database,
    request: &IntelligenceRequestEvent,
    output: &AnalysisOutput,
) -> Result<()> {
    let analyses = db.collection::<Document>("analyses");

    let answer_docs: Vec<Bson> = output
        .answers
        .iter()
        .enumerate()
        .map(|(index, answer)| {
            Bson::Document(doc! {
                "index": index as i32,
                "answer_text": &answer.answer_text,
                "sentiment_score": answer.sentiment_score,
                "sentiment_label": &answer.sentiment_label,
            })
        })
        .collect();

    let cluster_docs: Vec<Bson> = output
        .top_ideas
        .iter()
        .map(|idea| {
            Bson::Document(doc! {
                "summary": &idea.idea,
                "count": idea.count,
            })
        })
        .collect();

    let analysis_doc = doc! {
        "question_id": &request.question_id,
        "question_text": &request.question_text,
        "answers": answer_docs,
        "aggregate_sentiment_score": output.aggregate_sentiment_score,
        "aggregate_sentiment_label": &output.aggregate_sentiment_label,
        "cluster_summaries": cluster_docs,
        "timestamp": BsonDateTime::now(),
    };

    analyses
        .update_one(
            doc! { "question_id": &request.question_id },
            doc! { "$set": analysis_doc },
        )
        .upsert(true)
        .await
        .context("failed to save analysis")?;

    Ok(())
}

async fn get_sentiment_stats(State(state): State<AppState>) -> Response {
    let analyses = state.mongo_db.collection::<Document>("analyses");

    let pipeline = vec![
        doc! { "$unwind": "$answers" },
        doc! {
            "$group": {
                "_id": "$answers.sentiment_label",
                "count": { "$sum": 1 }
            }
        },
    ];

    let mut cursor = match analyses.aggregate(pipeline).await {
        Ok(cursor) => cursor,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("failed to query sentiment stats: {error}") })),
            )
                .into_response();
        }
    };

    let mut rows: Vec<Document> = Vec::new();
    while cursor.advance().await.unwrap_or(false) {
        if let Ok(current) = cursor.deserialize_current() {
            rows.push(current);
        }
    }

    let total: i64 = rows
        .iter()
        .map(|row| row.get_i64("count").unwrap_or(0))
        .sum();

    let stats: Vec<Value> = if total == 0 {
        Vec::new()
    } else {
        rows.iter()
            .map(|row| {
                let sentiment = row.get_str("_id").unwrap_or("").to_string();
                let count = row.get_i64("count").unwrap_or(0);
                json!({
                    "sentiment": sentiment,
                    "count": count,
                    "percentage": (count as f64 / total as f64) * 100.0,
                })
            })
            .collect()
    };

    (
        StatusCode::OK,
        Json(json!({
            "stats": stats,
            "total_analyzed": total,
        })),
    )
        .into_response()
}

async fn get_idea_stats(State(state): State<AppState>) -> Response {
    let analyses = state.mongo_db.collection::<Document>("analyses");

    let pipeline = vec![
        doc! { "$unwind": "$cluster_summaries" },
        doc! {
            "$match": {
                "cluster_summaries.summary": { "$exists": true, "$ne": "" }
            }
        },
        doc! {
            "$group": {
                "_id": "$cluster_summaries.summary",
                "frequency": { "$sum": { "$ifNull": ["$cluster_summaries.count", 1] } }
            }
        },
        doc! { "$sort": { "frequency": -1 } },
        doc! { "$limit": 20 },
    ];

    let mut cursor = match analyses.aggregate(pipeline).await {
        Ok(cursor) => cursor,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("failed to query ideas stats: {error}") })),
            )
                .into_response();
        }
    };

    let mut ideas: Vec<Value> = Vec::new();
    while cursor.advance().await.unwrap_or(false) {
        if let Ok(current) = cursor.deserialize_current() {
            let idea = current.get_str("_id").unwrap_or("").to_string();
            let frequency = current.get_i64("frequency").unwrap_or(0);
            ideas.push(json!({
                "idea": idea,
                "frequency": frequency,
            }));
        }
    }

    (
        StatusCode::OK,
        Json(json!({
            "ideas": ideas,
            "total_ideas": ideas.len(),
        })),
    )
        .into_response()
}

fn parse_intelligence_request(body: &Value) -> Result<IntelligenceRequestEvent> {
    let data = body.get("data").unwrap_or(body);

    let payload = if let Some(payload) = data.get("payload") {
        payload.clone()
    } else if let Some(array) = data.as_array() {
        parse_payload_from_fields_array(array)?
    } else {
        data.clone()
    };

    match payload {
        Value::String(serialized) => serde_json::from_str::<IntelligenceRequestEvent>(&serialized)
            .context("failed to decode request payload from string"),
        value => serde_json::from_value::<IntelligenceRequestEvent>(value)
            .context("failed to decode request payload"),
    }
}

fn parse_payload_from_fields_array(fields: &[Value]) -> Result<Value> {
    let mut index = 0;
    while index + 1 < fields.len() {
        if let Some(name) = fields[index].as_str() {
            if name == "payload" {
                return Ok(fields[index + 1].clone());
            }
        }
        index += 2;
    }

    Err(anyhow!(
        "cloud event data array does not contain a payload field"
    ))
}

fn build_mongo_uri() -> String {
    let mode = std::env::var("MONGODB_MODE")
        .unwrap_or_default()
        .to_lowercase();
    let default_host = if mode == "docker" {
        "mongo"
    } else {
        "localhost"
    };

    let host = std::env::var("MONGODB_HOST").unwrap_or_else(|_| {
        std::env::var("MONGODB_CONTAINER_NAME").unwrap_or_else(|_| default_host.to_string())
    });
    let port = std::env::var("MONGODB_PORT").unwrap_or_else(|_| "27017".to_string());
    let db_name = std::env::var("DATABASE_NAME").unwrap_or_else(|_| "burrito".to_string());
    let username = std::env::var("DATABASE_USERNAME").unwrap_or_default();
    let password = std::env::var("DATABASE_PASSWORD").unwrap_or_default();

    if !username.is_empty() && !password.is_empty() {
        format!(
            "mongodb://{}:{}@{}:{}/{}?authSource=admin",
            username, password, host, port, db_name
        )
    } else {
        format!("mongodb://{}:{}/{}", host, port, db_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn model() -> ModelResources {
        ModelResources {
            positive_words: HashSet::from(["good".to_string(), "excellent".to_string()]),
            negative_words: HashSet::from(["bad".to_string(), "poor".to_string()]),
            stop_words: HashSet::from(["the".to_string(), "and".to_string()]),
        }
    }

    #[test]
    fn sentiment_score_is_bounded() {
        let score = sentiment_score(&vec!["good".to_string()], &model());
        assert!(score >= 0.0 && score <= 1.0);
    }

    #[test]
    fn parse_payload_array_extracts_payload() {
        let fields = vec![
            Value::String("other".to_string()),
            Value::String("x".to_string()),
            Value::String("payload".to_string()),
            Value::String("{\\\"jobId\\\":\\\"1\\\"}".to_string()),
        ];
        let payload = parse_payload_from_fields_array(&fields).unwrap();
        assert_eq!(payload.as_str().unwrap(), "{\\\"jobId\\\":\\\"1\\\"}");
    }

    #[test]
    fn parse_intelligence_request_accepts_data_payload_string() {
        let body = json!({
            "data": {
                "payload": "{\"jobId\":\"job-1\",\"formId\":\"form-1\",\"snapshotId\":\"snap-1\",\"windowKey\":\"all-time\",\"questionId\":\"q-1\",\"questionText\":\"How was it?\",\"answers\":[\"great\"],\"analysisHash\":\"h-1\",\"createdAt\":\"2026-02-26T00:00:00Z\"}"
            }
        });

        let request = parse_intelligence_request(&body).unwrap();
        assert_eq!(request.job_id, "job-1");
        assert_eq!(request.analysis_hash, "h-1");
    }

    #[test]
    fn parse_intelligence_request_accepts_field_value_array() {
        let body = json!({
            "data": [
                "payload",
                "{\"jobId\":\"job-2\",\"formId\":\"form-2\",\"snapshotId\":\"snap-2\",\"windowKey\":\"all-time\",\"questionId\":\"q-2\",\"questionText\":\"Feedback\",\"answers\":[\"ok\"],\"analysisHash\":\"h-2\",\"createdAt\":\"2026-02-26T00:00:00Z\"}"
            ]
        });

        let request = parse_intelligence_request(&body).unwrap();
        assert_eq!(request.job_id, "job-2");
        assert_eq!(request.question_id, "q-2");
    }

    #[test]
    fn cluster_builder_returns_at_least_one_idea() {
        let answers = vec![AnswerAnalysis {
            answer_text: "Good support and clear feedback".to_string(),
            sentiment_score: 0.9,
            sentiment_label: "POSITIVE".to_string(),
        }];
        let ideas = cluster_and_summarize(&answers, &model());
        assert!(!ideas.is_empty());
    }
}
