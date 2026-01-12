FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose gRPC port
EXPOSE 50051

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV GRPC_PORT=50051
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
ENV NLTK_DATA=/app/.cache/nltk
ENV TRANSFORMERS_OFFLINE=1
ENV HF_HUB_DISABLE_TELEMETRY=1

# Pre-cache models and NLTK data for offline runtime
RUN python scripts/cache_models.py

# Run the service
CMD ["python", "main.py"]
