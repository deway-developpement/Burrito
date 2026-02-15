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
import { GroupModule } from './group/group.module';
import { JsonScalar } from './scalars/json.scalar';

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
      path: '/graphQL',
      autoSchemaFile: join(process.cwd(), 'schema.gql'),
      sortSchema: true,
      playground: false,
      debug: false,
      plugins: [ApolloServerPluginLandingPageLocalDefault()],
      context: ({ req, extra }) => ({
        req: req ?? extra?.request,
      }),
      subscriptions: {
        'graphql-ws': {
          path: '/graphQL',
          onConnect: (context) => {
            const connectionParams = (context.connectionParams ??
              {}) as Record<string, unknown>;
            const headers = connectionParams.headers as
              | Record<string, unknown>
              | undefined;
            const authHeader =
              typeof connectionParams.Authorization === 'string'
                ? connectionParams.Authorization
                : typeof connectionParams.authorization === 'string'
                  ? connectionParams.authorization
                  : typeof headers?.authorization === 'string'
                    ? headers.authorization
                    : typeof headers?.Authorization === 'string'
                      ? headers.Authorization
                      : undefined;

            const extra = context.extra as
              | { request?: { headers?: Record<string, string> } }
              | undefined;
            if (extra) {
              extra.request = {
                headers: authHeader ? { authorization: authHeader } : {},
              };
            }
          },
        },
      },
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
    GroupModule,
    AuthModule,
  ],
  controllers: [ApiGatewayController, MetricsController],
  providers: [
    ApiGatewayService,
    setHttpPlugin,
    JsonScalar,
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
