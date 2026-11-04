import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Swagger CLI plugin options', () => {
  it('nest-cli.json uses the same options as swagger-plugin.options.js (used by e2e)', () => {
    const root = join(__dirname, '../../..');
    const nestCli = JSON.parse(readFileSync(join(root, 'nest-cli.json'), 'utf8'));
    const plugin = nestCli.compilerOptions.plugins.find(
      (p: { name: string }) => p.name === '@nestjs/swagger',
    );
    expect(plugin.options).toEqual(require(join(root, 'swagger-plugin.options.js')));
  });
});
