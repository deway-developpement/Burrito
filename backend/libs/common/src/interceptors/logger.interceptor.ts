/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RedisContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getActiveTraceLogFields } from '../telemetry/telemetry';

@Injectable()
export class RedisLoggerInterceptor implements NestInterceptor {
  constructor(
    @InjectPinoLogger(RedisLoggerInterceptor.name)
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }
    const now = Date.now();

    const rpcContext = context.switchToRpc();
    const redisContext = rpcContext.getContext<RedisContext>();
    if (!redisContext || typeof redisContext.getChannel !== 'function') {
      return next.handle();
    }
    const rawChannel = redisContext.getChannel();
    let channel = 'unknown';
    if (typeof rawChannel === 'string') {
      try {
        const parsed = JSON.parse(rawChannel) as { cmd?: string };
        channel = parsed?.cmd || rawChannel;
      } catch {
        channel = rawChannel;
      }
    } else if (rawChannel && typeof rawChannel === 'object') {
      channel = (rawChannel as { cmd?: string }).cmd || String(rawChannel);
    }

    // Log when request is received
    this.logger.info({ channel, ...getActiveTraceLogFields() }, 'Incoming message');

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.info(
            { channel, durationMs: Date.now() - now, ...getActiveTraceLogFields() },
            'Handled message',
          );
        },
        error: (err) => {
          this.logger.warn(
            {
              channel,
              durationMs: Date.now() - now,
              err: err?.message,
              ...getActiveTraceLogFields(),
            },
            'Error handling message',
          );
        },
      }),
    );
  }
}
