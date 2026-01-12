import time
import grpc

# Wait briefly for server/proto generation
time.sleep(2)

try:
    from intelligence import analytics_pb2, analytics_pb2_grpc
except Exception as e:
    print('Failed to import generated protos:', e)
    raise


def run_test():
    channel = grpc.insecure_channel('localhost:50051')
    stub = analytics_pb2_grpc.AnalyticsServiceStub(channel)

    req = analytics_pb2.AnalysisRequest()
    req.question_id = 'q-test-1'
    req.question_text = 'What did you think of the new interface?'
    req.answer_text.extend([
        'I absolutely loved it — the design is fantastic and very intuitive.',
        'It was okay, but there were some problems and I did not enjoy the flow.'
    ])

    try:
        resp = stub.AnalyzeQuestion(req)
        print('Response success:', resp.success)
        print('Aggregate sentiment:', resp.aggregate_sentiment_label, resp.aggregate_sentiment_score)
        print('Aggregated ideas:', list(resp.aggregated_extracted_ideas))
        print('Cluster summaries:', [(c.summary, c.count) for c in resp.cluster_summaries])
        print('Per-answer results:')
        for a in resp.answers:
            print(f'  index={a.index} label={a.sentiment_label} score={a.sentiment_score} ideas={list(a.extracted_ideas)}')
    except Exception as e:
        print('gRPC call failed:', e)


if __name__ == '__main__':
    run_test()
