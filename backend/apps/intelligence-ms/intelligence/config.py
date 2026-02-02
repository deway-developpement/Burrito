"""Configuration defaults for intelligence-ms."""
import os

BASE_DIR = os.getenv(
    'INTELLIGENCE_MS_ROOT',
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..')),
)

HF_HOME = os.getenv('HF_HOME', os.path.join(BASE_DIR, '.cache', 'huggingface'))

os.environ.setdefault('HF_HOME', HF_HOME)
os.environ.setdefault('TRANSFORMERS_CACHE', HF_HOME)
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')

EMBEDDING_MODEL = os.getenv(
    'EMBEDDING_MODEL',
    'sentence-transformers/all-MiniLM-L6-v2',
)
PARAPHRASE_MODEL = os.getenv(
    'PARAPHRASE_MODEL',
    'google/flan-t5-small',
)
SENTIMENT_MODEL_ID = os.getenv(
    'SENTIMENT_MODEL_ID',
    'cardiffnlp/twitter-roberta-base-sentiment-latest',
)
SENTIMENT_REPORT_ENABLED = (
    os.getenv('SENTIMENT_REPORT_ENABLED', 'false').lower() == 'true'
)
TRANSLATE_BEFORE_SENTIMENT = (
    os.getenv('TRANSLATE_BEFORE_SENTIMENT', 'true').lower() == 'true'
)
TRANSLATION_MODEL = os.getenv(
    'TRANSLATION_MODEL',
    'Helsinki-NLP/opus-mt-mul-en',
)
TRANSLATION_TASK = os.getenv(
    'TRANSLATION_TASK',
    'translation_mul_to_en',
).strip()
TRANSLATION_DETECT_LANGUAGE = (
    os.getenv('TRANSLATION_DETECT_LANGUAGE', 'true').lower() == 'true'
)

CLUSTER_DISTANCE_THRESHOLD = float(
    os.getenv('CLUSTER_DISTANCE_THRESHOLD', '0.5')
)
CLUSTER_MIN_SIZE = int(os.getenv('CLUSTER_MIN_SIZE', '3'))
CLUSTER_MAX_COUNT = int(os.getenv('CLUSTER_MAX_COUNT', '6'))
MAX_CLUSTER_EXAMPLES = int(os.getenv('MAX_CLUSTER_EXAMPLES', '8'))

PARAPHRASE_MIN_WORDS = int(os.getenv('PARAPHRASE_MIN_WORDS', '4'))
PARAPHRASE_MAX_WORDS = int(os.getenv('PARAPHRASE_MAX_WORDS', '12'))
PARAPHRASE_MAX_NEW_TOKENS = int(os.getenv('PARAPHRASE_MAX_NEW_TOKENS', '18'))
PARAPHRASE_MIN_NEW_TOKENS = int(os.getenv('PARAPHRASE_MIN_NEW_TOKENS', '4'))
PARAPHRASE_REPORT_ENABLED = (
    os.getenv('PARAPHRASE_REPORT_ENABLED', 'false').lower() == 'true'
)
