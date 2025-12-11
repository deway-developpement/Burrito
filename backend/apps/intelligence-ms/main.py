"""
Intelligence Microservice - Main Entry Point
Provides gRPC endpoints for sentiment analysis and idea extraction
"""
import sys
import os
import logging
import subprocess
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
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Generate proto files
def generate_proto_files():
    """Generate Python files from proto definitions"""
    proto_dir = os.path.join(SCRIPT_DIR, 'proto')
    output_dir = os.path.join(SCRIPT_DIR, 'intelligence')
    proto_file = os.path.join(proto_dir, 'analytics.proto')
    
    # Check if proto file exists
    if not os.path.exists(proto_file):
        logger.error(f"Proto file not found at {proto_file}")
        sys.exit(1)
    
    try:
        logger.info("Generating proto files...")
        result = subprocess.run(
            [
                sys.executable, '-m', 'grpc_tools.protoc',
                f'-I{proto_dir}',
                f'--python_out={output_dir}',
                f'--grpc_python_out={output_dir}',
                proto_file
            ],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode != 0:
            logger.error(f"Proto generation error: {result.stderr}")
            sys.exit(1)
        
        logger.info("Proto files generated successfully")
        
        # Fix imports in generated files
        fix_proto_imports()
        
        return True
        
    except FileNotFoundError:
        logger.error("grpc_tools.protoc not found. Please install grpcio-tools: pip install grpcio-tools")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to generate proto files: {str(e)}")
        sys.exit(1)


def fix_proto_imports():
    """Fix relative imports in generated proto files"""
    grpc_file = os.path.join(SCRIPT_DIR, 'intelligence', 'analytics_pb2_grpc.py')
    
    if os.path.exists(grpc_file):
        try:
            with open(grpc_file, 'r') as f:
                content = f.read()
            
            # Replace absolute import with relative import
            if 'import analytics_pb2 as analytics__pb2' in content:
                content = content.replace(
                    'import analytics_pb2 as analytics__pb2',
                    'from . import analytics_pb2 as analytics__pb2'
                )
                
                with open(grpc_file, 'w') as f:
                    f.write(content)
                
                logger.info("Fixed proto imports")
        except Exception as e:
            logger.warning(f"Could not fix proto imports: {str(e)}")


def main():
    """Main entry point"""
    try:
        # Generate proto files first
        logger.info("Starting Intelligence Microservice...")
        generate_proto_files()
        
        # Add script directory to path so imports work
        if SCRIPT_DIR not in sys.path:
            sys.path.insert(0, SCRIPT_DIR)
        
        # Import after proto generation and path setup
        logger.info("Importing modules...")
        from intelligence.servicer import AnalyticsServicer
        from intelligence.sentiment_analyzer import SentimentAnalyzer
        from intelligence.database import MongoDBManager
        from intelligence import analytics_pb2_grpc
        
        # Initialize components
        logger.info("Initializing Intelligence Microservice...")
        
        # Initialize sentiment analyzer
        sentiment_analyzer = SentimentAnalyzer()
        logger.info("Sentiment analyzer initialized")
        
        # Initialize database manager
        db_manager = MongoDBManager()
        logger.info("Database manager initialized")
        
        # Create gRPC server
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
        
        # Create the servicer and dynamically make it inherit from the gRPC base class
        servicer = AnalyticsServicer(db_manager, sentiment_analyzer)
        
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
