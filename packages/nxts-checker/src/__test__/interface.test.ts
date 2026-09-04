import { isNil } from 'aidly';
import { describe, expect, it } from 'vitest';
import { checkSource, typeSymbol, valueSymbol } from './utils';

describe('checkInterfaces', () => {
  it('interns matching atom interfaces as one type', async () => {
    const { bind, check } = await checkSource(
      'interface A { title: string }\ninterface B { title: string }\nconst named: A = { title: "a" };\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const a = typeSymbol(file, 'A');
    const b = typeSymbol(file, 'B');
    const named = valueSymbol(file, 'named');
    const aType = checked.symbolTypes[a?.id ?? -1];
    const bType = checked.symbolTypes[b?.id ?? -1];

    expect(aType).not.toBeNull();
    expect(bType).toBe(aType);
    expect(checked.symbolTypes[named?.id ?? -1]).toBe(aType);
    expect(check.types[aType ?? -1]).toMatchObject({ kind: 'interface' });
  });

  it('hangs methods and call signatures', async () => {
    const { bind, check } = await checkSource(
      'interface Box { n: number; size(): number }\ninterface Fn { (value: number): string }\ninterface Mixed { n: number; (value: number): string }\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const box =
      check.types[checked.symbolTypes[typeSymbol(file, 'Box')?.id ?? -1] ?? -1];
    const fn =
      check.types[checked.symbolTypes[typeSymbol(file, 'Fn')?.id ?? -1] ?? -1];
    const mixed =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Mixed')?.id ?? -1] ?? -1
      ];
    const boxProps = !isNil(box) && 'props' in box ? box.props : [];
    const size = boxProps.find((prop) => prop.key === 'size') ?? null;
    const mixedCalls = !isNil(mixed) && 'calls' in mixed ? mixed.calls : [];

    expect(box).toMatchObject({ kind: 'interface' });
    expect(size).toMatchObject({ role: 'method' });
    expect(check.types[size?.type ?? -1]).toMatchObject({ kind: 'function' });
    expect(fn).toMatchObject({ kind: 'function' });
    expect(mixed).toMatchObject({ kind: 'interface' });
    expect(mixedCalls).toHaveLength(1);
    expect(check.types[mixedCalls[0] ?? -1]).toMatchObject({
      kind: 'function',
    });
  });

  it('hangs construct signatures', async () => {
    const { bind, check } = await checkSource(
      'interface Factory { new (n: number): string }\ninterface Built { n: number; new (n: number): string }\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const factory =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Factory')?.id ?? -1] ?? -1
      ];
    const built =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Built')?.id ?? -1] ?? -1
      ];
    const constructs =
      !isNil(built) && 'constructs' in built ? built.constructs : [];

    expect(factory).toMatchObject({ kind: 'construct' });
    expect(built).toMatchObject({ kind: 'interface' });
    expect(constructs).toHaveLength(1);
    expect(check.types[constructs[0] ?? -1]).toMatchObject({
      kind: 'construct',
    });
  });

  it('flattens extends without type arguments', async () => {
    const { bind, check } = await checkSource(
      'interface Named { title: string }\ninterface Counted { n: number }\ninterface Row extends Named, Counted { ok: boolean }\ninterface Child extends Named { title: number }\n',
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const row =
      check.types[checked.symbolTypes[typeSymbol(file, 'Row')?.id ?? -1] ?? -1];
    const child =
      check.types[
        checked.symbolTypes[typeSymbol(file, 'Child')?.id ?? -1] ?? -1
      ];
    const rowProps = !isNil(row) && 'props' in row ? row.props : [];
    const childTitle = (
      !isNil(child) && 'props' in child ? child.props : []
    ).find((prop) => prop.key === 'title');

    expect(row).toMatchObject({ kind: 'interface' });
    expect(rowProps.map((prop) => prop.key).sort()).toEqual([
      'n',
      'ok',
      'title',
    ]);
    expect(child).toMatchObject({ kind: 'interface' });
    expect(check.types[childTitle?.type ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
  });

  it('leaves generic heritage unhung', async () => {
    const { bind, check } = await checkSource(
      'interface Cell<T> { value: T }\ninterface Box extends Cell<number> {}\n',
    );
    const file = bind.files[0];
    const box = typeSymbol(file, 'Box');

    expect(check.files[0]?.symbolTypes[box?.id ?? -1] ?? null).toBeNull();
  });
});
