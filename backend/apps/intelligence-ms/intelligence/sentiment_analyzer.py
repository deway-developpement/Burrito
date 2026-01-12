"""
Sentiment Analysis Module using NLTK and keyword-based analysis
"""
import os
import re
import numpy as np
from collections import Counter
from typing import Tuple, List
import nltk
import logging
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# Download required NLTK data
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('wordnet')

try:
    nltk.data.find('corpora/omw-1.4')
except LookupError:
    nltk.download('omw-1.4')


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
        self.domain_stopwords = {
            'course',
            'class',
            'question',
            'answer',
            'data',
            'structure',
            'structures',
        }
        self.filler_stopwords = {
            'more',
            'most',
            'less',
            'better',
            'best',
            'could',
            'would',
            'should',
            'maybe',
            'also',
            'just',
            'like',
            'really',
            'overall',
            'nothing',
            'anything',
            'everything',
            'with',
            'without',
            'make',
            'made',
            'improve',
            'improved',
            'improvement',
        }
        self.base_stopwords = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()
        self._keybert = None
        self._embedding_model = None
        self._summarizer = None
        self._keybert_model = os.getenv(
            'KEYBERT_MODEL',
            'sentence-transformers/all-MiniLM-L6-v2',
        )
        self._summarizer_model = os.getenv(
            'SUMMARIZER_MODEL',
            'sshleifer/distilbart-cnn-12-6',
        )
        self._hf_cache_dir = os.getenv(
            'HF_HOME',
            os.path.join(os.getcwd(), '.cache', 'huggingface'),
        )
        self._logger = logging.getLogger(__name__)

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

    def _preprocess(self, text: str, stop_words: set | None = None) -> str:
        """Preprocess text for analysis"""
        text = text.lower()
        stop_words = stop_words or self.base_stopwords
        try:
            tokens = word_tokenize(text)
            tokens = [
                self.lemmatizer.lemmatize(word)
                for word in tokens
                if word.isalnum() and word not in stop_words
            ]
            return ' '.join(tokens)
        except:
            # Fallback: simple split if tokenization fails
            tokens = re.findall(r"[a-z0-9]+", text.lower())
            tokens = [
                self.lemmatizer.lemmatize(token)
                for token in tokens
                if token not in stop_words
            ]
            return ' '.join(tokens)

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
        Extract key phrases/ideas from a single text (simple fallback)

        Args:
            text: The text to extract ideas from

        Returns:
            List of extracted ideas
        """
        stop_words = self.base_stopwords | self.domain_stopwords
        return self._extract_simple_phrases_from_text(text, stop_words, top_n=10)

    def extract_keyphrases(
        self,
        answers: List[str],
        question_text: str,
        top_n: int = 10,
    ) -> List[str]:
        """
        Extract key phrases/ideas using KeyBERT with dynamic stopwords
        """
        combined_text = " ".join([a for a in answers if a and a.strip()])
        if not combined_text:
            return []

        stop_words = self._build_stopwords(question_text)

        try:
            keybert = self._get_keybert()
            keywords = keybert.extract_keywords(
                combined_text,
                keyphrase_ngram_range=(1, 3),
                stop_words=stop_words,
                top_n=top_n,
            )
            normalized = self._normalize_keybert_keywords(
                [keyword for keyword, _score in keywords],
                stop_words,
            )
            return normalized[:top_n]
        except Exception:
            return self._extract_simple_phrases_from_text(
                combined_text,
                stop_words,
                top_n,
            )

    def extract_top_ideas_from_clusters(
        self,
        answers: List[str],
        question_text: str,
        top_n: int = 10,
    ) -> List[str]:
        cleaned_answers = [a for a in answers if a and a.strip()]
        if len(cleaned_answers) < 2:
            return self.extract_keyphrases(answers, question_text, top_n)

        unique_answers, answer_counts = self._unique_answers_with_counts(
            cleaned_answers
        )
        if len(unique_answers) < 2:
            return self.extract_keyphrases(answers, question_text, top_n)

        embeddings = self._embed_texts(unique_answers)
        if embeddings is None:
            return self.extract_keyphrases(answers, question_text, top_n)

        k = self._cluster_count(len(unique_answers))
        if k < 2:
            return self.extract_keyphrases(answers, question_text, top_n)

        from sklearn.cluster import KMeans

        k = min(k, len(unique_answers))
        model = KMeans(n_clusters=k, random_state=42, n_init='auto')
        labels = model.fit_predict(embeddings)

        stop_words = self._build_stopwords(question_text)
        cluster_sizes = Counter()
        for label, count in zip(labels, answer_counts):
            cluster_sizes[label] += count
        ordered_clusters = [label for label, _ in cluster_sizes.most_common()]
        ideas: List[str] = []

        for cluster_label in ordered_clusters:
            cluster_text = self._build_cluster_text(
                unique_answers,
                answer_counts,
                labels,
                cluster_label,
            )
            summary = self._summarize_cluster(cluster_text)
            phrases = self._extract_keybert_phrases_from_text(
                cluster_text,
                stop_words,
                top_n=5,
                ngram_range=(2, 4),
                min_tokens=2,
            )
            if not phrases:
                phrases = self._extract_keybert_phrases_from_text(
                    cluster_text,
                    stop_words,
                    top_n=5,
                    ngram_range=(1, 3),
                    min_tokens=2,
                )
            label = summary or (phrases[0] if phrases else '')
            if not label:
                label = self._representative_snippet(
                    unique_answers,
                    answer_counts,
                    labels,
                    cluster_label,
                )
            if label and label not in ideas:
                ideas.append(label)

            if len(ideas) >= top_n:
                break

        return ideas

    def extract_answer_keywords(
        self,
        answer: str,
        question_text: str,
        top_n: int = 10,
    ) -> List[str]:
        """
        Lightweight per-answer keywords for debugging or fallback use
        """
        if not answer:
            return []
        stop_words = self._build_stopwords(question_text)
        return self._extract_simple_phrases_from_text(answer, stop_words, top_n)

    def _build_stopwords(self, question_text: str) -> set:
        base = (
            set(self.base_stopwords)
            | set(self.domain_stopwords)
            | set(self.filler_stopwords)
        )
        base.update(self._tokenize_for_stopwords(question_text))
        return base

    def _tokenize_for_stopwords(self, text: str) -> List[str]:
        if not text:
            return []
        try:
            tokens = word_tokenize(text.lower())
        except Exception:
            tokens = re.findall(r"[a-z0-9]+", text.lower())
        tokens = [
            self.lemmatizer.lemmatize(token)
            for token in tokens
            if token.isalnum() and len(token) > 2
        ]
        return tokens

    def _extract_simple_phrases_from_text(
        self,
        text: str,
        stop_words: set,
        top_n: int,
    ) -> List[str]:
        processed_text = self._preprocess(text, stop_words=stop_words)
        words = [word for word in processed_text.split() if len(word) > 3]
        counts = Counter(words)
        return [word for word, _count in counts.most_common(top_n)]

    def _extract_keybert_phrases_from_text(
        self,
        text: str,
        stop_words: set,
        top_n: int,
        ngram_range: tuple,
        min_tokens: int,
    ) -> List[str]:
        if not text:
            return []
        try:
            keybert = self._get_keybert()
            keywords = keybert.extract_keywords(
                text,
                keyphrase_ngram_range=ngram_range,
                stop_words=stop_words,
                top_n=top_n,
                use_mmr=True,
                diversity=0.7,
            )
            phrases: List[str] = []
            for keyword, _score in keywords:
                cleaned = self._clean_phrase(keyword, stop_words, min_tokens)
                if cleaned and cleaned not in phrases:
                    phrases.append(cleaned)
            return phrases
        except Exception:
            return []

    def _extract_tfidf_phrases_from_text(
        self,
        text: str,
        stop_words: set,
        top_n: int,
        ngram_range: tuple,
        min_tokens: int,
    ) -> List[str]:
        if not text:
            return []
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
        except Exception:
            return []

        processed = self._preprocess(text, stop_words=stop_words)
        if not processed:
            return []

        vectorizer = TfidfVectorizer(
            ngram_range=ngram_range,
            stop_words=None,
            min_df=1,
        )
        tfidf = vectorizer.fit_transform([processed])
        scores = tfidf.toarray().flatten()
        feature_names = vectorizer.get_feature_names_out()
        ranked = [
            (feature_names[i], scores[i]) for i in scores.argsort()[::-1]
        ]
        phrases = []
        for phrase, _score in ranked:
            cleaned = self._clean_phrase(phrase, stop_words, min_tokens)
            if cleaned and cleaned not in phrases:
                phrases.append(cleaned)
            if len(phrases) >= top_n:
                break
        return phrases

    def _normalize_keybert_keywords(
        self,
        keywords: List[str],
        stop_words: set,
    ) -> List[str]:
        normalized: List[str] = []
        seen = set()
        for keyword in keywords:
            cleaned = self._normalize_phrase(keyword, stop_words)
            if not cleaned or cleaned in seen:
                continue
            seen.add(cleaned)
            normalized.append(cleaned)
        return normalized

    def _normalize_phrase(self, phrase: str, stop_words: set) -> str:
        if not phrase:
            return ''
        tokens = re.findall(r"[a-z0-9]+", phrase.lower())
        cleaned_tokens = [
            self.lemmatizer.lemmatize(token)
            for token in tokens
            if token not in stop_words and len(token) > 2
        ]
        return ' '.join(cleaned_tokens).strip()

    def _clean_phrase(self, phrase: str, stop_words: set, min_tokens: int) -> str:
        if not phrase:
            return ''
        tokens = re.findall(r"[a-z0-9]+", phrase.lower())
        tokens = [
            self.lemmatizer.lemmatize(token)
            for token in tokens
            if token not in stop_words and len(token) > 2
        ]
        if len(tokens) < min_tokens:
            return ''
        return ' '.join(tokens).strip()

    def _representative_snippet(
        self,
        unique_answers: List[str],
        answer_counts: List[int],
        labels: List[int],
        cluster_label: int,
    ) -> str:
        candidates = []
        for text, count, label in zip(unique_answers, answer_counts, labels):
            if label != cluster_label:
                continue
            candidates.append((count, text.strip()))

        if not candidates:
            return ''

        candidates.sort(key=lambda item: (-item[0], len(item[1])))
        snippet = candidates[0][1]
        snippet = re.sub(r"\s+", " ", snippet).strip()
        max_len = 80
        if len(snippet) > max_len:
            snippet = snippet[: max_len - 1].rstrip() + "…"
        return snippet

    def _get_keybert(self):
        if self._keybert is None:
            self._ensure_model_cached(self._keybert_model)
            from keybert import KeyBERT

            self._keybert = KeyBERT(self._keybert_model)
        return self._keybert

    def _get_embedding_model(self):
        if self._embedding_model is None:
            self._ensure_model_cached(self._keybert_model)
            from sentence_transformers import SentenceTransformer

            self._embedding_model = SentenceTransformer(self._keybert_model)
        return self._embedding_model

    def _get_summarizer(self):
        if self._summarizer is None:
            self._ensure_model_cached(self._summarizer_model)
            from transformers import pipeline

            self._summarizer = pipeline(
                "text2text-generation",
                model=self._summarizer_model,
                tokenizer=self._summarizer_model,
                device=-1,
            )
            generation_config = getattr(
                self._summarizer.model, "generation_config", None)
            if generation_config is not None:
                generation_config.min_length = 0
                if generation_config.max_new_tokens is None:
                    generation_config.max_new_tokens = 64
                if generation_config.forced_bos_token_id is None:
                    generation_config.forced_bos_token_id = 0
            model_config = getattr(self._summarizer.model, "config", None)
            if model_config is not None:
                model_config.min_length = 0
                if getattr(model_config, "max_new_tokens", None) is None:
                    model_config.max_new_tokens = 64
                if getattr(model_config, "forced_bos_token_id", None) is None:
                    model_config.forced_bos_token_id = 0
        return self._summarizer

    def _ensure_model_cached(self, model_id: str):
        os.environ.setdefault('HF_HOME', self._hf_cache_dir)
        os.environ.setdefault('TRANSFORMERS_CACHE', self._hf_cache_dir)
        try:
            from huggingface_hub import snapshot_download, try_to_load_from_cache
        except Exception:
            return

        hf_token = os.getenv('HUGGINGFACE_HUB_TOKEN') or os.getenv('HF_TOKEN')
        cached = try_to_load_from_cache(
            repo_id=model_id,
            filename='config.json',
            cache_dir=self._hf_cache_dir,
        )
        local_only = cached is not None
        try:
            snapshot_download(
                repo_id=model_id,
                cache_dir=self._hf_cache_dir,
                token=hf_token,
                local_files_only=local_only,
            )
            os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
        except Exception as exc:
            self._logger.warning(
                "Model cache download failed for %s: %s",
                model_id,
                exc,
            )

    def _embed_texts(self, texts: List[str]):
        if not texts:
            return None
        try:
            model = self._get_embedding_model()
            return model.encode(texts, show_progress_bar=False)
        except Exception:
            return None

    def _cluster_count(self, sample_count: int) -> int:
        if sample_count <= 1:
            return 1
        k = int(round(sample_count ** 0.5))
        return max(2, min(8, k))

    def _unique_answers_with_counts(
        self,
        answers: List[str],
    ) -> tuple[list, list]:
        counts = Counter(answers)
        unique_answers = list(counts.keys())
        answer_counts = [counts[text] for text in unique_answers]
        return unique_answers, answer_counts

    def _build_cluster_text(
        self,
        unique_answers: List[str],
        answer_counts: List[int],
        labels: List[int],
        cluster_label: int,
    ) -> str:
        parts: List[str] = []
        for text, count, label in zip(unique_answers, answer_counts, labels):
            if label != cluster_label:
                continue
            weight = min(count, 3)
            parts.extend([text] * weight)
        return " ".join(parts)

    def _summarize_cluster(self, cluster_text: str) -> str:
        if not cluster_text or len(cluster_text.split()) < 8:
            return ''
        try:
            summarizer = self._get_summarizer()
            from transformers import GenerationConfig

            generation_config = GenerationConfig(
                max_new_tokens=16,
                min_new_tokens=4,
            )
            truncated = cluster_text[: 3000]
            result = summarizer(
                truncated,
                do_sample=False,
                truncation=True,
                clean_up_tokenization_spaces=True,
                generation_config=generation_config,
            )
            if not result:
                return ''
            summary = (
                result[0].get('summary_text')
                or result[0].get('generated_text')
                or ''
            ).strip()
            summary = re.sub(r"\s+", " ", summary)
            sentences = re.split(r"(?<=[.!?])\s+", summary)
            summary = sentences[0] if sentences else summary
            if len(summary) > 120:
                summary = summary[:119].rstrip() + "…"
            return summary
        except Exception as exc:
            self._logger.warning("Cluster summarization failed: %s", exc)
            return ''

    def save_model(self, model_path: str):
        """Save the current model (no-op for keyword-based analyzer)"""
        pass
