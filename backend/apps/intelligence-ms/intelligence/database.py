"""
MongoDB Database Module for Analytics
"""
from typing import Dict, Any, List
from pymongo import MongoClient
import os
from datetime import datetime


class MongoDBManager:
    """Manages MongoDB connections and operations for analytics"""

    def __init__(self, connection_string: str | None = None, db_name: str = "burrito"):
        """
        Initialize MongoDB manager

        Args:
            connection_string: MongoDB connection URI
            db_name: Database name
        """
        if not connection_string:
            # Build from environment variables
            host = os.getenv('MONGODB_HOST', 'localhost')
            port = os.getenv('MONGODB_PORT', '27017')
            username = os.getenv('DATABASE_USERNAME', '')
            password = os.getenv('DATABASE_PASSWORD', '')

            # Try with credentials first, fall back to no credentials
            if username and password:
                try:
                    connection_string = f"mongodb://{username}:{password}@{host}:{port}/"
                except:
                    connection_string = f"mongodb://{host}:{port}/"
            else:
                connection_string = f"mongodb://{host}:{port}/"

        try:
            self.client = MongoClient(
                connection_string, serverSelectionTimeoutMS=5000)
            # Test the connection
            self.client.admin.command('ping')
            self.db = self.client[db_name]
            self._ensure_collections()
        except Exception as e:
            # Try without authentication
            if "@" in connection_string:
                connection_string = connection_string.split("@", 1)[1]
                connection_string = f"mongodb://{connection_string}"

            try:
                self.client = MongoClient(
                    connection_string, serverSelectionTimeoutMS=5000)
                self.client.admin.command('ping')
                self.db = self.client[db_name]
                self._ensure_collections()
            except Exception as e2:
                raise Exception(f"Failed to connect to MongoDB: {str(e2)}")

    def _ensure_collections(self):
        """Ensure required collections exist with indexes"""
        collections = [
            'analyses',
            'sentiment_stats',
            'ideas_frequency'
        ]

        for collection in collections:
            if collection not in self.db.list_collection_names():
                self.db.create_collection(collection)

        # Create indexes
        self.db['analyses'].create_index('question_id', unique=True)
        self.db['analyses'].create_index('timestamp')
        self.db['ideas_frequency'].create_index('idea', unique=True)

    def save_analysis(self, analysis_data: Dict[str, Any]) -> str:
        """
        Save analysis result to database

        Args:
            analysis_data: Dictionary containing analysis results

        Returns:
            MongoDB insert_id
        """
        analysis_data['timestamp'] = datetime.utcnow()

        try:
            result = self.db['analyses'].update_one(
                {'question_id': analysis_data['question_id']},
                {'$set': analysis_data},
                upsert=True
            )
            return str(result.upserted_id or analysis_data['question_id'])
        except Exception as e:
            raise Exception(f"Failed to save analysis: {str(e)}")

    def update_idea_frequency(self, ideas: List[str]):
        """
        Update idea frequency in database

        Args:
            ideas: List of extracted ideas
        """
        try:
            for idea in ideas:
                self.db['ideas_frequency'].update_one(
                    {'idea': idea},
                    {
                        '$inc': {'frequency': 1},
                        '$set': {'last_updated': datetime.utcnow()}
                    },
                    upsert=True
                )
        except Exception as e:
            raise Exception(f"Failed to update idea frequency: {str(e)}")

    def update_sentiment_stats(self, sentiment_label: str):
        """
        Update sentiment statistics

        Args:
            sentiment_label: The sentiment label (POSITIVE, NEGATIVE, NEUTRAL)
        """
        try:
            self.db['sentiment_stats'].update_one(
                {'sentiment': sentiment_label},
                {
                    '$inc': {'count': 1},
                    '$set': {'last_updated': datetime.utcnow()}
                },
                upsert=True
            )
        except Exception as e:
            raise Exception(f"Failed to update sentiment stats: {str(e)}")

    def get_sentiment_stats(self) -> Dict[str, Any]:
        """
        Get sentiment statistics

        Returns:
            Dictionary with sentiment stats
        """
        try:
            pipeline = [
                {'$unwind': '$answers'},
                {
                    '$group': {
                        '_id': '$answers.sentiment_label',
                        'count': {'$sum': 1},
                    }
                },
            ]
            stats = list(self.db['analyses'].aggregate(pipeline))

            if not stats:
                fallback = [
                    {
                        '$group': {
                            '_id': '$aggregate_sentiment_label',
                            'count': {'$sum': 1},
                        }
                    }
                ]
                stats = list(self.db['analyses'].aggregate(fallback))

            total = sum(stat.get('count', 0) for stat in stats)
            if total == 0:
                return {'stats': [], 'total_analyzed': 0}

            formatted = []
            for stat in stats:
                label = stat.get('_id') or ''
                count = int(stat.get('count', 0))
                formatted.append(
                    {
                        'sentiment': label,
                        'count': count,
                        'percentage': (count / total) * 100,
                    }
                )

            return {
                'stats': formatted,
                'total_analyzed': total,
            }
        except Exception as e:
            raise Exception(f"Failed to get sentiment stats: {str(e)}")

    def get_frequent_ideas(self, limit: int = 20) -> Dict[str, Any]:
        """
        Get most frequent ideas

        Args:
            limit: Number of top ideas to return

        Returns:
            Dictionary with frequent ideas
        """
        try:
            pipeline = [
                {'$unwind': '$aggregated_extracted_ideas'},
                {
                    '$group': {
                        '_id': '$aggregated_extracted_ideas',
                        'frequency': {'$sum': 1},
                    }
                },
                {'$sort': {'frequency': -1}},
                {'$limit': limit},
            ]
            ideas = list(self.db['analyses'].aggregate(pipeline))

            total_frequency = 0
            total_frequency_result = list(
                self.db['analyses'].aggregate(
                    [
                        {'$unwind': '$aggregated_extracted_ideas'},
                        {'$group': {'_id': None, 'total': {'$sum': 1}}},
                    ]
                )
            )
            if total_frequency_result:
                total_frequency = int(total_frequency_result[0].get('total', 0))

            total_ideas_result = list(
                self.db['analyses'].aggregate(
                    [
                        {'$unwind': '$aggregated_extracted_ideas'},
                        {'$group': {'_id': '$aggregated_extracted_ideas'}},
                        {'$count': 'total'},
                    ]
                )
            )
            total_ideas = 0
            if total_ideas_result:
                total_ideas = int(total_ideas_result[0].get('total', 0))

            formatted = []
            for idea in ideas:
                label = idea.get('_id') or ''
                frequency = int(idea.get('frequency', 0))
                percentage = (
                    (frequency / total_frequency) * 100
                    if total_frequency
                    else 0
                )
                formatted.append(
                    {
                        'idea': label,
                        'frequency': frequency,
                        'percentage': percentage,
                    }
                )

            return {
                'ideas': formatted,
                'total_ideas': total_ideas,
            }
        except Exception as e:
            raise Exception(f"Failed to get frequent ideas: {str(e)}")

    def get_analysis(self, question_id: str) -> Dict[str, Any]:
        """
        Get analysis by question ID

        Args:
            question_id: The question ID to retrieve

        Returns:
            Analysis data or None if not found
        """
        try:
            return self.db['analyses'].find_one(
                {'question_id': question_id},
                {'_id': 0}
            )
        except Exception as e:
            raise Exception(f"Failed to get analysis: {str(e)}")

    def close(self):
        """Close the MongoDB connection"""
        self.client.close()
