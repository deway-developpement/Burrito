export type IntelligenceRequestEvent = {
  jobId: string;
  formId: string;
  snapshotId: string;
  windowKey: string;
  questionId: string;
  questionText: string;
  answers: string[];
  analysisHash: string;
  createdAt: string;
};

export type IntelligenceResultEvent = {
  jobId: string;
  formId: string;
  snapshotId: string;
  windowKey: string;
  questionId: string;
  analysisHash: string;
  success: boolean;
  topIdeas?: Array<{ idea: string; count: number }>;
  sentiment?: {
    positivePct: number;
    neutralPct: number;
    negativePct: number;
  };
  analysisError?: string;
  lastEnrichedAt?: string;
  modelVersion?: string;
};

export type StreamMessage = {
  id: string;
  payload: string;
};
