import { describe, expect, it } from 'vitest';
import { atomEnv, checkSource, typeSymbol, valueSymbol } from './utils';

describe('checkFunctions', () => {
  it('hangs function params, returns, and the function symbol', async () => {
    const { bind, check } = await checkSource(
      'function f(n: i32): number { return 1; }\nconst g = (m: i32): i32 => m;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const f = valueSymbol(file, 'f');
    const n = valueSymbol(file, 'n');
    const m = valueSymbol(file, 'm');
    const g = valueSymbol(file, 'g');
    const fType = checked.symbolTypes[f?.id ?? -1];
    const nType = checked.symbolTypes[n?.id ?? -1];
    const mType = checked.symbolTypes[m?.id ?? -1];

    expect(nType).not.toBeNull();
    expect(mType).toBe(nType);
    expect(check.types[nType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(fType).not.toBeNull();
    expect(check.types[fType ?? -1]).toMatchObject({
      kind: 'function',
    });
    expect(checked.symbolTypes[g?.id ?? -1]).toBeNull();
  });

  it('matches function declarations to function type aliases', async () => {
    const { bind, check } = await checkSource(
      'type Rest = (initial: i32, ...values: i32[]) => i32;\nfunction rest(initial: i32, ...values: i32[]): i32 { return initial; }\ntype Format = (this: string, value: i32) => string;\nfunction format(this: string, value: i32): string { return this; }\ntype Take = (row: { b: i32 }) => i32;\nfunction take({ b }: { b: i32 }): i32 { return b; }\ntype Option = (id: i32, key?: string) => void;\nfunction option(id: i32, key?: string): void {}\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const rest = checked.symbolTypes[typeSymbol(file, 'Rest')?.id ?? -1];
    const format = checked.symbolTypes[typeSymbol(file, 'Format')?.id ?? -1];
    const take = checked.symbolTypes[typeSymbol(file, 'Take')?.id ?? -1];
    const option = checked.symbolTypes[typeSymbol(file, 'Option')?.id ?? -1];
    const values = valueSymbol(file, 'values');
    const b = valueSymbol(file, 'b');

    expect(checked.symbolTypes[valueSymbol(file, 'rest')?.id ?? -1]).toBe(rest);
    expect(checked.symbolTypes[valueSymbol(file, 'format')?.id ?? -1]).toBe(
      format,
    );
    expect(checked.symbolTypes[valueSymbol(file, 'take')?.id ?? -1]).toBe(take);
    expect(checked.symbolTypes[valueSymbol(file, 'option')?.id ?? -1]).toBe(
      option,
    );
    expect(
      check.types[checked.symbolTypes[values?.id ?? -1] ?? -1],
    ).toMatchObject({
      kind: 'array',
      readonly: false,
    });
    expect(check.types[checked.symbolTypes[b?.id ?? -1] ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
  });
});
