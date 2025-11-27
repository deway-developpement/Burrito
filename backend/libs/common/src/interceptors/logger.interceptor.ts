/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { RedisContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RedisLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('REDIS');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    const rpcContext = context.switchToRpc();
    const redisContext = rpcContext.getContext<RedisContext>();
    const rawChannel = redisContext.getChannel();
    const channel = JSON.parse(rawChannel).cmd;

    // Log when request is received
    this.logger.log(`Incoming message on channel "${channel}".`);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `Handled message in ${Date.now() - now}ms on channel ${channel}.`,
          );
        },
        error: (err) => {
          this.logger.warn(
            `Error handling message after ${Date.now() - now}ms on channel ${channel}: ${err?.message}`,
          );
        },
      }),
    );
  }
}
