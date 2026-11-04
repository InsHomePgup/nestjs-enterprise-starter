import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('resolves with the value when the work finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('rejects when the work hangs', async () => {
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow('Timed out after 20ms');
  });
});
