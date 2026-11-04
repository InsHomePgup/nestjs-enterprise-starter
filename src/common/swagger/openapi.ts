import { readFileSync } from 'node:fs';
import { STATUS_CODES } from 'node:http';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ERROR_CODE_DEFINITIONS, ErrorCode } from '../constants/error-code.enum';
import { SKIP_ENVELOPE_EXTENSION } from '../decorators/skip-response-transform.decorator';
import { ErrorResponseDto } from '../dto/api-response.dto';
import { ERROR_CODES_EXTENSION, ERROR_CODES_EXTENSION_PREFIX } from './api-errors.decorator';

// OpenAPI sub-types derived from the public OpenAPIObject (deep imports are not exported).
type PathItemObject = OpenAPIObject['paths'][string];
type OperationObject = NonNullable<PathItemObject['get']>;
type ResponseObject = Extract<
  NonNullable<OperationObject['responses']>[string],
  { description: string }
>;
type MediaTypeObject = NonNullable<ResponseObject['content']>[string];
type SchemaOrReference = NonNullable<MediaTypeObject['schema']>;
type SchemaObject = Exclude<SchemaOrReference, { $ref: string }>;
type ExampleObject = Exclude<NonNullable<MediaTypeObject['examples']>[string], { $ref: string }>;

/** Tag descriptions shown in Swagger UI; keys must match the controllers' @ApiTags. */
const TAGS: Record<string, string> = {
  app: '服务信息',
  auth: '认证：注册、登录、令牌刷新、登出、找回密码',
  users: '用户管理（仅管理员）',
  health: '健康检查（不经过统一响应包装）',
};

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head'] as const;

/** Errors any endpoint can produce (global throttler, unexpected failures, DB outage). */
const ALWAYS_POSSIBLE: ErrorCode[] = [
  ErrorCode.COMMON_TOO_MANY_REQUESTS,
  ErrorCode.COMMON_INTERNAL_ERROR,
  ErrorCode.COMMON_SERVICE_UNAVAILABLE,
];
const WITH_BODY: ErrorCode[] = [
  ErrorCode.COMMON_VALIDATION_FAILED,
  ErrorCode.COMMON_MALFORMED_JSON,
  ErrorCode.COMMON_PAYLOAD_TOO_LARGE,
];
const WITH_PARAMS: ErrorCode[] = [ErrorCode.COMMON_VALIDATION_FAILED];

const EXAMPLE_REQUEST_ID = '4f1c2a9e-7b3d-4e8a-9c1f-2d5e6a7b8c9d';
const EXAMPLE_TIMESTAMP = '2026-11-04T02:00:00.000Z';

/** Version shown in the docs = package.json version (bumped by release-it). */
export function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function envelope(data: SchemaOrReference, status: number): SchemaObject {
  return {
    type: 'object',
    required: ['statusCode', 'data', 'path', 'requestId', 'timestamp'],
    properties: {
      statusCode: { type: 'integer', example: status, description: 'HTTP 状态码' },
      data,
      path: { type: 'string', example: '/api/...', description: '请求路径' },
      requestId: {
        type: 'string',
        example: EXAMPLE_REQUEST_ID,
        description: '请求 ID，与响应头 `X-Request-Id` 相同',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        example: EXAMPLE_TIMESTAMP,
        description: '服务端时间',
      },
    },
  };
}

function exampleDetails(code: ErrorCode) {
  if (code === ErrorCode.COMMON_VALIDATION_FAILED) {
    return [{ field: 'email', rule: 'isEmail', message: 'email must be an email' }];
  }
  if (code === ErrorCode.COMMON_CONFLICT) {
    return [{ field: 'email', rule: 'unique', message: 'email already exists' }];
  }
  return undefined;
}

function errorResponse(status: number, codes: ErrorCode[], path: string): ResponseObject {
  const examples: Record<string, ExampleObject> = {};
  for (const code of codes) {
    const def = ERROR_CODE_DEFINITIONS[code];
    const details = exampleDetails(code);
    examples[code] = {
      summary: code,
      description: def.description,
      value: {
        statusCode: status,
        code,
        message: def.message,
        ...(details ? { details } : {}),
        error: STATUS_CODES[status],
        path,
        requestId: EXAMPLE_REQUEST_ID,
        timestamp: EXAMPLE_TIMESTAMP,
      },
    };
  }

  return {
    description: [
      '可能的错误码：',
      '',
      ...codes.map((code) => `- \`${code}\`：${ERROR_CODE_DEFINITIONS[code].description}`),
    ].join('\n'),
    content: {
      'application/json': {
        schema: {
          allOf: [
            { $ref: '#/components/schemas/ErrorResponseDto' },
            {
              type: 'object',
              properties: { code: { type: 'string', enum: codes } },
            },
          ],
        },
        examples,
      },
    },
  };
}

/**
 * The Swagger plugin puts the whole JSDoc block into `summary`. Use the first paragraph as
 * the summary (short title in Swagger UI / generated client) and the rest as description.
 */
function splitSummary(operation: OperationObject): void {
  if (!operation.summary || operation.description) {
    return;
  }
  const [first, ...rest] = operation.summary.trim().split(/\n\s*\n/);
  operation.summary = first.trim();
  const description = rest.join('\n\n').trim();
  if (description) {
    operation.description = description;
  }
}

function processOperation(operation: OperationObject, path: string): void {
  splitSummary(operation);
  const extensions = operation as OperationObject & Record<string, unknown>;
  const skipEnvelope = extensions[SKIP_ENVELOPE_EXTENSION] === true;
  delete extensions[SKIP_ENVELOPE_EXTENSION];

  // 1) Success responses: describe the envelope the TransformInterceptor actually returns.
  for (const [status, response] of Object.entries(operation.responses ?? {})) {
    const statusCode = Number(status);
    const content = (response as ResponseObject).content?.['application/json'];
    if (skipEnvelope || statusCode < 200 || statusCode >= 300 || !content?.schema) {
      continue;
    }
    content.schema = envelope(content.schema, statusCode);
  }

  // 2) Error responses: declared codes (from every @ApiErrors / @Auth, method or class level)
  //    + codes implied by the operation's shape.
  const declared: ErrorCode[] = [];
  for (const key of Object.keys(extensions)) {
    if (key.startsWith(ERROR_CODES_EXTENSION_PREFIX)) {
      declared.push(...(extensions[key] as ErrorCode[]));
      delete extensions[key];
    }
  }
  const implied = [
    ...(operation.requestBody ? WITH_BODY : []),
    ...(operation.parameters?.length ? WITH_PARAMS : []),
    ...ALWAYS_POSSIBLE,
  ];
  const codes = [...new Set([...declared, ...implied])];
  extensions[ERROR_CODES_EXTENSION] = codes;

  const byStatus = new Map<number, ErrorCode[]>();
  for (const code of codes) {
    const status = ERROR_CODE_DEFINITIONS[code].status;
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }
  operation.responses ??= {};
  for (const [status, statusCodes] of [...byStatus].sort(([a], [b]) => a - b)) {
    // Never overwrite a response the handler documents itself (e.g. the health check's 503).
    if (!operation.responses[status]) {
      operation.responses[status] = errorResponse(status, statusCodes, path);
    }
  }
}

function describeErrorCodeEnum(document: OpenAPIObject): void {
  const schema = document.components?.schemas?.ErrorCode as
    | (SchemaObject & Record<string, unknown>)
    | undefined;
  if (!schema) {
    return;
  }
  const codes = Object.values(ErrorCode);
  // Understood by openapi-generator, orval and others to emit per-member doc comments.
  schema['x-enum-varnames'] = codes;
  schema['x-enum-descriptions'] = codes.map((code) => ERROR_CODE_DEFINITIONS[code].description);
  schema.description = [
    '业务错误码。同一个错误码永远对应同一个 HTTP 状态码。',
    '',
    '| 错误码 | HTTP | 说明 |',
    '|---|---|---|',
    ...codes.map(
      (code) =>
        `| \`${code}\` | ${ERROR_CODE_DEFINITIONS[code].status} | ${ERROR_CODE_DEFINITIONS[code].description} |`,
    ),
  ].join('\n');
}

/** Rewrites the raw Nest document so it matches what clients actually receive. */
export function postProcessDocument(document: OpenAPIObject): OpenAPIObject {
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = item[method];
      if (operation) {
        processOperation(operation, path);
      }
    }
  }
  describeErrorCodeEnum(document);
  return document;
}

/**
 * Builds the OpenAPI document served at /docs and exported as openapi.json.
 * The app must already have its global prefix applied (see configureApp).
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = app.get(ConfigService);

  const builder = new DocumentBuilder()
    .setTitle(config.get<string>('app.name') ?? 'API')
    .setDescription(
      [
        config.get<string>('app.description') ?? '',
        '',
        '- 成功响应统一包装为 `{ statusCode, data, path, requestId, timestamp }`，业务数据在 `data` 中。',
        '- 错误响应统一为 `ErrorResponseDto`，前端以 `code` 作为分支依据；每个接口都列出了可能返回的错误码。',
        '- 每个响应都带 `X-Request-Id` 响应头；反馈问题时请附上。',
      ].join('\n'),
    )
    .setVersion(readPackageVersion())
    .addBearerAuth();
  for (const [name, description] of Object.entries(TAGS)) {
    builder.addTag(name, description);
  }

  const document = SwaggerModule.createDocument(app, builder.build(), {
    extraModels: [ErrorResponseDto],
    // e.g. AuthController.login -> "auth_login" (clean function names in generated clients)
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '').replace(/^./, (c) => c.toLowerCase())}_${methodKey}`,
  });
  return postProcessDocument(document);
}
