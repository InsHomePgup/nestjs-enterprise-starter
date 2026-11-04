import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const SKIP_RESPONSE_TRANSFORM = 'skipResponseTransform';
/** Tells the OpenAPI post-processor not to wrap this operation's responses in the envelope. */
export const SKIP_ENVELOPE_EXTENSION = 'x-skip-envelope';

/**
 * Returns the handler's value as-is instead of `{ statusCode, data, path, requestId, timestamp }`.
 * Use for endpoints whose shape is dictated externally (health checks, webhooks, file streams).
 */
export const SkipResponseTransform = () =>
  applyDecorators(
    SetMetadata(SKIP_RESPONSE_TRANSFORM, true),
    ApiExtension(SKIP_ENVELOPE_EXTENSION, true),
  );
