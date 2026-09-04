import { describe, expect, it } from 'vitest';
import { checkSource } from './utils';

describe('checkProgram', () => {
  it('returns tables aligned to binder files', async () => {
    const { bind, check } = await checkSource('const n: i32 = 1;\n');
    const file = bind.files[0];
    const checked = check.files[0];

    expect(check.types).toEqual([]);
    expect(check.complete).toBe(false);
    expect(check.diagnosticsTruncated).toBe(false);
    expect(checked.symbolTypes).toHaveLength(file.symbols.length);
    expect(checked.nodeTypes).toHaveLength(file.nodeToSymbols.length);
    expect(checked.nodeReachable).toHaveLength(file.nodeToSymbols.length);
    expect(checked.nodeConstants).toHaveLength(file.nodeToSymbols.length);
    expect(checked.symbolTypes.every((id) => id == null)).toBe(true);
    expect(checked.complete).toBe(false);
  });
});
