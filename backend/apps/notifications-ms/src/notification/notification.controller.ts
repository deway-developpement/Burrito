import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import type {
  AnalyticsDigestReadyEvent,
  EvaluationSubmittedEvent,
  FormEvent,
  FormReminderEvent,
} from './notification.events';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('form.published')
  async onFormPublished(event: FormEvent): Promise<void> {
    await this.notificationService.handleFormPublished(event);
  }

  @EventPattern('form.reminder')
  async onFormReminder(event: FormReminderEvent): Promise<void> {
    await this.notificationService.handleFormReminder(event);
  }

  @EventPattern('form.closed')
  async onFormClosed(event: FormEvent): Promise<void> {
    await this.notificationService.handleFormClosed(event);
  }

  @EventPattern('form.completed')
  async onFormCompleted(event: FormEvent): Promise<void> {
    await this.notificationService.handleFormCompleted(event);
  }

  @EventPattern('evaluation.submitted')
  async onEvaluationSubmitted(event: EvaluationSubmittedEvent): Promise<void> {
    await this.notificationService.handleEvaluationSubmitted(event);
  }

  @EventPattern('analytics.digest.ready')
  async onAnalyticsDigestReady(
    event: AnalyticsDigestReadyEvent,
  ): Promise<void> {
    await this.notificationService.handleAnalyticsDigestReady(event);
  }

  @Get('failures')
  async failures(@Query('limit') limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 50;
    return this.notificationService.getRecentFailures(
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.notificationService.getNotificationById(id);
  }
}
