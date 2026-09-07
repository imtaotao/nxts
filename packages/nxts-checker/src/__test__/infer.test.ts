import { isNil } from 'aidly';
import { describe, expect, it } from 'vitest';
import { checkSource, typeSymbol, valueSymbol } from './utils';

describe('Infer', () => {
  it('keeps const literals and widens let literals', async () => {
    const { bind, check } = await checkSource(
      'const n = 1;\nlet s = "a";\nconst flag = true;\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const n = checked.symbolTypes[valueSymbol(file, 'n')?.id ?? -1];
    const s = checked.symbolTypes[valueSymbol(file, 's')?.id ?? -1];
    const flag = checked.symbolTypes[valueSymbol(file, 'flag')?.id ?? -1];

    expect(check.types[n ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'numeric', value: '1' },
    });
    expect(check.types[s ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(check.types[flag ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'boolean', value: true },
    });
  });

  it('derives unique symbol from const Symbol() and widens copies', async () => {
    const { bind, check } = await checkSource(
      'const token = Symbol("token");\nconst alias = token;\nlet mutable = Symbol();\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const token = checked.symbolTypes[valueSymbol(file, 'token')?.id ?? -1];
    const alias = checked.symbolTypes[valueSymbol(file, 'alias')?.id ?? -1];
    const mutable = checked.symbolTypes[valueSymbol(file, 'mutable')?.id ?? -1];

    expect(check.types[token ?? -1]).toMatchObject({ kind: 'uniqueSymbol' });
    expect(check.types[alias ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'symbol',
    });
    expect(check.types[mutable ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'symbol',
    });
    expect(alias).not.toBe(token);
  });

  it('lets typeof read inferred bindings', async () => {
    const { bind, check } = await checkSource(
      'const n = 1;\ntype Query = typeof n;\n',
    );
    const file = bind.files[0];
    const query =
      check.files[0]?.symbolTypes[typeSymbol(file, 'Query')?.id ?? -1];

    expect(check.types[query ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'numeric', value: '1' },
    });
  });

  it('skips expressions that are not a literal, ident, or Symbol()', async () => {
    const { bind, check } = await checkSource('const n = 1 + 2;\n');
    const n = valueSymbol(bind.files[0], 'n');

    expect(check.files[0]?.symbolTypes[n?.id ?? -1] ?? null).toBeNull();
    expect(isNil(n)).toBe(false);
  });
});
