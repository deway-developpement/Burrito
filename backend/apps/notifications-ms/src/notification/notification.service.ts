import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Model } from 'mongoose';
import { Queue, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import {
  Observable,
  TimeoutError,
  catchError,
  firstValueFrom,
  timeout,
} from 'rxjs';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';
import type {
  IGroupForm,
  IMembership,
  IUser,
  IForm,
  INotificationPreferences,
} from '@app/common';
import {
  Notification,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';
import type {
  AnalyticsDigestReadyEvent,
  EmailVerificationEvent,
  EvaluationSubmittedEvent,
  FormEvent,
  FormReminderEvent,
  WelcomeEmailEvent,
} from './notification.events';
import { emailVerificationTemplate } from './email-verification.template';
import { welcomeUserTemplate } from './welcome-user.template';

const DEFAULT_TIMEOUT_MS = 5000;

type Recipient = {
  userId?: string;
  email: string;
  fullName?: string;
  preferences?: INotificationPreferences;
};

type TemplateContext = {
  subject: string;
  headline: string;
  message: string;
  details?: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
};

type NotificationPayload = {
  event: Record<string, unknown>;
  template: TemplateContext;
};

type NotificationJobData = {
  notificationId: string;
};

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private htmlTemplate?: Handlebars.TemplateDelegate<TemplateContext>;
  private textTemplate?: Handlebars.TemplateDelegate<TemplateContext>;
  private transporter?: nodemailer.Transporter;
  private queue?: Queue<NotificationJobData>;
  private worker?: Worker<NotificationJobData>;

  private readonly queueEnabled =
    (process.env.NOTIFICATIONS_QUEUE_ENABLED || 'true').toLowerCase() !==
    'false';
  private readonly retryAttempts = Math.max(
    1,
    parseInt(process.env.NOTIFICATIONS_RETRY_ATTEMPTS || '5'),
  );
  private readonly backoffMs = Math.max(
    100,
    parseInt(process.env.NOTIFICATIONS_BACKOFF_MS || '1000'),
  );
  private readonly directRetryAttempts = Math.max(
    1,
    parseInt(process.env.NOTIFICATIONS_DIRECT_RETRY_ATTEMPTS || '2'),
  );
  private readonly reminderOnlyPending =
    (
      process.env.NOTIFICATIONS_REMINDER_ONLY_PENDING || 'true'
    ).toLowerCase() === 'true';
  private readonly webAppUrl = (process.env.WEB_APP_URL || '').replace(
    /\/$/,
    '',
  );
  private readonly allowedCtaOrigins: string[];

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
    @Inject('GROUPS_SERVICE') private readonly groupsClient: ClientProxy,
    @Inject('FORM_SERVICE') private readonly formClient: ClientProxy,
    @Inject('EVALUATION_SERVICE')
    private readonly evaluationClient: ClientProxy,
  ) {
    this.allowedCtaOrigins = this.resolveAllowedCtaOrigins();
  }

  async onModuleInit(): Promise<void> {
    await this.loadTemplates();
    this.initTransporter();
    if (this.queueEnabled) {
      this.initQueue();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }

  async handleFormPublished(event: FormEvent): Promise<void> {
    await this.handleFormEvent(NotificationType.FORM_PUBLISHED, event);
  }

  async handleFormReminder(event: FormReminderEvent): Promise<void> {
    await this.handleFormEvent(NotificationType.FORM_REMINDER, event);
  }

  async handleFormClosed(event: FormEvent): Promise<void> {
    await this.handleFormEvent(NotificationType.FORM_CLOSED, event);
  }

  async handleFormCompleted(event: FormEvent): Promise<void> {
    const form = await this.fetchForm(event.formId);
    if (!form?.targetTeacherId) {
      this.logger.warn(`Form ${event.formId} has no targetTeacherId`);
      return;
    }

    const recipients = await this.fetchUsers([form.targetTeacherId]);
    await this.dispatchNotifications(
      NotificationType.FORM_COMPLETED,
      event,
      form,
      recipients,
    );
  }

  async handleEvaluationSubmitted(
    event: EvaluationSubmittedEvent,
  ): Promise<void> {
    if (!event.respondentUserId) {
      this.logger.warn(
        `evaluation.submitted missing respondentUserId for form ${event.formId}`,
      );
      return;
    }

    const [form, recipients] = await Promise.all([
      this.fetchForm(event.formId),
      this.fetchUsers([event.respondentUserId]),
    ]);

    await this.dispatchNotifications(
      NotificationType.EVALUATION_SUBMITTED,
      event,
      form,
      recipients,
    );
  }

  async handleAnalyticsDigestReady(
    event: AnalyticsDigestReadyEvent,
  ): Promise<void> {
    const recipients = await this.fetchUsers([event.userId]);
    await this.dispatchNotifications(
      NotificationType.ANALYTICS_DIGEST_READY,
      event,
      undefined,
      recipients,
    );
  }

  async handleEmailVerification(event: EmailVerificationEvent): Promise<void> {
    if (!event.email || !event.verificationUrl) {
      this.logger.warn('Email verification event missing email or URL');
      return;
    }
    const recipient: Recipient = {
      userId: event.userId,
      email: event.email,
      fullName: event.fullName,
    };
    await this.dispatchNotifications(
      NotificationType.EMAIL_VERIFICATION,
      event,
      undefined,
      [recipient],
    );
  }

  async handleWelcomeEmail(event: WelcomeEmailEvent): Promise<void> {
    if (!event.email || !event.tempPassword) {
      this.logger.warn('Welcome email event missing email or temp password');
      return;
    }
    const recipient: Recipient = {
      userId: event.userId,
      email: event.email,
      fullName: event.fullName,
    };
    await this.dispatchNotifications(
      NotificationType.WELCOME_USER,
      event,
      undefined,
      [recipient],
    );
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    return this.notificationModel.findById(id).exec();
  }

  async getRecentFailures(limit = 50): Promise<Notification[]> {
    return this.notificationModel
      .find({ status: NotificationStatus.FAILED })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  private async handleFormEvent(
    type: NotificationType,
    event: FormEvent,
  ): Promise<void> {
    const form = await this.fetchForm(event.formId);
    const recipients = await this.resolveGroupRecipients(event.formId);

    let filteredRecipients = recipients;
    if (type === NotificationType.FORM_REMINDER && this.reminderOnlyPending) {
      filteredRecipients = await this.filterPendingRecipients(
        event.formId,
        recipients,
      );
    }
    console.log(
      `Form event ${type} for form ${event.formId} - total recipients: ${recipients.length}, after filtering: ${filteredRecipients.length}`,
    );
    await this.dispatchNotifications(type, event, form, filteredRecipients);
  }

  private async resolveGroupRecipients(formId: string): Promise<Recipient[]> {
    const groupForms = await this.sendWithTimeout(
      this.groupsClient.send<IGroupForm[]>(
        { cmd: 'groupForm.listByForm' },
        formId,
      ),
    );
    const groupIds = Array.from(
      new Set(groupForms.map((groupForm) => groupForm.groupId)),
    );
    if (groupIds.length === 0) {
      return [];
    }

    const memberships = await this.sendWithTimeout(
      this.groupsClient.send<IMembership[]>(
        { cmd: 'membership.listByGroups' },
        groupIds,
      ),
    );
    const memberIds = Array.from(
      new Set(memberships.map((membership) => membership.memberId)),
    );
    if (memberIds.length === 0) {
      return [];
    }

    return this.fetchUsers(memberIds);
  }

  private async filterPendingRecipients(
    formId: string,
    recipients: Recipient[],
  ): Promise<Recipient[]> {
    const results = await Promise.all(
      recipients.map(async (recipient) => {
        if (!recipient.userId) {
          return false;
        }
        const responded = await this.sendWithTimeout(
          this.evaluationClient.send<boolean>(
            { cmd: 'evaluation.userRespondedToForm' },
            { formId, userId: recipient.userId },
          ),
        );
        return !responded;
      }),
    );

    return recipients.filter((_, index) => results[index]);
  }

  private async dispatchNotifications(
    type: NotificationType,
    event: Record<string, unknown>,
    form: IForm | undefined,
    recipients: Recipient[],
  ): Promise<void> {
    const eligible = recipients.filter((recipient) =>
      this.isEmailEnabled(recipient),
    );

    if (eligible.length === 0) {
      return;
    }

    console.log(
      `Dispatching ${type} notification to ${eligible.length} recipients for form ${form?.id}`,
    );

    await Promise.all(
      eligible.map(async (recipient) => {
        try {
          await this.createAndDispatchNotification(
            type,
            event,
            form,
            recipient,
          );
        } catch (error) {
          this.logger.warn(
            `Failed to queue notification for ${recipient.email}: ${this.describeError(error)}`,
          );
        }
      }),
    );
  }

  private async createAndDispatchNotification(
    type: NotificationType,
    event: Record<string, unknown>,
    form: IForm | undefined,
    recipient: Recipient,
  ): Promise<void> {
    const template = this.buildTemplateContext(type, form, recipient, event);
    const eventId =
      typeof event.eventId === 'string'
        ? event.eventId
        : this.deriveEventId(event, type);
    const recipientKey = recipient.userId || recipient.email;
    const idempotencyKey = `${eventId}:${recipientKey}:${type}`;

    const payload: NotificationPayload = {
      event,
      template,
    };

    let notification: Notification | null = null;
    try {
      notification = await this.notificationModel.create({
        type,
        recipientEmail: recipient.email,
        recipientUserId: recipient.userId,
        payload,
        status: NotificationStatus.QUEUED,
        idempotencyKey,
        attempts: 0,
        lastError: null,
      });
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        return;
      }
      throw error;
    }

    if (!notification) {
      return;
    }

    if (this.queueEnabled && this.queue) {
      try {
        await this.queue.add(
          'send',
          { notificationId: notification.id },
          {
            jobId: this.buildQueueJobId(idempotencyKey),
            attempts: this.retryAttempts,
            backoff: { type: 'exponential', delay: this.backoffMs },
            removeOnComplete: true,
          },
        );
        return;
      } catch (error) {
        this.logger.warn(
          `Queue add failed, sending directly: ${this.describeError(error)}`,
        );
      }
    }

    await this.sendWithRetries(notification.id);
  }

  private async sendNotification(notificationId: string): Promise<void> {
    const notification = await this.notificationModel
      .findById(notificationId)
      .exec();

    if (!notification) {
      return;
    }

    if (notification.status === NotificationStatus.SENT) {
      return;
    }

    try {
      if (!this.transporter) {
        throw new Error('SMTP transporter not configured');
      }

      const payload = notification.payload as NotificationPayload | undefined;
      if (!payload?.template) {
        throw new Error('Notification payload missing template data');
      }

      const rendered = this.renderTemplate(payload.template);
      const from = this.getFromAddress(notification.recipientEmail);

      await this.transporter.sendMail({
        from,
        to: notification.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      await this.notificationModel.updateOne(
        { _id: notification.id },
        {
          $inc: { attempts: 1 },
          $set: {
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            lastError: null,
          },
        },
      );
    } catch (error) {
      await this.notificationModel.updateOne(
        { _id: notification.id },
        {
          $inc: { attempts: 1 },
          $set: {
            status: NotificationStatus.FAILED,
            lastError: this.describeError(error),
          },
        },
      );
      throw error;
    }
  }

  private async sendWithRetries(notificationId: string): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.directRetryAttempts; attempt += 1) {
      try {
        await this.sendNotification(notificationId);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < this.directRetryAttempts) {
          await this.sleep(this.backoffMs);
        }
      }
    }
    throw lastError;
  }

  private async fetchUsers(ids: string[]): Promise<Recipient[]> {
    if (ids.length === 0) {
      return [];
    }

    const users = await this.sendWithTimeout(
      this.userClient.send<IUser[]>({ cmd: 'user.findByIds' }, ids),
    );

    return users
      .filter((user) => Boolean(user?.email))
      .map((user) => ({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        preferences: user.notificationPreferences,
      }));
  }

  private async fetchForm(formId: string): Promise<IForm | undefined> {
    if (!formId) {
      return undefined;
    }

    return this.sendWithTimeout(
      this.formClient.send<IForm | undefined>({ cmd: 'form.getById' }, formId),
    );
  }

  private isEmailEnabled(recipient: Recipient): boolean {
    if (!recipient.email) {
      return false;
    }
    if (!recipient.preferences) {
      return true;
    }
    return recipient.preferences.emailEnabled !== false;
  }

  private buildTemplateContext(
    type: NotificationType,
    form: IForm | undefined,
    recipient: Recipient,
    event: Record<string, unknown>,
  ): TemplateContext {
    const formTitle = form?.title || 'your form';
    const recipientName = recipient.fullName;
    const endDate = this.formatDate(form?.endDate);
    const startDate = this.formatDate(form?.startDate);
    const formUrl = this.sanitizeCtaUrl(
      form?.id ? this.buildFormUrl(form.id) : undefined,
    );
    const studentEvaluationUrl = this.sanitizeCtaUrl(
      form?.id ? this.buildStudentEvaluationUrl(form.id) : undefined,
    );
    const footerNote = 'Manage notification preferences in your profile.';

    switch (type) {
      case NotificationType.FORM_PUBLISHED:
        return {
          subject: `Form published: ${formTitle}`,
          headline: 'New form published',
          message: recipientName
            ? `Hi ${recipientName}, a new form is available: ${formTitle}.`
            : `A new form is available: ${formTitle}.`,
          details: endDate ? `Please submit by ${endDate}.` : undefined,
          ctaText: studentEvaluationUrl ? 'Open form' : undefined,
          ctaUrl: studentEvaluationUrl,
          footerNote,
        };
      case NotificationType.FORM_REMINDER:
        return {
          subject: `Reminder: ${formTitle}`,
          headline: 'Reminder to submit',
          message: recipientName
            ? `Hi ${recipientName}, this is a reminder to complete ${formTitle}.`
            : `This is a reminder to complete ${formTitle}.`,
          details: endDate ? `Deadline: ${endDate}.` : undefined,
          ctaText: studentEvaluationUrl ? 'Complete form' : undefined,
          ctaUrl: studentEvaluationUrl,
          footerNote,
        };
      case NotificationType.FORM_CLOSED:
        return {
          subject: `Form closed: ${formTitle}`,
          headline: 'Form closed',
          message: `The form ${formTitle} is now closed.`,
          details: endDate ? `Closed on ${endDate}.` : undefined,
          footerNote,
        };
      case NotificationType.FORM_COMPLETED:
        return {
          subject: `Form completed: ${formTitle}`,
          headline: 'All responses received',
          message: `All assigned participants have completed ${formTitle}.`,
          details: startDate ? `Started on ${startDate}.` : undefined,
          ctaText: formUrl ? 'View form' : undefined,
          ctaUrl: formUrl,
          footerNote,
        };
      case NotificationType.EVALUATION_SUBMITTED:
        return {
          subject: `Evaluation submitted: ${formTitle}`,
          headline: 'Thanks for your feedback',
          message: `Thank you for your feedback on ${formTitle}.`,
          footerNote,
        };
      case NotificationType.ANALYTICS_DIGEST_READY: {
        const periodStart = this.formatDate(event.periodStart as Date | string);
        const periodEnd = this.formatDate(event.periodEnd as Date | string);
        const reportUrl =
          typeof event.reportUrl === 'string'
            ? this.sanitizeCtaUrl(event.reportUrl)
            : undefined;
        return {
          subject: 'Analytics digest ready',
          headline: 'Your analytics digest is ready',
          message: 'New analytics insights are available.',
          details:
            periodStart && periodEnd
              ? `Coverage: ${periodStart} to ${periodEnd}.`
              : undefined,
          ctaText: reportUrl ? 'Open report' : undefined,
          ctaUrl: reportUrl,
          footerNote,
        };
      }
      case NotificationType.EMAIL_VERIFICATION: {
        const verificationUrl =
          typeof event.verificationUrl === 'string'
            ? this.sanitizeCtaUrl(event.verificationUrl)
            : undefined;
        return {
          subject: emailVerificationTemplate.subject,
          headline: emailVerificationTemplate.headline,
          message: emailVerificationTemplate.message,
          ctaText: verificationUrl
            ? emailVerificationTemplate.ctaText
            : undefined,
          ctaUrl: verificationUrl,
          footerNote: emailVerificationTemplate.footerNote,
        };
      }
      case NotificationType.WELCOME_USER: {
        const tempPassword =
          typeof event.tempPassword === 'string'
            ? event.tempPassword
            : undefined;
        const loginUrl = this.sanitizeCtaUrl(this.buildLoginUrl());
        const message = recipientName
          ? `Hi ${recipientName}, your account is ready. Use the temporary password below to sign in.`
          : 'Your account is ready. Use the temporary password below to sign in.';
        return {
          subject: welcomeUserTemplate.subject,
          headline: welcomeUserTemplate.headline,
          message,
          details: tempPassword
            ? `Temporary password: ${tempPassword}`
            : undefined,
          ctaText: loginUrl ? welcomeUserTemplate.ctaText : undefined,
          ctaUrl: loginUrl,
          footerNote: welcomeUserTemplate.footerNote,
        };
      }
      default:
        return {
          subject: 'Notification',
          headline: 'Update from Burrito',
          message: 'You have a new notification.',
        };
    }
  }

  private buildFormUrl(formId: string): string | undefined {
    if (!this.webAppUrl) {
      return undefined;
    }
    return `${this.webAppUrl}/forms/${formId}`;
  }

  private buildStudentEvaluationUrl(formId: string): string | undefined {
    if (!this.webAppUrl) {
      return undefined;
    }
    return `${this.webAppUrl}/student/evaluate/${formId}`;
  }

  private buildLoginUrl(): string | undefined {
    if (!this.webAppUrl) {
      return undefined;
    }
    return `${this.webAppUrl}/sign-in`;
  }

  private resolveAllowedCtaOrigins(): string[] {
    const candidates = [
      this.webAppUrl,
      process.env.EMAIL_VERIFICATION_URL_BASE || '',
      process.env.NOTIFICATIONS_ALLOWED_CTA_ORIGINS || '',
    ];
    const origins = candidates
      .flatMap((value) =>
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      .map((entry) => this.getOrigin(entry))
      .filter((origin): origin is string => Boolean(origin));

    return Array.from(new Set(origins));
  }

  private getOrigin(value: string): string | null {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.origin;
    } catch {
      return null;
    }
  }

  private sanitizeCtaUrl(url: string | undefined): string | undefined {
    if (!url) {
      return undefined;
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      this.logger.warn(`Blocked CTA URL (invalid): ${url}`);
      return undefined;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      this.logger.warn(`Blocked CTA URL (protocol): ${url}`);
      return undefined;
    }
    if (
      this.allowedCtaOrigins.length > 0 &&
      !this.allowedCtaOrigins.includes(parsed.origin)
    ) {
      this.logger.warn(`Blocked CTA URL (origin): ${url}`);
      return undefined;
    }
    return parsed.toString();
  }

  private buildQueueJobId(idempotencyKey: string): string {
    return createHash('sha256').update(idempotencyKey).digest('hex');
  }

  private getFromAddress(recipientEmail: string): string {
    if (this.shouldOverrideSender(recipientEmail)) {
      return 'paul.mairesse@efrei.net';
    }
    const from = process.env.SMTP_FROM;
    if (!from) {
      throw new Error('SMTP_FROM is not configured');
    }
    return from;
  }

  private shouldOverrideSender(recipientEmail: string): boolean {
    const atIndex = recipientEmail.lastIndexOf('@');
    if (atIndex < 0) {
      return false;
    }
    const domain = recipientEmail
      .slice(atIndex + 1)
      .trim()
      .toLowerCase();
    return domain === 'efrei.net' || domain.endsWith('.efrei.net');
  }

  private deriveEventId(
    event: Record<string, unknown>,
    type: NotificationType,
  ): string {
    const formId = typeof event.formId === 'string' ? event.formId : 'event';
    const occurredAt =
      typeof event.occurredAt === 'string'
        ? event.occurredAt
        : new Date().toISOString();
    return `${type}:${formId}:${occurredAt}`;
  }

  private async loadTemplates(): Promise<void> {
    const candidates = [
      path.join(
        process.cwd(),
        'dist/apps/notifications-ms/notification/templates',
      ),
      path.join(
        process.cwd(),
        'apps/notifications-ms/src/notification/templates',
      ),
      path.join(__dirname, 'notification', 'templates'),
      path.join(__dirname, 'templates'),
    ];
    let templateDir: string | undefined;
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        templateDir = candidate;
        break;
      } catch {
        continue;
      }
    }
    if (!templateDir) {
      throw new Error('Notification template directory not found');
    }

    const [html, text] = await Promise.all([
      fs.readFile(path.join(templateDir, 'notification.html.hbs'), 'utf8'),
      fs.readFile(path.join(templateDir, 'notification.txt.hbs'), 'utf8'),
    ]);
    this.htmlTemplate = Handlebars.compile(html);
    this.textTemplate = Handlebars.compile(text);
  }

  private renderTemplate(context: TemplateContext): {
    subject: string;
    html: string;
    text: string;
  } {
    if (!this.htmlTemplate || !this.textTemplate) {
      throw new Error('Templates not loaded');
    }
    return {
      subject: context.subject,
      html: this.htmlTemplate(context),
      text: this.textTemplate(context),
    };
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '0');
    if (!host || !port) {
      this.logger.warn('SMTP is not configured; emails will fail to send');
      return;
    }

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  private initQueue(): void {
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    };
    this.queue = new Queue<NotificationJobData>('notifications', {
      connection,
    });
    this.worker = new Worker<NotificationJobData>(
      'notifications',
      async (job: Job<NotificationJobData>) => {
        if (!job.data.notificationId) {
          this.logger.warn(`Notification job ${job.id} missing notificationId`);
          return;
        }
        await this.sendNotification(job.data.notificationId);
      },
      { connection },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.warn(
        `Notification job ${job?.id ?? 'unknown'} failed: ${this.describeError(error)}`,
      );
    });
  }

  private async sendWithTimeout<T>(observable: Observable<T>): Promise<T> {
    return firstValueFrom(
      observable.pipe(
        timeout(DEFAULT_TIMEOUT_MS),
        catchError((err) => {
          if (err instanceof TimeoutError) {
            throw new Error('Upstream service timed out');
          }
          if (err instanceof Error) {
            throw err;
          }
          throw new Error('Upstream service error');
        }),
      ),
    );
  }

  private formatDate(value?: Date | string): string | undefined {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date.toISOString().split('T')[0];
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }

  private async sleep(durationMs: number): Promise<void> {
    if (durationMs <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, durationMs));
  }
}
