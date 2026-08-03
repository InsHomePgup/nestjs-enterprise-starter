const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      throw new Error(`Invalid duration string: ${value}`);
    }
    return numeric;
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit];
}
