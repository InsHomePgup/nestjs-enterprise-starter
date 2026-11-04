import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { ErrorCode } from '../src/common/constants/error-code.enum';
import { buildOpenApiDocument } from '../src/common/swagger/openapi';
import { bootstrapTestApp } from './utils/bootstrap-app';

type Operation = NonNullable<OpenAPIObject['paths'][string]['get']>;
type Schema = {
  type?: string;
  description?: string;
  properties?: Record<string, Schema>;
  $ref?: string;
  allOf?: Schema[];
  enum?: unknown[];
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Quality gate for the API contract consumed by the frontend.
 * If this fails after adding an endpoint, the message tells you what to document.
 * (Runs with the Swagger CLI plugin applied, see test/jest-e2e.json.)
 */
describe('OpenAPI document quality (e2e)', () => {
  let app: INestApplication;
  let doc: OpenAPIObject;
  const operations: Array<{ id: string; path: string; method: string; op: Operation }> = [];

  beforeAll(async () => {
    app = await bootstrapTestApp();
    doc = buildOpenApiDocument(app);
    for (const [path, item] of Object.entries(doc.paths)) {
      for (const method of METHODS) {
        const op = item[method];
        if (op) {
          operations.push({ id: `${method.toUpperCase()} ${path}`, path, method, op });
        }
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('uses the package.json version', () => {
    const { version } = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
    expect(doc.info.version).toBe(version);
  });

  it('every operation has a short summary, a tag and a unique operationId', () => {
    const problems: string[] = [];
    const ids = new Set<string>();
    for (const { id, op } of operations) {
      if (!op.summary?.trim()) problems.push(`${id}: missing summary (add a JSDoc comment)`);
      if (op.summary?.includes('\n')) problems.push(`${id}: summary must be a single line`);
      if (!op.tags?.length) problems.push(`${id}: missing @ApiTags`);
      if (!op.operationId || ids.has(op.operationId)) problems.push(`${id}: bad operationId`);
      ids.add(op.operationId ?? '');
    }
    expect(problems).toEqual([]);
  });

  it('every success response declares its body type (or is 204)', () => {
    const problems: string[] = [];
    for (const { id, op } of operations) {
      const success = Object.entries(op.responses).filter(([s]) => s.startsWith('2'));
      if (success.length === 0) problems.push(`${id}: no 2xx response`);
      for (const [status, response] of success) {
        const content = (response as { content?: Record<string, { schema?: Schema }> }).content;
        if (status !== '204' && !content?.['application/json']?.schema) {
          problems.push(`${id}: ${status} has no schema (type the handler's return value)`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('every operation documents its error responses with codes', () => {
    const problems: string[] = [];
    for (const { id, op } of operations) {
      if (!op.responses['500']) problems.push(`${id}: missing 500`);
      const codes = (op as Operation & { 'x-error-codes'?: string[] })['x-error-codes'];
      if (!codes?.length) problems.push(`${id}: missing x-error-codes`);
      if (op.security?.length && !op.responses['401']) {
        problems.push(`${id}: protected but no 401 (use @Auth() instead of raw guards)`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every DTO property has a description (write a JSDoc comment on it)', () => {
    const problems: string[] = [];
    for (const [name, schema] of Object.entries(doc.components?.schemas ?? {}) as [
      string,
      Schema,
    ][]) {
      for (const [prop, propSchema] of Object.entries(schema.properties ?? {})) {
        if (!propSchema.description?.trim()) problems.push(`${name}.${prop}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('enums are named schemas, and ErrorCode lists every code with descriptions', () => {
    const schemas = doc.components?.schemas as Record<string, Schema & Record<string, unknown>>;
    expect(schemas.Role?.enum).toEqual(['USER', 'ADMIN']);
    expect(schemas.ErrorCode?.enum).toEqual(Object.values(ErrorCode));
    expect(schemas.ErrorCode['x-enum-descriptions']).toHaveLength(Object.values(ErrorCode).length);
  });

  it('protected endpoints list the precise token error codes', () => {
    const me = operations.find((o) => o.id === 'GET /api/auth/me');
    expect(me).toBeDefined();
    const codes = (me?.op as (Operation & { 'x-error-codes'?: string[] }) | undefined)?.[
      'x-error-codes'
    ];
    expect(codes).toEqual(
      expect.arrayContaining(['AUTH_TOKEN_MISSING', 'AUTH_TOKEN_EXPIRED', 'AUTH_TOKEN_INVALID']),
    );
  });
});
