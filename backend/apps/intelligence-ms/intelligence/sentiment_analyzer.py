"""
Sentiment Analysis Module using a transformer classifier with optional translation.
"""
from typing import Tuple
import logging
import threading

from langdetect import DetectorFactory, LangDetectException, detect
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoModelForSequenceClassification,
    AutoTokenizer,
    pipeline,
)

from . import config


DetectorFactory.seed = 0


class SentimentAnalyzer:
    """Analyzes sentiment using a transformer model; can translate to English first."""

    def __init__(self):
        self._logger = logging.getLogger(__name__)
        self._translator = None
        self._translator_lock = threading.Lock()
        self._sentiment = None
        self._sentiment_lock = threading.Lock()

        self._init_sentiment_model()

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

        sentiment_score, label, report = self._score_sentiment(text)
        if config.SENTIMENT_REPORT_ENABLED:
            self._logger.info(
                "Sentiment report | pos=%.4f neu=%.4f neg=%.4f "
                "positive_score=%.4f label=%s",
                report["pos_prob"],
                report["neu_prob"],
                report["neg_prob"],
                report["positive_score"],
                label,
            )
        elif self._logger.isEnabledFor(logging.DEBUG):
            self._logger.debug(
                "Sentiment report | pos=%.4f neu=%.4f neg=%.4f "
                "positive_score=%.4f label=%s",
                report["pos_prob"],
                report["neu_prob"],
                report["neg_prob"],
                report["positive_score"],
                label,
            )

        return sentiment_score, label

    def save_model(self, model_path: str):
        """No-op for the sentiment analyzer."""
        return None

    def _init_sentiment_model(self) -> None:
        model_id = (config.SENTIMENT_MODEL_ID or '').strip()
        if not model_id:
            raise RuntimeError('SENTIMENT_MODEL_ID is not set.')
        try:
            tokenizer = AutoTokenizer.from_pretrained(
                model_id,
                cache_dir=config.HF_HOME,
                local_files_only=True,
                use_fast=True,
            )
            model = AutoModelForSequenceClassification.from_pretrained(
                model_id,
                cache_dir=config.HF_HOME,
                local_files_only=True,
            )
        except Exception as exc:
            raise RuntimeError(
                'Sentiment model unavailable. Run scripts/cache_models.py.'
            ) from exc

        self._sentiment = pipeline(
            'sentiment-analysis',
            model=model,
            tokenizer=tokenizer,
            device=-1,
        )
        self._logger.info('Sentiment model loaded: %s', model_id)

    def _score_sentiment(self, text: str) -> Tuple[float, str, dict]:
        with self._sentiment_lock:
            result = self._sentiment(
                text, truncation=True, return_all_scores=True)
        if not result:
            raise RuntimeError('Sentiment model returned empty result.')
        scores = result[0] if isinstance(result[0], list) else result
        label_scores = {}
        for item in scores:
            label = (item.get('label') or '').strip()
            score = float(item.get('score', 0.0))
            if label:
                label_scores[label] = score

        label_map = {
            'LABEL_0': 'negative',
            'LABEL_1': 'neutral',
            'LABEL_2': 'positive',
            'NEGATIVE': 'negative',
            'NEUTRAL': 'neutral',
            'POSITIVE': 'positive',
            'negative': 'negative',
            'neutral': 'neutral',
            'positive': 'positive',
        }

        probs = {'positive': 0.0, 'neutral': 0.0, 'negative': 0.0}
        for raw_label, score in label_scores.items():
            normalized = label_map.get(
                raw_label) or label_map.get(raw_label.upper())
            if normalized:
                probs[normalized] = score

        total = probs['positive'] + probs['neutral'] + probs['negative']
        if total > 0:
            for key in probs:
                probs[key] /= total

        positive_score = probs['positive'] + 0.5 * probs['neutral']
        if probs['positive'] >= probs['neutral'] and probs['positive'] >= probs['negative']:
            label = "POSITIVE"
        elif probs['negative'] >= probs['positive'] and probs['negative'] >= probs['neutral']:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"

        report = {
            "pos_prob": probs["positive"],
            "neu_prob": probs["neutral"],
            "neg_prob": probs["negative"],
            "positive_score": positive_score,
        }
        return positive_score, label, report

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

        translation_task = (config.TRANSLATION_TASK or '').strip()
        if translation_task == 'translation':
            self._logger.warning(
                'TRANSLATION_TASK=translation is invalid; '
                'using translation_mul_to_en instead.'
            )
            translation_task = 'translation_mul_to_en'

        self._translator = pipeline(
            translation_task,
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
