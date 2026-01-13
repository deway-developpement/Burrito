"""Pre-cache HuggingFace models and NLTK data for offline runtime."""
import os
from huggingface_hub import snapshot_download
import nltk

BASE_DIR = os.getenv(
    'INTELLIGENCE_MS_ROOT',
    os.path.abspath(os.path.join(os.path.dirname(__file__), '..')),
)
HF_HOME = os.getenv('HF_HOME', os.path.join(BASE_DIR, '.cache', 'huggingface'))
NLTK_DATA = os.getenv('NLTK_DATA', os.path.join(BASE_DIR, '.cache', 'nltk'))

os.environ.setdefault('HF_HOME', HF_HOME)
os.environ.setdefault('TRANSFORMERS_CACHE', HF_HOME)
os.environ.setdefault('NLTK_DATA', NLTK_DATA)

EMBEDDING_MODEL = os.getenv(
    'EMBEDDING_MODEL',
    'sentence-transformers/all-MiniLM-L6-v2',
)
PARAPHRASE_MODEL = os.getenv(
    'PARAPHRASE_MODEL',
    'google/flan-t5-small',
)

MODELS = [EMBEDDING_MODEL, PARAPHRASE_MODEL]
NLTK_PACKAGES = [
    'vader_lexicon',
]


def cache_models():
    for model_id in MODELS:
        print(f'Caching model: {model_id}')
        snapshot_download(repo_id=model_id, cache_dir=HF_HOME)


def cache_nltk():
    for package in NLTK_PACKAGES:
        print(f'Caching NLTK package: {package}')
        nltk.download(package, download_dir=NLTK_DATA)


def main():
    print(f'HF_HOME={HF_HOME}')
    print(f'NLTK_DATA={NLTK_DATA}')
    cache_models()
    cache_nltk()
    print('Cache warmup complete.')


if __name__ == '__main__':
    main()
