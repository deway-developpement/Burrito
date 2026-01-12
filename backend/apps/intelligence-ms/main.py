"""
Intelligence Microservice - Main Entry Point
Provides gRPC endpoints for sentiment analysis and idea extraction
"""
import sys
import os
import logging
from concurrent import futures
import grpc
from dotenv import load_dotenv

# Get the script directory
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables
backend_env_path = os.path.join(SCRIPT_DIR, '..', '..', '.env')
if os.path.exists(backend_env_path):
    load_dotenv(backend_env_path)
else:
    # Try loading from local .env
    local_env_path = os.path.join(SCRIPT_DIR, '.env')
    if os.path.exists(local_env_path):
        load_dotenv(local_env_path)

# Configure logging
log_level = os.getenv('INTELLIGENCE_LOG_LEVEL', os.getenv('LOG_LEVEL', 'INFO')).upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Main entry point"""
    try:
        logger.info("Starting Intelligence Microservice...")
        
        # Add script directory to path so imports work
        if SCRIPT_DIR not in sys.path:
            sys.path.insert(0, SCRIPT_DIR)
        
        # Import after proto generation and path setup
        logger.info("Importing modules...")
        from intelligence.servicer import AnalyticsServicer
        from intelligence.sentiment_analyzer import SentimentAnalyzer
        from intelligence.idea_summarizer import IdeaSummarizer
        from intelligence.database import MongoDBManager
        from intelligence import analytics_pb2_grpc
        
        # Initialize components
        logger.info("Initializing Intelligence Microservice...")
        
        # Initialize sentiment analyzer
        sentiment_analyzer = SentimentAnalyzer()
        logger.info("Sentiment analyzer initialized")

        idea_summarizer = IdeaSummarizer()
        logger.info("Idea summarizer initialized")
        
        # Initialize database manager
        db_manager = MongoDBManager()
        logger.info("Database manager initialized")
        
        # Create gRPC server
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
        
        # Create the servicer and dynamically make it inherit from the gRPC base class
        servicer = AnalyticsServicer(db_manager, sentiment_analyzer, idea_summarizer)
        
        # Register the servicer with the server
        analytics_pb2_grpc.add_AnalyticsServiceServicer_to_server(servicer, server)
        
        # Bind to port
        grpc_port = os.getenv('GRPC_PORT', '50051')
        server.add_insecure_port(f'0.0.0.0:{grpc_port}')
        
        # Start server
        server.start()
        logger.info(f"Intelligence Microservice started on port {grpc_port}")
        logger.info("Press CTRL+C to stop the server")
        
        # Keep the server running
        server.wait_for_termination()
    
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        if 'server' in locals():
            server.stop(grace=5)
        logger.info("Server stopped")
    
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
