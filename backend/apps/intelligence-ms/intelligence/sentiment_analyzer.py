"""
Sentiment Analysis Module using NLTK VADER
"""
from typing import Tuple
import logging

from . import config

import nltk
from nltk.sentiment import SentimentIntensityAnalyzer


class SentimentAnalyzer:
    """Analyzes sentiment using VADER polarity scores."""

    def __init__(self):
        self._logger = logging.getLogger(__name__)
        if config.NLTK_DATA not in nltk.data.path:
            nltk.data.path.append(config.NLTK_DATA)
        self._ensure_resource('sentiment/vader_lexicon')
        self._analyzer = SentimentIntensityAnalyzer()

    def analyze(self, text: str) -> Tuple[float, str]:
        """
        Analyze sentiment of a text.

        Returns:
            Tuple of (sentiment_score: float between 0 and 1, sentiment_label: str)
        """
        if not text:
            return 0.5, "NEUTRAL"

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

    def _ensure_resource(self, resource: str):
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
