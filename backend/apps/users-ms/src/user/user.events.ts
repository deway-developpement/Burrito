export type EmailVerificationEvent = {
  userId: string;
  email: string;
  fullName?: string;
  verificationUrl: string;
  eventId: string;
  occurredAt?: string | Date;
};

export type WelcomeEmailEvent = {
  userId: string;
  email: string;
  fullName?: string;
  tempPassword: string;
  eventId: string;
  occurredAt?: string | Date;
};
