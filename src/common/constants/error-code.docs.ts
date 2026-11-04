import { ERROR_CODE_DEFINITIONS, type ErrorCode } from './error-code.enum';

const MODULE_TITLES: Record<string, string> = {
  COMMON: 'COMMON：通用 / 框架层',
  AUTH: 'AUTH：认证与授权',
  USER: 'USER：用户',
};

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Renders docs/error-codes.md from ERROR_CODE_DEFINITIONS.
 * Regenerate with `pnpm docs:errors`; a unit test fails if the committed file is stale.
 */
export function renderErrorCodesMarkdown(): string {
  const groups = new Map<string, ErrorCode[]>();
  for (const code of Object.keys(ERROR_CODE_DEFINITIONS) as ErrorCode[]) {
    const prefix = code.split('_')[0];
    groups.set(prefix, [...(groups.get(prefix) ?? []), code]);
  }

  const lines: string[] = [
    '# 错误码',
    '',
    '<!-- 本文件由 `pnpm docs:errors` 根据 src/common/constants/error-code.enum.ts 自动生成，请勿手动编辑。 -->',
    '',
    '所有错误响应都使用统一结构，前端应以 `code` 作为分支依据（`message` 仅用于展示，可能调整）：',
    '',
    '```json',
    '{',
    '  "statusCode": 400,',
    '  "code": "COMMON_VALIDATION_FAILED",',
    '  "message": "Validation failed",',
    '  "details": [{ "field": "email", "rule": "isEmail", "message": "email must be an email" }],',
    '  "error": "Bad Request",',
    '  "path": "/api/auth/register",',
    '  "requestId": "4f1c2a9e-…",',
    '  "timestamp": "2026-11-04T02:00:00.000Z"',
    '}',
    '```',
    '',
    '| 字段 | 说明 |',
    '|---|---|',
    '| `statusCode` | HTTP 状态码，与响应状态一致 |',
    '| `code` | 业务错误码，见下表；**同一个错误码永远对应同一个 HTTP 状态码** |',
    '| `message` | 英文描述，可直接展示；前端需要多语言时按 `code` 自行映射 |',
    '| `details` | 可选。字段级问题列表：`field`（点分路径，如 `items.0.price`）、`rule`（失败的规则，如 `isEmail`、`unique`）、`message` |',
    '| `error` | HTTP 状态短语，如 `Bad Request` |',
    '| `requestId` | 请求 ID，与响应头 `X-Request-Id` 相同 |',
    '',
    '## 排查问题',
    '',
    '1. 从响应体或响应头 `X-Request-Id` 拿到 `requestId`。',
    '2. 在日志中按 `reqId` / `req.id` 检索，即可看到该请求的完整访问日志：方法、路径、状态码、耗时、`errorCode`、`userId`；5xx 还包含完整的异常堆栈。',
    '3. 前端可以在请求时自行带上 `X-Request-Id`（1～128 位字母、数字、`._:-`），后端会沿用该值，便于前后端日志串联。',
    '',
  ];

  for (const [prefix, codes] of groups) {
    lines.push(`## ${MODULE_TITLES[prefix] ?? prefix}`, '');
    lines.push('| 错误码 | HTTP | 默认 message | 何时出现 | 前端处理 / 排查提示 |');
    lines.push('|---|---|---|---|---|');
    for (const code of codes) {
      const def = ERROR_CODE_DEFINITIONS[code];
      lines.push(
        `| \`${code}\` | ${def.status} | ${escapeCell(def.message)} | ${escapeCell(def.description)} | ${escapeCell(def.hint)} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}
