"""
Sentiment Analysis Module using NLTK VADER with optional translation.
"""
from typing import Tuple
import logging
import threading

import nltk
from langdetect import DetectorFactory, LangDetectException, detect
from nltk.sentiment import SentimentIntensityAnalyzer
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline

from . import config


DetectorFactory.seed = 0


class SentimentAnalyzer:
    """Analyzes sentiment using VADER; can translate to English first."""

    def __init__(self):
        self._logger = logging.getLogger(__name__)
        if config.NLTK_DATA not in nltk.data.path:
            nltk.data.path.append(config.NLTK_DATA)
        self._ensure_resource('sentiment/vader_lexicon')
        self._analyzer = SentimentIntensityAnalyzer()
        self._translator = None
        self._translator_lock = threading.Lock()

        if config.TRANSLATE_BEFORE_SENTIMENT:
            self._init_translator()

    def analyze(self, text: str) -> Tuple[float, str]:
        """
        Analyze sentiment of a text.

        Returns:
            Tuple of (sentiment_score: float between 0 and 1, sentiment_label: str)
        """
        if not text:
            return 0.5, "NEUTRAL"

        if self._translator and self._should_translate(text):
            text = self._translate(text)

        scores = self._analyzer.polarity_scores(text)
        compound = float(scores.get('compound', 0.0))
        sentiment_score = max(0.0, min(1.0, (compound + 1.0) / 2.0))

        if compound >= 0.05:
            label = "POSITIVE"
        elif compound <= -0.05:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"

        return sentiment_score, label

    def save_model(self, model_path: str):
        """No-op for VADER analyzer."""
        return None

    def _init_translator(self) -> None:
        model_id = (config.TRANSLATION_MODEL or '').strip()
        if not model_id or model_id.lower() == 'none':
            raise RuntimeError(
                'Translation is enabled but TRANSLATION_MODEL is not set.'
            )
        try:
            tokenizer = AutoTokenizer.from_pretrained(
                model_id,
                cache_dir=config.HF_HOME,
                local_files_only=True,
            )
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_id,
                cache_dir=config.HF_HOME,
                local_files_only=True,
            )
        except Exception as exc:
            raise RuntimeError(
                'Translation model unavailable. Run scripts/cache_models.py.'
            ) from exc

        self._translator = pipeline(
            'translation',
            model=model,
            tokenizer=tokenizer,
            device=-1,
        )
        self._logger.info('Translation enabled for sentiment analysis.')

    def _should_translate(self, text: str) -> bool:
        if not config.TRANSLATION_DETECT_LANGUAGE:
            return True
        try:
            language = detect(text)
        except LangDetectException:
            return True
        return language != 'en'

    def _translate(self, text: str) -> str:
        with self._translator_lock:
            result = self._translator(text, truncation=True)
        if not result:
            raise RuntimeError('Translation returned empty result.')
        translated = (result[0].get('translation_text') or '').strip()
        if not translated:
            raise RuntimeError('Translation returned empty text.')
        return translated

    def _ensure_resource(self, resource: str) -> None:
        candidates = [resource, f"{resource}.zip"]
        for candidate in candidates:
            try:
                nltk.data.find(candidate)
                return
            except LookupError:
                continue
        raise RuntimeError(
            f"Missing NLTK resource '{resource}'. "
            "Run scripts/cache_models.py and set NLTK_DATA if needed."
        )
