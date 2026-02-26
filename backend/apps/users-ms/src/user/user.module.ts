import { Module } from '@nestjs/common';
import { User, UserSchema } from './entities/user.entity';
import { NestjsQueryGraphQLModule } from '@nestjs-query/query-graphql';
import { NestjsQueryMongooseModule } from '@nestjs-query/query-mongoose';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    NestjsQueryGraphQLModule.forFeature({
      imports: [
        NestjsQueryMongooseModule.forFeature([
          {
            document: User,
            name: User.name,
            schema: UserSchema,
          },
        ]),
        ClientsModule.registerAsync([
          {
            name: 'NOTIFICATIONS_EVENTS',
            useFactory: () => ({
              transport: Transport.REDIS,
              options: {
                port: parseInt(process.env.REDIS_PORT || '6379'),
                host: process.env.REDIS_HOST || 'localhost',
                retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '1000000'),
                retryDelay: parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000'),
              },
            }),
          },
        ]),
      ],
      services: [UserService],
    }),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
