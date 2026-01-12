import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { QueryService } from '@nestjs-query/core';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { Evaluation } from './entities/evaluation.entity';
import type { IGroupForm, IMembership } from '@app/common';

@Injectable()
@QueryService(Evaluation)
export class EvaluationService extends MongooseQueryService<Evaluation> {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(
    @InjectModel(Evaluation.name)
    private readonly evaluationModel: Model<Evaluation>,
    @Inject('USER_SERVICE')
    private readonly userServiceClient: ClientProxy,
    @Inject('GROUPS_SERVICE')
    private readonly groupsServiceClient: ClientProxy,
    @Inject('NOTIFICATIONS_EVENTS')
    private readonly notificationsClient: ClientProxy,
  ) {
    super(evaluationModel);
  }

  async createOne(dto: Partial<Evaluation>): Promise<Evaluation> {
    const respondentToken = await this.getRespondentToken(dto);
    try {
      const created = await super.createOne({ ...dto, respondentToken });
      this.emitEvaluationSubmitted(dto, created);
      if (created.formId) {
        void this.checkAndEmitFormCompleted(created.formId);
      }
      return created;
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  async createMany(dtos: Partial<Evaluation>[]): Promise<Evaluation[]> {
    const hashedDtos = await Promise.all(
      dtos.map(async (dto) => {
        const respondentToken = await this.getRespondentToken(dto);
        return { ...dto, respondentToken };
      }),
    );
    try {
      const created = await super.createMany(hashedDtos);
      created.forEach((evaluation, index) => {
        this.emitEvaluationSubmitted(dtos[index], evaluation);
      });
      const formIds = Array.from(
        new Set(created.map((evaluation) => evaluation.formId).filter(Boolean)),
      );
      formIds.forEach((formId) => {
        if (formId) {
          void this.checkAndEmitFormCompleted(formId);
        }
      });
      return created;
    } catch (error) {
      this.handleDuplicateKey(error);
      throw error;
    }
  }

  private async getRespondentToken(
    dto: Partial<Evaluation>,
  ): Promise<string | undefined> {
    if (!dto.respondentToken || !dto.formId) {
      return dto.respondentToken;
    }

    return firstValueFrom(
      this.userServiceClient.send<string>(
        { cmd: 'auth.generateFormHash' },
        {
          userId: dto.respondentToken,
          formId: dto.formId,
        },
      ),
    );
  }

  private handleDuplicateKey(error: any) {
    // Mongo duplicate key error code
    if ((error as { code?: number })?.code === 11000) {
      throw new RpcException({ status: 409, message: 'Duplicate key error' });
    }
  }

  async userRespondedToForm(formId: string, userId: string): Promise<boolean> {
    const respondentToken = await this.getRespondentToken({
      respondentToken: userId,
      formId,
    });
    return await this.evaluationModel
      .exists({
        formId,
        respondentToken,
      })
      .then((exist) => exist !== null);
  }

  private emitEvaluationSubmitted(
    dto: Partial<Evaluation>,
    created: Evaluation,
  ) {
    const respondentUserId =
      typeof dto.respondentToken === 'string' &&
      isValidObjectId(dto.respondentToken)
        ? dto.respondentToken
        : undefined;
    const payload = {
      eventId: created.id,
      formId: created.formId,
      evaluationId: created.id,
      respondentUserId,
      occurredAt: new Date().toISOString(),
    };
    void firstValueFrom(
      this.notificationsClient.emit('evaluation.submitted', payload),
    ).catch((error) => {
      this.logger.warn(
        `Failed to emit evaluation.submitted: ${this.describeError(error)}`,
      );
    });
  }

  private async checkAndEmitFormCompleted(formId: string): Promise<void> {
    try {
      const groupForms = await firstValueFrom(
        this.groupsServiceClient.send<IGroupForm[]>(
          { cmd: 'groupForm.listByForm' },
          formId,
        ),
      );
      const groupIds = Array.from(
        new Set(groupForms.map((groupForm) => groupForm.groupId)),
      );
      if (groupIds.length === 0) {
        return;
      }

      const memberships = await firstValueFrom(
        this.groupsServiceClient.send<IMembership[]>(
          { cmd: 'membership.listByGroups' },
          groupIds,
        ),
      );
      const memberIds = Array.from(
        new Set(memberships.map((membership) => membership.memberId)),
      );
      if (memberIds.length === 0) {
        return;
      }

      const respondentTokens = await Promise.all(
        memberIds.map((memberId) =>
          this.getRespondentToken({
            respondentToken: memberId,
            formId,
          }),
        ),
      );
      const tokens = respondentTokens.filter((token): token is string =>
        Boolean(token),
      );
      if (tokens.length === 0) {
        return;
      }

      const respondedTokens = await this.evaluationModel.distinct(
        'respondentToken',
        {
          formId,
          respondentToken: { $in: tokens },
        },
      );

      if (respondedTokens.length !== tokens.length) {
        return;
      }

      const payload = {
        eventId: `${formId}:completed`,
        formId,
        occurredAt: new Date().toISOString(),
      };
      void firstValueFrom(
        this.notificationsClient.emit('form.completed', payload),
      ).catch((error) => {
        this.logger.warn(
          `Failed to emit form.completed: ${this.describeError(error)}`,
        );
      });
    } catch (error) {
      this.logger.warn(
        `Failed to evaluate form completion: ${this.describeError(error)}`,
      );
    }
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
}
