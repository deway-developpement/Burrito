/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class UserDateInterceptor implements NestInterceptor {
  private convertDates(value: unknown): unknown {
    if (value === null || value === undefined) return value;

    // Arrays → recurse on each element
    if (Array.isArray(value)) {
      return value.map((v) => this.convertDates(v));
    }

    // Non-object (string/number/boolean/Date/etc.) → return as is
    if (typeof value !== 'object') {
      return value;
    }

    // Plain object → clone, then handle each key
    const obj: any = { ...(value as Record<string, unknown>) };

    for (const key of Object.keys(obj)) {
      const val = obj[key];

      // Date fields anywhere in the tree
      if (
        (key === 'createdAt' || key === 'updatedAt') &&
        typeof val === 'string'
      ) {
        obj[key] = new Date(val);
      } else {
        // Recurse into nested objects/arrays (edges, node, pageInfo, etc.)
        obj[key] = this.convertDates(val);
      }
    }

    return obj;
  }

  intercept(_: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.convertDates(data)));
  }
}
