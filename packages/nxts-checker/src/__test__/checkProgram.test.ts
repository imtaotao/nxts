import { createSnapshot, parseFile } from '@nxts/parser';
import { bindProgram, type BindEnv } from '@nxts/binder';
import { describe, expect, it } from 'vitest';
import { checkProgram } from '../index';

const atomEnv: BindEnv = {
  symbols: [{ name: 'i32', space: 'type', builtinId: 'i32' }],
};

const checkSource = async (code: string, env?: BindEnv) => {
  const parsed = parseFile(
    await createSnapshot({
      utf8: new TextEncoder().encode(code),
      canonicalPath: 'main.ts',
      fileId: 0,
    }),
  );
  const bind = bindProgram([parsed], [], env);
  return { bind, check: checkProgram(bind) };
};

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

  it('hangs atom annotations on const and let symbols', async () => {
    const { bind, check } = await checkSource(
      'const n: i32 = 1;\nlet m: i32 = 2;\nconst k: number = 3;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const n = file.symbols.find(
      (symbol) => symbol.name === 'n' && symbol.space === 'value',
    );
    const m = file.symbols.find(
      (symbol) => symbol.name === 'm' && symbol.space === 'value',
    );
    const k = file.symbols.find(
      (symbol) => symbol.name === 'k' && symbol.space === 'value',
    );
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
});
