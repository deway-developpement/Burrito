"""Pre-cache HuggingFace models for offline runtime."""
import os
from huggingface_hub import snapshot_download

BASE_DIR = os.getenv(
    'INTELLIGENCE_MS_ROOT',
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..')),
)
HF_HOME = os.getenv('HF_HOME', os.path.join(BASE_DIR, '.cache', 'huggingface'))

os.environ.setdefault('HF_HOME', HF_HOME)
os.environ.setdefault('TRANSFORMERS_CACHE', HF_HOME)

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
TRANSLATE_BEFORE_SENTIMENT = (
    os.getenv('TRANSLATE_BEFORE_SENTIMENT', 'true').lower() == 'true'
)
TRANSLATION_MODEL = os.getenv(
    'TRANSLATION_MODEL',
    'Helsinki-NLP/opus-mt-mul-en',
)

MODELS = [EMBEDDING_MODEL, PARAPHRASE_MODEL, SENTIMENT_MODEL_ID]
if (
    TRANSLATE_BEFORE_SENTIMENT
    and TRANSLATION_MODEL
    and TRANSLATION_MODEL.lower() != 'none'
):
    MODELS.append(TRANSLATION_MODEL)


def cache_models():
    for model_id in MODELS:
        print(f'Caching model: {model_id}')
        snapshot_download(repo_id=model_id, cache_dir=HF_HOME)


def main():
    print(f'HF_HOME={HF_HOME}')
    cache_models()
    print('Cache warmup complete.')


if __name__ == '__main__':
    main()
