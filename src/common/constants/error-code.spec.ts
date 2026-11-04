import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderErrorCodesMarkdown } from './error-code.docs';
import { ERROR_CODE_DEFINITIONS, ErrorCode } from './error-code.enum';

describe('error code registry', () => {
  const codes = Object.values(ErrorCode);

  it('defines every code', () => {
    expect(Object.keys(ERROR_CODE_DEFINITIONS).sort()).toEqual([...codes].sort());
  });

  it('uses <MODULE>_<REASON> naming and enum value === key', () => {
    for (const [key, value] of Object.entries(ErrorCode)) {
      expect(value).toBe(key);
      expect(value).toMatch(/^[A-Z]+(_[A-Z0-9]+)+$/);
    }
  });

  it('maps every code to an error status with non-empty docs', () => {
    for (const code of codes) {
      const def = ERROR_CODE_DEFINITIONS[code];
      expect(def.status).toBeGreaterThanOrEqual(400);
      expect(def.message.trim()).not.toBe('');
      expect(def.description.trim()).not.toBe('');
      expect(def.hint.trim()).not.toBe('');
    }
  });

  it('docs/error-codes.md is up to date (run `pnpm docs:errors` if this fails)', () => {
    const committed = readFileSync(join(__dirname, '../../../docs/error-codes.md'), 'utf8');
    expect(committed).toBe(renderErrorCodesMarkdown());
  });
});
