import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { RedisContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  SpanKind,
  SpanStatusCode,
  context as otelContext,
  trace,
} from '@opentelemetry/api';
import { extractRpcContext, unwrapRpcEnvelope } from '../rpc/rpc-client';

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

    const data: unknown = rpcContext.getData<unknown>();
    const { payload, metadata } = unwrapRpcEnvelope(data);
    const args = context.getArgs();
    if (args.length > 0) {
      args[0] = payload;
    }
    const parentContext = extractRpcContext(metadata);
    const tracer = trace.getTracer('burrito.redis-rpc-consumer');

    return new Observable((observer) =>
      otelContext.with(parentContext, () =>
        tracer.startActiveSpan(
          `redis.rpc.consume ${channel}`,
          {
            kind: SpanKind.CONSUMER,
            attributes: {
              'messaging.system': 'redis',
              'messaging.destination': channel,
              'db.system': 'redis',
              'db.operation': 'subscribe',
            },
          },
          (span) => {
            let spanEnded = false;
            const endSpan = () => {
              if (!spanEnded) {
                spanEnded = true;
                span.end();
              }
            };
            const spanContext = span.spanContext();
            const traceLogFields = {
              trace_id: spanContext.traceId,
              span_id: spanContext.spanId,
            };

            this.logger.info(
              { channel, ...traceLogFields },
              'Incoming message',
            );

            const subscription = next.handle().subscribe({
              next: (value) => observer.next(value),
              error: (err) => {
                span.recordException(err as Error);
                span.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: err instanceof Error ? err.message : String(err),
                });
                this.logger.warn(
                  {
                    channel,
                    durationMs: Date.now() - now,
                    err: err instanceof Error ? err.message : String(err),
                    ...traceLogFields,
                  },
                  'Error handling message',
                );
                endSpan();
                observer.error(err);
              },
              complete: () => {
                this.logger.info(
                  {
                    channel,
                    durationMs: Date.now() - now,
                    ...traceLogFields,
                  },
                  'Handled message',
                );
                endSpan();
                observer.complete();
              },
            });

            return () => {
              subscription.unsubscribe();
              endSpan();
            };
          },
        ),
      ),
    );
  }
}
