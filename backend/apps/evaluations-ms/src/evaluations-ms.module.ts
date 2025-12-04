import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { configuration, validation, MetricsController, PrometheusService } from '@app/common';
import { EvaluationsMsController } from './evaluations-ms.controller';
import { EvaluationsMsService } from './evaluations-ms.service';
import { EvaluationModule } from './evaluation/evaluation.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [configuration.configuration],
      isGlobal: true,
      validationSchema: validation.validationSchema,
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: `mongodb://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.MONGODB_MODE == 'docker' ? process.env.MONGODB_CONTAINER_NAME : 'localhost'}:${process.env.MONGODB_PORT}/${process.env.DATABASE_NAME}?authSource=admin`,
      }),
    }),
    PrometheusModule.register({ defaultMetrics: { enabled: true } }),
    EvaluationModule,
  ],
  controllers: [EvaluationsMsController, MetricsController],
  providers: [EvaluationsMsService, PrometheusService],
})
export class EvaluationsMsModule {}
