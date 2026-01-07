import { Controller, UseFilters } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { RpcToHttpFilter } from '@app/common';
import { AnalyticsService } from './analytics.service';

export type AnalyticsWindow = {
  from?: Date | string;
  to?: Date | string;
};

export type GetFormSnapshotRequest = {
  formId: string;
  window?: AnalyticsWindow;
  forceSync?: boolean;
};

@UseFilters(RpcToHttpFilter)
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @MessagePattern({ cmd: 'analytics.getFormSnapshot' })
  getFormSnapshot(data: GetFormSnapshotRequest) {
    return this.analyticsService.getFormSnapshot(data, { forceRefresh: false });
  }

  @MessagePattern({ cmd: 'analytics.refreshSnapshot' })
  refreshSnapshot(data: GetFormSnapshotRequest) {
    return this.analyticsService.getFormSnapshot(data, { forceRefresh: true });
  }
}
