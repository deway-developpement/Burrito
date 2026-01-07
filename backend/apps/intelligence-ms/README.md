# Intelligence Microservice

A Python-based microservice for analyzing survey questions and answers using sentiment analysis and NLP techniques. Exposes a gRPC API for sentiment analysis and idea extraction.

## Features

- **Sentiment Analysis**: Uses TensorFlow and NLTK to analyze sentiment of questions and answers
- **Idea Extraction**: Extracts key phrases and concepts from text
- **Statistics**: Provides aggregated sentiment and idea frequency statistics
- **Database Storage**: Persists analysis results to MongoDB
- **gRPC API**: Exposes all functionality through a modern gRPC interface

## Architecture

```
Main Entry Point (main.py)
    ├── Sentiment Analyzer (sentiment_analyzer.py)
    │   └── TensorFlow + NLTK for text analysis
    ├── Database Manager (database.py)
    │   └── MongoDB for data persistence
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

2. Generate gRPC Python files from proto definitions:

```bash
python -m grpc_tools.protoc -I./proto --python_out=./intelligence --grpc_python_out=./intelligence proto/analytics.proto
```

(This is done automatically when running main.py)

### Configuration

Edit `.env` file to configure:

- `GRPC_PORT`: Port for gRPC server (default: 50051)
- `MONGODB_HOST`: MongoDB hostname (default: localhost)
- `MONGODB_PORT`: MongoDB port (default: 27017)
- `DATABASE_USERNAME`: MongoDB username
- `DATABASE_PASSWORD`: MongoDB password
- `MODEL_PATH`: Path to saved TensorFlow model (optional)

## Running the Service

### Development Mode

```bash
# Install dependencies (first time only)
pip install -r requirements.txt

# Run the microservice
python main.py
```

The service will start on **port 50051** (configurable via `.env` with `GRPC_PORT`) and automatically:
1. Generate/update proto files
2. Initialize the sentiment analyzer
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
response = stub.AnalyzeQuestion(analytics_pb2.AnalysisRequest(
    question_id='q1',
    question_text='How satisfied are you?',
    answer_text='Very satisfied with the service!'
))

print(f"Sentiment: {response.sentiment_label}")
print(f"Score: {response.sentiment_score}")
print(f"Ideas: {response.extracted_ideas}")
```

## API Usage

### gRPC Methods

#### 1. AnalyzeQuestion

Analyze a single question and its answer:

```protobuf
rpc AnalyzeQuestion(AnalysisRequest) returns (AnalysisResponse);

message AnalysisRequest {
  string question_id = 1;
  string question_text = 2;
  string answer_text = 3;
}

message AnalysisResponse {
  string question_id = 1;
  float sentiment_score = 2;      // 0.0 to 1.0
  string sentiment_label = 3;     // POSITIVE, NEGATIVE, NEUTRAL
  repeated string extracted_ideas = 4;
  bool success = 5;
  string error_message = 6;
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
  answer_text: 'Very satisfied with the service'
}, (error, response) => {
  if (error) console.error(error);
  console.log('Sentiment:', response.sentiment_label);
  console.log('Score:', response.sentiment_score);
  console.log('Ideas:', response.extracted_ideas);
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
  answer_text: String,
  sentiment_score: Number,
  sentiment_label: String,
  extracted_ideas: [String],
  timestamp: Date
}
```

#### sentiment_stats
```javascript
{
  _id: ObjectId,
  sentiment: String,  // POSITIVE, NEGATIVE, NEUTRAL
  count: Number,
  last_updated: Date
}
```

#### ideas_frequency
```javascript
{
  _id: ObjectId,
  idea: String,
  frequency: Number,
  last_updated: Date
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
│   ├── sentiment_analyzer.py        # Sentiment analysis logic
│   ├── database.py                  # MongoDB operations
│   ├── servicer.py                  # gRPC service implementation
│   ├── analytics_pb2.py             # Generated proto classes
│   └── analytics_pb2_grpc.py        # Generated gRPC stubs
└── README.md                        # This file
```

## Development

### Adding a New Analysis Feature

1. Update `proto/analytics.proto` with new message types and RPC methods
2. Regenerate proto files (automatic on server start)
3. Implement new logic in `sentiment_analyzer.py` or create new modules
4. Add new RPC method implementation in `servicer.py`

### Training a Custom Model

```python
from intelligence.sentiment_analyzer import SentimentAnalyzer

# Initialize and train
analyzer = SentimentAnalyzer()
# ... train with your data ...
analyzer.save_model('./models/custom_model.h5')
```

Update `.env` with `MODEL_PATH=./models/custom_model.h5` to use it.

## Troubleshooting

### Proto Files Not Generated
```bash
pip install grpcio-tools
python -m grpc_tools.protoc -I./proto --python_out=./intelligence --grpc_python_out=./intelligence proto/analytics.proto
```

### MongoDB Connection Failed
- Ensure MongoDB is running: `docker ps` should show mongo container
- Check credentials in `.env` file
- Verify MongoDB is accessible at configured host:port

### TensorFlow Issues
- For CPU-only: `pip install tensorflow-cpu`
- For GPU: Install CUDA toolkit and `pip install tensorflow`
- On M1/M2 Mac: Use `conda install tensorflow-metal`

## Future Enhancements

- [ ] Multi-language sentiment analysis
- [ ] Custom model training API
- [ ] Real-time streaming analysis
- [ ] Advanced NLP features (named entity recognition, topic modeling)
- [ ] Performance metrics and monitoring
- [ ] Model versioning and A/B testing
