from intelligence.servicer import AnalyticsServicer
from intelligence.sentiment_analyzer import SentimentAnalyzer
from intelligence.idea_summarizer import IdeaSummarizer

class MockDB:
    def __init__(self):
        self.storage = {}
    def save_analysis(self, analysis_data):
        print('MockDB.save_analysis called')
        self.storage[analysis_data.get('question_id','')] = analysis_data
        return analysis_data.get('question_id','')
    def update_sentiment_stats(self, label):
        print('MockDB.update_sentiment_stats:', label)

class DummyRequest:
    def __init__(self, question_id, question_text, answers):
        self.question_id = question_id
        self.question_text = question_text
        # emulate repeated field: list-like
        self.answer_text = answers

class DummyContext:
    pass

def run():
    db = MockDB()
    analyzer = SentimentAnalyzer()
    summarizer = IdeaSummarizer()
    servicer = AnalyticsServicer(db, analyzer, summarizer)

    req = DummyRequest('q-local-1', 'How was the team meeting?', [
        'I thought it was excellent and very productive.',
        'It was poor, many issues and I was disappointed.'
    ])

    resp = servicer.AnalyzeQuestion(req, DummyContext())
    print('Response:', resp)
    if hasattr(resp, 'cluster_summaries'):
        print('Cluster summaries:', [(c.summary, c.count) for c in resp.cluster_summaries])
    print('Saved analysis in MockDB:', db.storage.get('q-local-1'))

if __name__ == '__main__':
    run()
