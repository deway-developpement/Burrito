"""
gRPC Service Implementation for Analytics
"""
import logging
import grpc

logger = logging.getLogger(__name__)


class AnalyticsServicer:
    """Implementation of the Analytics gRPC service"""
    
    def __init__(self, db_manager, sentiment_analyzer):
        """
        Initialize the servicer
        
        Args:
            db_manager: MongoDB manager instance
            sentiment_analyzer: Sentiment analyzer instance
        """
        self.db_manager = db_manager
        self.sentiment_analyzer = sentiment_analyzer
    
    def AnalyzeQuestion(self, request, context):
        """
        Analyze a question and its answer for sentiment and key ideas
        
        Args:
            request: AnalysisRequest containing question_id, question_text, and answer_text
            context: gRPC context
            
        Returns:
            AnalysisResponse with sentiment score, label, and extracted ideas
        """
        from . import analytics_pb2 as analytics_pb2
        
        try:
            # Support multiple answers: request.answer_text is now a repeated field
            answers = list(request.answer_text) if hasattr(request, 'answer_text') else []

            # Fallback: if the repeated field is empty but a single scalar exists
            if not answers and getattr(request, 'answer_text', None):
                # This covers older clients sending a single answer_text
                answers = [request.answer_text]

            per_answer_results = []
            sentiment_scores = []

            for idx, ans in enumerate(answers):
                combined_text = f"{request.question_text} {ans}"
                score, label = self.sentiment_analyzer.analyze(combined_text)
                ideas = self.sentiment_analyzer.extract_answer_keywords(
                    ans,
                    request.question_text,
                )

                sentiment_scores.append(float(score))

                per_answer_results.append({
                    'index': idx,
                    'answer_text': ans,
                    'sentiment_score': float(score),
                    'sentiment_label': label,
                    'extracted_ideas': ideas
                })

                # Update sentiment stats per answer
                self.db_manager.update_sentiment_stats(label)

            aggregated_ideas = self.sentiment_analyzer.extract_top_ideas_from_clusters(
                answers,
                request.question_text,
            )
            if aggregated_ideas:
                self.db_manager.update_idea_frequency(aggregated_ideas)

            # Aggregate sentiment across answers (mean)
            if sentiment_scores:
                aggregate_score = float(sum(sentiment_scores) / len(sentiment_scores))
                if aggregate_score >= 0.6:
                    aggregate_label = "POSITIVE"
                elif aggregate_score <= 0.4:
                    aggregate_label = "NEGATIVE"
                else:
                    aggregate_label = "NEUTRAL"
            else:
                aggregate_score = 0.5
                aggregate_label = "NEUTRAL"

            # Prepare data for DB upsert
            analysis_data = {
                'question_id': request.question_id,
                'question_text': request.question_text,
                'answers': per_answer_results,
                'aggregate_sentiment_score': aggregate_score,
                'aggregate_sentiment_label': aggregate_label,
                'aggregated_extracted_ideas': aggregated_ideas
            }

            self.db_manager.save_analysis(analysis_data)

            # Build proto response
            answers_proto = [
                analytics_pb2.AnswerAnalysis(
                    index=a['index'],
                    answer_text=a['answer_text'],
                    sentiment_score=a['sentiment_score'],
                    sentiment_label=a['sentiment_label'],
                    extracted_ideas=a['extracted_ideas']
                )
                for a in per_answer_results
            ]

            return analytics_pb2.AnalysisResponse(
                question_id=request.question_id,
                answers=answers_proto,
                aggregate_sentiment_score=aggregate_score,
                aggregate_sentiment_label=aggregate_label,
                aggregated_extracted_ideas=aggregated_ideas,
                success=True
            )

        except Exception as e:
            logger.error(f"Error analyzing question: {str(e)}")
            from . import analytics_pb2 as analytics_pb2
            return analytics_pb2.AnalysisResponse(
                question_id=getattr(request, 'question_id', ''),
                success=False,
                error_message=str(e)
            )
    
    def GetSentimentStats(self, request, context):
        """
        Get sentiment statistics across all analyzed questions
        
        Args:
            request: Empty request
            context: gRPC context
            
        Returns:
            SentimentStatsResponse with aggregated sentiment data
        """
        from . import analytics_pb2 as analytics_pb2
        
        try:
            stats_data = self.db_manager.get_sentiment_stats()
            
            stats = [
                analytics_pb2.SentimentStats(
                    sentiment=stat['sentiment'],
                    count=stat['count'],
                    percentage=float(stat.get('percentage', 0))
                )
                for stat in stats_data['stats']
            ]
            
            return analytics_pb2.SentimentStatsResponse(
                stats=stats,
                total_analyzed=stats_data['total_analyzed']
            )
        
        except Exception as e:
            logger.error(f"Error getting sentiment stats: {str(e)}")
            context.abort(grpc.StatusCode.INTERNAL, str(e))
    
    def GetFrequentIdeas(self, request, context):
        """
        Get most frequent ideas/themes from all analyzed questions
        
        Args:
            request: Empty request
            context: gRPC context
            
        Returns:
            FrequentIdeasResponse with top ideas
        """
        from . import analytics_pb2 as analytics_pb2
        
        try:
            ideas_data = self.db_manager.get_frequent_ideas(limit=20)
            
            ideas = [
                analytics_pb2.IdeaFrequency(
                    idea=idea['idea'],
                    frequency=idea['frequency'],
                    percentage=float(idea.get('percentage', 0))
                )
                for idea in ideas_data['ideas']
            ]
            
            return analytics_pb2.FrequentIdeasResponse(
                ideas=ideas,
                total_ideas=ideas_data['total_ideas']
            )
        
        except Exception as e:
            logger.error(f"Error getting frequent ideas: {str(e)}")
            context.abort(grpc.StatusCode.INTERNAL, str(e))
