/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { getActiveTraceLogFields } from '@app/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter<string>,
    @InjectPinoLogger(LoggerMiddleware.name)
    private readonly logger: PinoLogger,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    // Log after response is finished so status code reflects any downstream changes (e.g. GraphQL plugins)
    res.on('finish', () => {
      this.requestCounter.inc({
        method: req.method,
        route: req.route?.path ?? req.originalUrl,
        status: res.statusCode,
      });

      const logPayload = {
        method: req.method,
        route: req.route?.path ?? req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - start,
        ...getActiveTraceLogFields(),
      };

      if (res.statusCode >= 500) {
        this.logger.error(logPayload, 'Request failed');
      } else if (res.statusCode >= 400) {
        this.logger.warn(logPayload, 'Request returned client error');
      } else if (process.env.NODE_ENV === 'production') {
        this.logger.info(logPayload, 'Request completed');
      } else {
        this.logger.debug(logPayload, 'Request completed');
      }
    });

    next();
  }
}
