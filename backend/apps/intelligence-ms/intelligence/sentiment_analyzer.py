"""
Sentiment Analysis Module using NLTK and keyword-based analysis
"""
import os
import numpy as np
from typing import Tuple, List
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')


class SentimentAnalyzer:
    """
    Analyzes sentiment of text using NLTK and keyword-based analysis
    This is a lightweight implementation that doesn't require TensorFlow
    """

    def __init__(self, model_path: str | None = None):
        """
        Initialize the sentiment analyzer

        Args:
            model_path: Path to a pre-trained model (currently unused)
        """
        # Sentiment keywords
        self.positive_words = {
            'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
            'love', 'happy', 'pleased', 'satisfied', 'awesome', 'brilliant',
            'perfect', 'beautiful', 'nice', 'best', 'better', 'outstanding',
            'superb', 'wonderful', 'delighted', 'enthusiastic', 'fantastic',
            'incredible', 'marvelous', 'pleasant', 'pleased', 'positive',
            'remarkable', 'satisfying', 'thrilled', 'wonderful', 'excellent'
        }

        self.negative_words = {
            'bad', 'poor', 'terrible', 'horrible', 'awful', 'hate',
            'sad', 'disappointed', 'angry', 'upset', 'wrong', 'worst',
            'worse', 'ugly', 'difficult', 'problem', 'issue', 'failed',
            'frustrating', 'disgusting', 'inadequate', 'inferior', 'mediocre',
            'painful', 'pathetic', 'regrettable', 'unwanted', 'unpleasant',
            'unsatisfactory', 'waste', 'weak', 'depressing', 'distressing'
        }

        self.intensifiers = {'very', 'extremely',
                             'incredibly', 'absolutely', 'definitely'}
        self.negators = {'not', 'no', 'never', 'neither', 'nobody', 'nothing'}

    def analyze(self, text: str) -> Tuple[float, str]:
        """
        Analyze sentiment of a text

        Args:
            text: The text to analyze

        Returns:
            Tuple of (sentiment_score: float between 0 and 1, sentiment_label: str)
        """
        if not text:
            return 0.5, "NEUTRAL"

        # Preprocess text
        processed_text = self._preprocess(text)
        words = processed_text.split()

        # Count sentiment words
        sentiment_score = self._calculate_sentiment_score(words)

        # Convert score to label
        if sentiment_score >= 0.6:
            label = "POSITIVE"
        elif sentiment_score <= 0.4:
            label = "NEGATIVE"
        else:
            label = "NEUTRAL"

        return sentiment_score, label

    def _preprocess(self, text: str) -> str:
        """Preprocess text for analysis"""
        text = text.lower()
        try:
            tokens = word_tokenize(text)
            stop_words = set(stopwords.words('english'))
            tokens = [word for word in tokens if word.isalnum()
                      and word not in stop_words]
            return ' '.join(tokens)
        except:
            # Fallback: simple split if tokenization fails
            return text.lower()

    def _calculate_sentiment_score(self, words: List[str]) -> float:
        """
        Calculate sentiment score based on word analysis
        Returns a score between 0 and 1
        """
        positive_count = 0
        negative_count = 0
        intensifier_count = 0
        negator_found = False

        for i, word in enumerate(words):
            # Check for intensifiers
            if word in self.intensifiers:
                intensifier_count += 1
                continue

            # Check for negators
            if word in self.negators:
                negator_found = True
                continue

            # Check sentiment words
            if word in self.positive_words:
                positive_count += 1
                if negator_found:  # Negation reverses sentiment
                    positive_count -= 0.5
                    negator_found = False
                elif intensifier_count > 0:
                    positive_count += 0.5 * intensifier_count
                intensifier_count = 0

            elif word in self.negative_words:
                negative_count += 1
                if negator_found:  # Negation reverses sentiment
                    negative_count -= 0.5
                    negator_found = False
                elif intensifier_count > 0:
                    negative_count += 0.5 * intensifier_count
                intensifier_count = 0

        # Calculate final score
        total = positive_count + negative_count

        if total == 0:
            return 0.5  # Neutral if no sentiment words found

        sentiment_score = positive_count / total
        return max(0.0, min(1.0, sentiment_score))  # Clamp between 0 and 1

    def extract_key_phrases(self, text: str) -> List[str]:
        """
        Extract key phrases/ideas from text

        Args:
            text: The text to extract ideas from

        Returns:
            List of extracted ideas
        """
        processed_text = self._preprocess(text)
        words = processed_text.split()

        # Filter out very short words and return unique meaningful words
        ideas = [word for word in set(words) if len(word) > 3]

        return sorted(ideas)

    def save_model(self, model_path: str):
        """Save the current model (no-op for keyword-based analyzer)"""
        pass
