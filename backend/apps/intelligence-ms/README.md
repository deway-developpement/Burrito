# Intelligence Microservice

A Python-based microservice for analyzing survey questions and answers using sentiment analysis and NLP techniques. Exposes a gRPC API for sentiment analysis and idea extraction.

## Features

- **Sentiment Analysis**: Uses a transformer sentiment classifier with optional translate-to-English step
- **Cluster Summaries**: Generates one paraphrased sentence per answer cluster
- **Statistics**: Provides aggregated sentiment and idea frequency statistics
- **Database Storage**: Persists analysis results to MongoDB
- **gRPC API**: Exposes all functionality through a modern gRPC interface

## Architecture

```
Main Entry Point (main.py)
    ├── Sentiment Analyzer (sentiment_analyzer.py)
    │   └── Transformer sentiment classifier + optional translation to English
    ├── Database Manager (database.py)
    │   └── MongoDB for data persistence
    ├── Idea Summarizer (idea_summarizer.py)
    │   └── sentence-transformers + flan-t5-small for clustering + paraphrase labels
    └── gRPC Servicer (servicer.py)
        └── analytics_pb2_grpc service implementation
```

## Setup

### Prerequisites

- Python 3.8 or higher
- MongoDB (running in Docker or locally)
- pip (Python package manager)

### Installation

1. Install Python dependencies:

```bash
cd backend/apps/intelligence-ms
pip install -r requirements.txt
```

2. Generate gRPC Python files from proto definitions (required after proto changes):

```bash
python -m grpc_tools.protoc -I./proto --python_out=./intelligence --grpc_python_out=./intelligence proto/analytics.proto
```


3. Cache models (required for offline runtime):

```bash
python scripts/cache_models.py
```

Runtime downloads are disabled; the service fails fast if caches are missing.

### Configuration

Edit `.env` file to configure:

- `GRPC_PORT`: Port for gRPC server (default: 50051)
- `MONGODB_MODE`: Set to `docker` to use `MONGODB_CONTAINER_NAME` (default: empty)
- `MONGODB_CONTAINER_NAME`: MongoDB container/service name (default: mongo)
- `MONGODB_HOST`: Optional override for MongoDB hostname (default: localhost)
- `MONGODB_PORT`: MongoDB port (default: 27017)
- `DATABASE_NAME`: MongoDB database name (default: burrito)
- `DATABASE_USERNAME`: MongoDB username
- `DATABASE_PASSWORD`: MongoDB password
- `EMBEDDING_MODEL`: Sentence-transformer model ID (default: sentence-transformers/all-MiniLM-L6-v2)
- `PARAPHRASE_MODEL`: Paraphrase model ID (default: google/flan-t5-small)
- `PARAPHRASE_MIN_WORDS`: Minimum words in paraphrase (default: 6)
- `PARAPHRASE_MAX_WORDS`: Maximum words in paraphrase (default: 12)
- `PARAPHRASE_MAX_NEW_TOKENS`: Maximum new tokens for paraphrase generation (default: 18)
- `PARAPHRASE_MIN_NEW_TOKENS`: Minimum new tokens for paraphrase generation (default: 6)
- `SENTIMENT_NEUTRAL_MARGIN`: Neutral band half-width around 0.5 (default: 0.05)
- `SENTIMENT_REPORT_ENABLED`: Log detailed sentiment report (default: true)
- `SENTIMENT_MODEL_ID`: Sentiment model ID (default: cardiffnlp/twitter-roberta-base-sentiment-latest)
- `TRANSLATE_BEFORE_SENTIMENT`: Translate answers to English before sentiment/paraphrasing (default: true)
- `TRANSLATION_MODEL`: Translation model ID (default: Helsinki-NLP/opus-mt-mul-en)
- `TRANSLATION_DETECT_LANGUAGE`: Skip translation when text is detected as English (default: true)
- `HF_HOME`: HuggingFace cache directory (default: ./.cache/huggingface)
- `PARAPHRASE_REPORT_ENABLED`: Log paraphrase fallback reasons (default: true)

## Running the Service

### Development Mode

```bash
# Install dependencies (first time only)
pip install -r requirements.txt

# Run the microservice
python main.py
```

The service will start on **port 50051** (configurable via `.env` with `GRPC_PORT`) and automatically:
1. Initialize the sentiment analyzer
2. Initialize the idea summarizer
3. Connect to MongoDB
4. Start the gRPC server

### Production Mode with Docker

```bash
# Build the image
docker build -t intelligence-ms .

# Run the container
docker run -p 50051:50051 \
  -e MONGODB_HOST=mongo \
  -e MONGODB_PORT=27017 \
  --network=backend_default \
  intelligence-ms
```

### Testing the Service

Create a Python gRPC client:

```python
import grpc
from intelligence import analytics_pb2, analytics_pb2_grpc

# Connect to the service
channel = grpc.insecure_channel('localhost:50051')
stub = analytics_pb2_grpc.AnalyticsServiceStub(channel)

# Analyze a question
request = analytics_pb2.AnalysisRequest(
    question_id='q1',
    question_text='How satisfied are you?',
    answer_text=[
        'Very satisfied with the service!',
        'It was okay, but there were some problems.'
    ]
)
response = stub.AnalyzeQuestion(request)

print(f\"Aggregate sentiment: {response.aggregate_sentiment_label}\")
print(f\"Score: {response.aggregate_sentiment_score}\")
print(f\"Cluster summaries: {[(c.summary, c.count) for c in response.cluster_summaries]}\")
```

## API Usage

### gRPC Methods

#### 1. AnalyzeQuestion

Analyze a single question and its answers:

```protobuf
rpc AnalyzeQuestion(AnalysisRequest) returns (AnalysisResponse);

message AnalysisRequest {
  string question_id = 1;
  string question_text = 2;
  repeated string answer_text = 3;
}

message AnswerAnalysis {
  int32 index = 1;
  string answer_text = 2;
  float sentiment_score = 3;
  string sentiment_label = 4;
}

message AnalysisResponse {
  string question_id = 1;
  repeated AnswerAnalysis answers = 2;
  float aggregate_sentiment_score = 3;
  string aggregate_sentiment_label = 4;
  repeated ClusterSummary cluster_summaries = 8;
  bool success = 6;
  string error_message = 7;
}

message ClusterSummary {
  string summary = 1;
  int32 count = 2;
}
```

#### 2. GetSentimentStats

Retrieve aggregated sentiment statistics:

```protobuf
rpc GetSentimentStats(EmptyRequest) returns (SentimentStatsResponse);

message SentimentStatsResponse {
  repeated SentimentStats stats = 1;
  int32 total_analyzed = 2;
}

message SentimentStats {
  string sentiment = 1;
  int32 count = 2;
  float percentage = 3;
}
```

#### 3. GetFrequentIdeas

Get the most frequently extracted ideas:

```protobuf
rpc GetFrequentIdeas(EmptyRequest) returns (FrequentIdeasResponse);

message FrequentIdeasResponse {
  repeated IdeaFrequency ideas = 1;
  int32 total_ideas = 2;
}

message IdeaFrequency {
  string idea = 1;
  int32 frequency = 2;
  float percentage = 3;
}
```

### Example Usage in NestJS API Gateway

Create a client in the API Gateway to call the analytics service:

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync(
  'path/to/proto/analytics.proto'
);
const analyticsProto = grpc.loadPackageDefinition(packageDefinition);
const client = new analyticsProto.analytics.AnalyticsService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// Analyze a question
client.analyzeQuestion({
  question_id: 'q1',
  question_text: 'How satisfied are you?',
  answer_text: ['Very satisfied with the service']
}, (error, response) => {
  if (error) console.error(error);
  console.log('Aggregate sentiment:', response.aggregate_sentiment_label);
  console.log('Score:', response.aggregate_sentiment_score);
  console.log('Cluster summaries:', response.cluster_summaries);
});
```

## Database Schema

### Collections

#### analyses
```javascript
{
  _id: ObjectId,
  question_id: String,
  question_text: String,
  answers: [
    {
      index: Number,
      answer_text: String,
      sentiment_score: Number,
      sentiment_label: String,
    }
  ],
  aggregate_sentiment_score: Number,
  aggregate_sentiment_label: String,
  cluster_summaries: [
    {
      summary: String,
      count: Number
    }
  ],
  timestamp: Date
}
```

## Project Structure

```
intelligence-ms/
├── main.py                          # Entry point
├── requirements.txt                 # Python dependencies
├── .env                             # Environment configuration
├── proto/
│   └── analytics.proto              # gRPC service definition
├── intelligence/
│   ├── __init__.py
│   ├── config.py                   # Environment defaults and thresholds
│   ├── idea_summarizer.py          # Clustering + paraphrased summaries
│   ├── sentiment_analyzer.py        # Sentiment analysis logic
│   ├── database.py                  # MongoDB operations
│   ├── servicer.py                  # gRPC service implementation
│   ├── analytics_pb2.py             # Generated proto classes
│   └── analytics_pb2_grpc.py        # Generated gRPC stubs
├── scripts/
│   └── cache_models.py              # Pre-cache models
└── README.md                        # This file
```

## Development

### Adding a New Analysis Feature

1. Update `proto/analytics.proto` with new message types and RPC methods
2. Regenerate proto files (manual step)
3. Implement new logic in `idea_summarizer.py` or other modules
4. Add new RPC method implementation in `servicer.py`

## Troubleshooting

### Proto Files Out of Date
```bash
pip install grpcio-tools
python -m grpc_tools.protoc -I./proto --python_out=./intelligence --grpc_python_out=./intelligence proto/analytics.proto
```

### MongoDB Connection Failed
- Ensure MongoDB is running: `docker ps` should show mongo container
- Check credentials in `.env` file
- Verify MongoDB is accessible at configured host:port

### Model Cache Missing
- Run `python scripts/cache_models.py`
- Ensure `HF_HOME` points to the cached directory
- If you enable translation, make sure the translation model is cached

## Future Enhancements

- [ ] Custom model training API
- [ ] Real-time streaming analysis
- [ ] Advanced NLP features (named entity recognition, topic modeling)
- [ ] Performance metrics and monitoring
- [ ] Model versioning and A/B testing
- [ ] Native multilingual sentiment (no translation step)
