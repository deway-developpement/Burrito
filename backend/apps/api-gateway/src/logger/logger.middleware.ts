import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    // Log after response is finished so status code reflects any downstream changes (e.g. GraphQL plugins)
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        this.logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`);
      } else {
        this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
      }
    });

    next();
  }
}
