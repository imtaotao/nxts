import { describe, expect, it } from 'vitest';
import { checkSource, typeSymbol, valueSymbol } from './utils';

describe('checkAliases', () => {
  it('hangs atom aliases and follows them on variables', async () => {
    const { bind, check } = await checkSource(
      'type Count = number;\ntype A = Count;\nconst n: Count = 1;\nconst m: A = 2;\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const count = typeSymbol(file, 'Count');
    const alias = typeSymbol(file, 'A');
    const n = valueSymbol(file, 'n');
    const m = valueSymbol(file, 'm');
    const countType = checked.symbolTypes[count?.id ?? -1];
    const aliasType = checked.symbolTypes[alias?.id ?? -1];
    const nType = checked.symbolTypes[n?.id ?? -1];
    const mType = checked.symbolTypes[m?.id ?? -1];

    expect(countType).not.toBeNull();
    expect(aliasType).toBe(countType);
    expect(nType).toBe(countType);
    expect(mType).toBe(countType);
    expect(check.types[countType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
  });

  it('hangs object and union aliases', async () => {
    const { bind, check } = await checkSource(
      'type Point = { y: number; x: number };\ntype Same = { x: number; y: number };\ntype TextOrCount = string | number;\nconst point: Point = { x: 1, y: 2 };\nconst either: TextOrCount = 1;\nconst literal: { x: number } = { x: 1 };\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const pointAlias = typeSymbol(file, 'Point');
    const same = typeSymbol(file, 'Same');
    const union = typeSymbol(file, 'TextOrCount');
    const point = valueSymbol(file, 'point');
    const either = valueSymbol(file, 'either');
    const literal = valueSymbol(file, 'literal');
    const pointType = checked.symbolTypes[pointAlias?.id ?? -1];
    const sameType = checked.symbolTypes[same?.id ?? -1];
    const unionType = checked.symbolTypes[union?.id ?? -1];
    const literalType = checked.symbolTypes[literal?.id ?? -1];

    expect(pointType).not.toBeNull();
    expect(sameType).toBe(pointType);
    expect(checked.symbolTypes[point?.id ?? -1]).toBe(pointType);
    expect(check.types[pointType ?? -1]).toMatchObject({ kind: 'object' });
    expect(unionType).not.toBeNull();
    expect(checked.symbolTypes[either?.id ?? -1]).toBe(unionType);
    expect(check.types[unionType ?? -1]).toMatchObject({ kind: 'union' });
    expect(check.types[literalType ?? -1]).toMatchObject({ kind: 'object' });
    const literalRecord = check.types[literalType ?? -1];
    expect(
      literalRecord != null && 'props' in literalRecord
        ? literalRecord.props
        : [],
    ).toHaveLength(1);
  });

  it('hangs intersection aliases', async () => {
    const { bind, check } = await checkSource(
      'type Named = { title: string };\ntype Counted = { n: number };\ntype Both = Named & Counted;\nconst row: Both = { title: "a", n: 1 };\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const both = typeSymbol(file, 'Both');
    const row = valueSymbol(file, 'row');
    const bothType = checked.symbolTypes[both?.id ?? -1];

    expect(bothType).not.toBeNull();
    expect(checked.symbolTypes[row?.id ?? -1]).toBe(bothType);
    expect(check.types[bothType ?? -1]).toMatchObject({
      kind: 'intersection',
    });
    const record = check.types[bothType ?? -1];
    expect(
      record != null && 'members' in record ? record.members : [],
    ).toHaveLength(2);
  });

  it('substitutes generic aliases whose body is an object', async () => {
    const { bind, check } = await checkSource(
      'type Cell<T> = { value: T };\nconst cell: Cell<number> = { value: 1 };\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const cell = valueSymbol(file, 'cell');
    const cellType = checked.symbolTypes[cell?.id ?? -1];

    expect(check.types[cellType ?? -1]).toMatchObject({ kind: 'object' });
    const record = check.types[cellType ?? -1];
    const value = record != null && 'props' in record ? record.props[0] : null;
    expect(value).toMatchObject({ key: 'value' });
    expect(check.types[value?.type ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
  });
});
