/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RedisContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class RedisLoggerInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(RedisLoggerInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    const rpcContext = context.switchToRpc();
    const redisContext = rpcContext.getContext<RedisContext>();
    const rawChannel = redisContext.getChannel();
    const channel = JSON.parse(rawChannel).cmd;

    // Log when request is received
    this.logger.info({ channel }, 'Incoming message');

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.info(
            { channel, durationMs: Date.now() - now },
            'Handled message',
          );
        },
        error: (err) => {
          this.logger.warn(
            { channel, durationMs: Date.now() - now, err: err?.message },
            'Error handling message',
          );
        },
      }),
    );
  }
}
