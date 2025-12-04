import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { QueryService } from '@nestjs-query/core';
import { MongooseQueryService } from '@nestjs-query/query-mongoose';
import { Evaluation } from './entities/evaluation.entity';

@Injectable()
@QueryService(Evaluation)
export class EvaluationService extends MongooseQueryService<Evaluation> {
  constructor(
    @InjectModel(Evaluation.name)
    private readonly evaluationModel: Model<Evaluation>,
    @Inject('USER_SERVICE')
    private readonly userServiceClient: ClientProxy,
  ) {
    super(evaluationModel);
  }

  async createOne(dto: Partial<Evaluation>): Promise<Evaluation> {
    const respondentToken = await this.getRespondentToken(dto);
    try {
      return await super.createOne({ ...dto, respondentToken });
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
      return await super.createMany(hashedDtos);
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
}
