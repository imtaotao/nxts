import { isNil } from 'aidly';
import { describe, expect, it } from 'vitest';
import type { VariableDeclaration } from '@babel/types';
import { diagnosticIds, bindSource, symbolOf } from './utils';

describe('invalid subtree', () => {
  it('does not declare a rejected var', async () => {
    const { file, bound } = await bindSource(
      'var bad = 1; const ok = 2; const n = bad;',
    );
    const bad = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].id;
    const ok = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id;

    expect(file.invalidNodes.has(file.ast.program.body[0])).toBe(true);
    expect(symbolOf(bound, file, bad)).toBe(null);
    expect(symbolOf(bound, file, ok)).not.toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['bad']);
  });

  it('does not resolve names inside a rejected expression', async () => {
    const { file, bound } = await bindSource(
      'const n = missing == 1; const ok = n;',
    );
    const first = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0];
    const ok = (file.ast.program.body[1] as VariableDeclaration)
      .declarations[0];

    expect(!isNil(first.init) && file.invalidNodes.has(first.init)).toBe(true);
    expect(symbolOf(bound, file, first.id)).not.toBe(null);
    expect(symbolOf(bound, file, ok.id)).not.toBe(null);
    expect(diagnosticIds(bound)).toEqual([]);
  });

  it('does not export a rejected var declaration', async () => {
    const { bound } = await bindSource(
      'export var bad = 1; export const ok = 2;',
    );

    expect(bound.exports.some((item) => item.name === 'bad')).toBe(false);
    expect(bound.exports.some((item) => item.name === 'ok')).toBe(true);
  });
});
