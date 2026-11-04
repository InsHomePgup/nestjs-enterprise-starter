import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderErrorCodesMarkdown } from '../src/common/constants/error-code.docs';

const target = join(__dirname, '..', 'docs', 'error-codes.md');
writeFileSync(target, renderErrorCodesMarkdown());
console.log(`[docs:errors] wrote ${target}`);
