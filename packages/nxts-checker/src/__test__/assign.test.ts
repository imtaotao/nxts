import { isNil } from 'aidly';
import { describe, expect, it } from 'vitest';
import { atomEnv, checkSource, valueSymbol } from './utils';

describe('AnnotatedInits', () => {
  it('accepts literals that adopt the annotation context', async () => {
    const { bind, check } = await checkSource(
      'const n: i32 = 1;\nconst s: string = "a";\nconst flag: boolean = true;\nconst js: number = 1;\nconst neg: i32 = -1;\n',
      atomEnv,
    );
    const file = bind.files[0];
    const checked = check.files[0];
    const n = valueSymbol(file, 'n');
    const init = file.nodes.find((node) => {
      return (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        node.id.name === 'n'
      );
    });
    const initType =
      init?.type === 'VariableDeclarator' && !isNil(init.init)
        ? checked.nodeTypes[file.nodeIds.get(init.init) ?? -1]
        : null;

    expect(check.diagnostics).toEqual([]);
    expect(check.types[checked.symbolTypes[n?.id ?? -1] ?? -1]).toMatchObject({
      kind: 'atom',
      atom: 'i32',
    });
    expect(check.types[initType ?? -1]).toMatchObject({
      kind: 'literal',
      value: { kind: 'numeric', value: '1' },
    });
  });

  it('rejects literals that cannot adopt the annotation', async () => {
    const { check } = await checkSource(
      'const n: i32 = 1.5;\nconst s: i32 = "a";\nconst wide: i32 = 2147483648;\n',
      atomEnv,
    );

    expect(check.diagnostics.map((item) => item.messageId)).toEqual([
      'checker.notAssignable',
      'checker.notAssignable',
      'checker.notAssignable',
    ]);
    expect(check.diagnostics.every((item) => item.code === 'NXT3101')).toBe(
      true,
    );
    const first = check.diagnostics[0]?.arguments[0] as
      | { primary?: string; canonical?: { kind?: string } }
      | undefined;
    const second = check.diagnostics[0]?.arguments[1] as
      | { primary?: string }
      | undefined;
    expect(first?.canonical?.kind).toBe('literal');
    expect(second?.primary).toBe('i32');
    expect(
      JSON.stringify(check.diagnostics[0]?.arguments).includes('"id":'),
    ).toBe(false);
  });

  it('rejects hung identifiers that are not assignable', async () => {
    const { check } = await checkSource(
      'const js: number = 1;\nconst n: i32 = js;\nconst ok: number = js;\n',
      atomEnv,
    );

    expect(check.diagnostics.map((item) => item.messageId)).toEqual([
      'checker.notAssignable',
    ]);
  });

  it('skips inits that are not a literal or hung identifier', async () => {
    const { check } = await checkSource('const n: i32 = 1 + 2;\n', atomEnv);

    expect(check.diagnostics).toEqual([]);
  });
});
