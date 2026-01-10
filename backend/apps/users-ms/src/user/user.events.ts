export type EmailVerificationEvent = {
  userId: string;
  email: string;
  fullName?: string;
  verificationUrl: string;
  eventId: string;
  occurredAt?: string | Date;
};
