import { describe, expect, it } from 'vitest';
import { atomEnv, checkSource, valueSymbol } from './utils';

describe('checkVariables', () => {
  it('hangs atom annotations on const and let symbols', async () => {
    const { bind, check } = await checkSource(
      'const n: i32 = 1;\nlet m: i32 = 2;\nconst k: number = 3;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const n = valueSymbol(file, 'n');
    const m = valueSymbol(file, 'm');
    const k = valueSymbol(file, 'k');
    const nType = checked.symbolTypes[n?.id ?? -1];
    const mType = checked.symbolTypes[m?.id ?? -1];
    const kType = checked.symbolTypes[k?.id ?? -1];

    expect(nType).not.toBeNull();
    expect(mType).toBe(nType);
    expect(kType).not.toBe(nType);
    expect(check.types[nType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[kType ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'number',
    });
    expect(checked.nodeTypes[n?.declNodeId ?? -1]).toBe(nType);
    expect(checked.nodeTypes[k?.declNodeId ?? -1]).toBe(kType);

    const typeNodeOf = (symbol: typeof n) => {
      if (symbol?.declNodeId == null) {
        return null;
      }
      const name = file.nodes[symbol.declNodeId];
      if (
        name?.type !== 'Identifier' ||
        name.typeAnnotation?.type !== 'TSTypeAnnotation'
      ) {
        return null;
      }
      return name.typeAnnotation.typeAnnotation;
    };
    const nAnn = typeNodeOf(n);
    const kAnn = typeNodeOf(k);
    expect(nAnn && checked.nodeTypes[file.nodeIds.get(nAnn) ?? -1]).toBe(nType);
    expect(kAnn && checked.nodeTypes[file.nodeIds.get(kAnn) ?? -1]).toBe(kType);
  });

  it('does not invent types for unannotated patterns', async () => {
    const { bind, check } = await checkSource('const { a } = { a: 1 };\n');
    const file = bind.files[0];
    const a = valueSymbol(file, 'a');

    expect(check.files[0]?.symbolTypes[a?.id ?? -1] ?? null).toBeNull();
  });

  it('hangs annotated object and array patterns', async () => {
    const { bind, check } = await checkSource(
      'interface Named { title: string }\nconst { title: name }: Named = { title: "a" };\nfunction f(n: i32, { b }: { b: i32 }) { return n; }\nconst [x, y]: [i32, string] = [1, "a"];\nconst [head]: i32[] = [1];\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const name = valueSymbol(file, 'name');
    const b = valueSymbol(file, 'b');
    const n = valueSymbol(file, 'n');
    const x = valueSymbol(file, 'x');
    const y = valueSymbol(file, 'y');
    const head = valueSymbol(file, 'head');

    expect(
      check.types[checked.symbolTypes[name?.id ?? -1] ?? -1],
    ).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(check.types[checked.symbolTypes[b?.id ?? -1] ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[checked.symbolTypes[n?.id ?? -1] ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[checked.symbolTypes[x?.id ?? -1] ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[checked.symbolTypes[y?.id ?? -1] ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'string',
    });
    expect(checked.symbolTypes[head?.id ?? -1] ?? null).toBeNull();
  });
});
