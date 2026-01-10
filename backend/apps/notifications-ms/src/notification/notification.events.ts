export type BaseEvent = {
  eventId: string;
  occurredAt?: string | Date;
};

export type FormEvent = BaseEvent & {
  formId: string;
};

export type FormReminderEvent = FormEvent & {
  reminderId?: string;
};

export type EvaluationSubmittedEvent = BaseEvent & {
  formId: string;
  evaluationId: string;
  respondentUserId?: string;
};

export type AnalyticsDigestReadyEvent = BaseEvent & {
  userId: string;
  periodStart: string | Date;
  periodEnd: string | Date;
  reportUrl?: string;
  highlightsHtml?: string;
};
