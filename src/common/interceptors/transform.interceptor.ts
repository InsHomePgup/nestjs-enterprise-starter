import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response as ExpressResponse, Request } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_RESPONSE_TRANSFORM } from '../decorators/skip-response-transform.decorator';

export interface TransformedResponse<T> {
  statusCode: number;
  data: T;
  path: string;
  requestId: string | undefined;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, TransformedResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<TransformedResponse<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_TRANSFORM, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request & { id?: string }>();
    const response = httpContext.getResponse<ExpressResponse>();

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        data,
        path: request.url,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
