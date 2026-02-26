import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import {
  Notification,
  NotificationSchema,
} from './entities/notification.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    ClientsModule.registerAsync([
      {
        name: 'USER_SERVICE',
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
      {
        name: 'GROUPS_SERVICE',
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
      {
        name: 'FORM_SERVICE',
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
      {
        name: 'EVALUATION_SERVICE',
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
  controllers: [NotificationController],
  providers: [NotificationService],
})
export class NotificationModule {}
