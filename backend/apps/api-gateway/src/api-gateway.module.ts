import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { DirectiveLocation, GraphQLDirective, GraphQLString } from 'graphql';
import { ConfigModule } from '@nestjs/config';
import { configuration } from '@app/common';
import { validation } from '@app/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { LoggerMiddleware } from './logger/logger.middleware';
import { setHttpPlugin } from './plugins/graphQL.plugin';
import { join } from 'path';
import { ApiGatewayService } from './api-gateway.service';
import { ApiGatewayController } from './api-gateway.controller';
import { FormModule } from './form/form.module';
import {
  makeCounterProvider,
  PrometheusModule,
} from '@willsoto/nestjs-prometheus';
import { MetricsController } from '@app/common';
import { PrometheusService } from '@app/common';
import { EvaluationModule } from './evaluation/evaluation.module';
import { LoggerModule } from 'nestjs-pino';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        base: { service: 'api-gateway' },
        autoLogging: false,
        redact: ['req.headers.authorization'],
      },
    }),
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [configuration.configuration],
      isGlobal: true,
      validationSchema: validation.validationSchema,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: false,
      debug: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      buildSchemaOptions: {
        directives: [
          new GraphQLDirective({
            name: 'auth',
            locations: [
              DirectiveLocation.OBJECT,
              DirectiveLocation.FIELD_DEFINITION,
            ],
            args: {
              role: { type: GraphQLString },
            },
          }),
        ],
      },
    }),
    PrometheusModule.register({ defaultMetrics: { enabled: true } }),
    UserModule,
    FormModule,
    EvaluationModule,
    AnalyticsModule,
    AuthModule,
  ],
  controllers: [ApiGatewayController, MetricsController],
  providers: [
    ApiGatewayService,
    setHttpPlugin,
    PrometheusService,
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total HTTP requests through the gateway',
      labelNames: ['method', 'route', 'status'],
    }),
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
