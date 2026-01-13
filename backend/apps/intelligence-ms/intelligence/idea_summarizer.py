"""
Idea summarization and clustering for text answers.
"""
from __future__ import annotations

import logging
import os
import re
import threading
from collections import Counter
from typing import Dict, Iterable, List

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline

from . import config


class IdeaSummarizer:
    """Clusters answers and generates one paraphrased sentence per cluster."""

    def __init__(self):
        self._logger = logging.getLogger(__name__)
        self._embedding_model = None
        self._paraphraser = None
        self._paraphraser_lock = threading.Lock()
        os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')

    def summarize_clusters(
        self,
        answers: List[str],
        question_text: str,
    ) -> List[Dict[str, int | str]]:
        """Return cluster summaries with counts."""
        cleaned = self._normalize_answers(answers)
        if not cleaned:
            return []

        counts = Counter(cleaned)
        texts = list(counts.keys())
        weights = np.array([counts[text] for text in texts], dtype=float)

        embeddings = self._embed_texts(texts)
        if embeddings is None:
            return []

        if self._logger.isEnabledFor(logging.DEBUG):
            duplicate_count = int(weights.sum() - len(texts))
            self._logger.debug(
                "Summarizer input: total=%d unique=%d duplicates=%d",
                len(cleaned),
                len(texts),
                duplicate_count,
            )
            self._logger.debug(
                "Clustering config: distance_threshold=%.2f min_size=%d max_count=%d",
                config.CLUSTER_DISTANCE_THRESHOLD,
                config.CLUSTER_MIN_SIZE,
                config.CLUSTER_MAX_COUNT,
            )

        labels = self._cluster_embeddings(embeddings, weights)
        if self._logger.isEnabledFor(logging.DEBUG):
            label_counts = Counter(labels)
            self._logger.debug("Cluster labels: %s", dict(label_counts))

        summaries = []
        for label in sorted(set(labels)):
            indices = np.where(labels == label)[0]
            cluster_count = int(weights[indices].sum())
            representative = self._representative_sentence(texts, embeddings, weights, indices, label)
            summary = self._paraphrase_or_fallback(representative)
            summaries.append({'summary': summary, 'count': cluster_count})

        summaries.sort(key=lambda item: item['count'], reverse=True)
        return summaries

    def _normalize_answers(self, answers: Iterable[str]) -> List[str]:
        return [
            re.sub(r"\s+", " ", answer).strip()
            for answer in (answers or [])
            if answer and re.sub(r"\s+", " ", answer).strip()
        ]

    def _embed_texts(self, texts: List[str]):
        if not texts:
            return None
        try:
            model = self._get_embedding_model()
            embeddings = model.encode(
                texts,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            return np.array(embeddings)
        except Exception as exc:
            raise RuntimeError(
                'Embedding model unavailable. Run scripts/cache_models.py.'
            ) from exc

    def _cluster_embeddings(self, embeddings: np.ndarray, weights: np.ndarray) -> np.ndarray:
        if embeddings.shape[0] <= 1:
            return np.zeros((embeddings.shape[0],), dtype=int)

        labels = AgglomerativeClustering(
            n_clusters=None,
            metric='cosine',
            linkage='average',
            distance_threshold=config.CLUSTER_DISTANCE_THRESHOLD,
        ).fit_predict(embeddings)

        if len(set(labels)) > config.CLUSTER_MAX_COUNT:
            labels = AgglomerativeClustering(
                n_clusters=config.CLUSTER_MAX_COUNT,
                metric='cosine',
                linkage='average',
            ).fit_predict(embeddings)

        if config.CLUSTER_MIN_SIZE > 1:
            labels = self._merge_small_clusters(embeddings, weights, labels)
        return labels

    def _merge_small_clusters(
        self,
        embeddings: np.ndarray,
        weights: np.ndarray,
        labels: np.ndarray,
    ) -> np.ndarray:
        while True:
            cluster_counts = Counter()
            for idx, label in enumerate(labels):
                cluster_counts[label] += int(weights[idx])
            small = [
                label for label, count in cluster_counts.items()
                if count < config.CLUSTER_MIN_SIZE
            ]
            if not small or len(cluster_counts) <= 1:
                return labels
            for label in small:
                if label not in set(labels):
                    continue
                centroids = self._cluster_centroids(embeddings, weights, labels)
                target = self._nearest_label(centroids, label)
                labels = np.array([target if value == label else value for value in labels])

    def _cluster_centroids(
        self,
        embeddings: np.ndarray,
        weights: np.ndarray,
        labels: np.ndarray,
    ) -> Dict[int, np.ndarray]:
        centroids: Dict[int, np.ndarray] = {}
        for label in set(labels):
            indices = np.where(labels == label)[0]
            subset = embeddings[indices]
            cluster_weights = weights[indices]
            centroid = np.average(subset, axis=0, weights=cluster_weights)
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid = centroid / norm
            centroids[label] = centroid
        return centroids

    def _nearest_label(
        self,
        centroids: Dict[int, np.ndarray],
        source_label: int,
    ) -> int:
        source = centroids[source_label]
        other_labels = [label for label in centroids.keys() if label != source_label]
        other_centroids = np.stack([centroids[label] for label in other_labels])
        distances = cosine_distances([source], other_centroids)[0]
        nearest_index = int(np.argmin(distances))
        return other_labels[nearest_index]

    def _representative_sentence(
        self,
        texts: List[str],
        embeddings: np.ndarray,
        weights: np.ndarray,
        indices: np.ndarray,
        label: int,
    ) -> str:
        if indices.size == 0:
            return ''
        subset_embeddings = embeddings[indices]
        cluster_weights = weights[indices]
        centroid = np.average(subset_embeddings, axis=0, weights=cluster_weights)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        distances = cosine_distances([centroid], subset_embeddings)[0]
        ordered = sorted(zip(distances, indices), key=lambda item: item[0])
        if self._logger.isEnabledFor(logging.DEBUG):
            examples = [
                f"{distance:.3f}:{self._truncate_text(texts[idx])}"
                for distance, idx in ordered[: config.MAX_CLUSTER_EXAMPLES]
            ]
            self._logger.debug("Cluster %s examples: %s", label, examples)
        return str(texts[ordered[0][1]]) if ordered else ''

    def _paraphrase_or_fallback(self, sentence: str) -> str:
        cleaned = self._clean_sentence(sentence)
        if not cleaned:
            return ''
        paraphrased = self._paraphrase_sentence(cleaned)
        paraphrased = self._normalize_paraphrase(paraphrased)
        if self._paraphrase_valid(paraphrased, cleaned):
            if self._logger.isEnabledFor(logging.DEBUG):
                self._logger.debug("Cluster paraphrase: %s", paraphrased)
            return paraphrased
        if self._logger.isEnabledFor(logging.DEBUG):
            self._logger.debug("Cluster paraphrase fallback: %s", cleaned)
        return cleaned

    def _paraphrase_sentence(self, sentence: str) -> str:
        paraphraser = self._get_paraphraser()
        prompt = f"Paraphrase: {sentence}"
        with self._paraphraser_lock:
            result = paraphraser(
                prompt,
                do_sample=False,
                num_beams=4,
                max_new_tokens=config.PARAPHRASE_MAX_NEW_TOKENS,
                min_new_tokens=config.PARAPHRASE_MIN_NEW_TOKENS,
                no_repeat_ngram_size=3,
                length_penalty=0.9,
                clean_up_tokenization_spaces=True,
            )
        if not result:
            return ''
        return (result[0].get('generated_text') or '').strip()

    def _clean_sentence(self, sentence: str) -> str:
        if not sentence:
            return ''
        text = re.sub(r"\s+", " ", sentence).strip()
        text = text.strip()
        if text:
            text = text[0].upper() + text[1:]
        return text

    def _normalize_paraphrase(self, text: str) -> str:
        text = text.strip()
        if not text:
            return ''
        text = re.sub(r"^(paraphrase|summary|assistant)[:\-]\s*", "", text, flags=re.I)
        text = re.sub(r"^[\"'\-\s]+", "", text)
        text = re.split(r"(?<=[.!?])\s+", text)[0]
        if text and not text.endswith((".", "!", "?")):
            text = f"{text}."
        if text:
            text = text[0].upper() + text[1:]
        return text

    def _paraphrase_valid(self, paraphrased: str, original: str) -> bool:
        if not paraphrased:
            return False
        word_count = len(re.findall(r"[A-Za-z0-9]+", paraphrased))
        if (
            word_count < config.PARAPHRASE_MIN_WORDS
            or word_count > config.PARAPHRASE_MAX_WORDS
        ):
            return False
        if paraphrased.strip().lower() == original.strip().lower():
            return False
        if re.search(
            r"\bdata\s+structures?\s+is\s+a\s+data\s+structures?\b",
            paraphrased.lower(),
        ):
            return False
        return True

    def _truncate_text(self, text: str, max_len: int = 80) -> str:
        if len(text) <= max_len:
            return text
        return text[: max_len - 1].rstrip() + "..."

    def _get_embedding_model(self):
        if self._embedding_model is None:
            try:
                self._embedding_model = SentenceTransformer(
                    config.EMBEDDING_MODEL,
                    cache_folder=config.HF_HOME,
                    local_files_only=True,
                )
            except Exception as exc:
                raise RuntimeError(
                    'Missing embedding model cache. Run scripts/cache_models.py.'
                ) from exc
        return self._embedding_model

    def _get_paraphraser(self):
        if self._paraphraser is None:
            try:
                tokenizer = AutoTokenizer.from_pretrained(
                    config.PARAPHRASE_MODEL,
                    cache_dir=config.HF_HOME,
                    local_files_only=True,
                )
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    config.PARAPHRASE_MODEL,
                    cache_dir=config.HF_HOME,
                    local_files_only=True,
                )
            except Exception as exc:
                raise RuntimeError(
                    'Missing paraphrase model cache. Run scripts/cache_models.py.'
                ) from exc
            model_config = getattr(model, 'config', None)
            if model_config is not None:
                model_config.max_length = None
                model_config.min_length = None
            generation_config = getattr(model, 'generation_config', None)
            if generation_config is not None:
                generation_config.max_length = None
                generation_config.min_length = None
                generation_config.max_new_tokens = None
                generation_config.min_new_tokens = None
            self._paraphraser = pipeline(
                'text2text-generation',
                model=model,
                tokenizer=tokenizer,
                device=-1,
            )
            if self._paraphraser.generation_config is not None:
                self._paraphraser.generation_config.max_length = None
                self._paraphraser.generation_config.min_length = None
                self._paraphraser.generation_config.max_new_tokens = None
                self._paraphraser.generation_config.min_new_tokens = None
        return self._paraphraser
