import type {
  TSTypeAliasDeclaration,
  TSTypeReference,
  VariableDeclaration,
} from '@babel/types';
import { createSnapshot, parseFile } from '@nxts/parser';
import { describe, expect, it } from 'vitest';
import { bindProgram, type BindEnv } from '../index';
import { bindSource, diagnosticIds, sameSymbol, symbolOf } from './utils';

const env: BindEnv = {
  symbols: [
    { name: 'Array', space: 'value', builtinId: 'Array' },
    { name: 'Partial', space: 'type', builtinId: 'Partial' },
  ],
};

describe('env', () => {
  it('does not open a global scope when env is empty', async () => {
    const { bound } = await bindSource('const n = 1;');
    expect(bound.scopes[0]).toMatchObject({ kind: 'module', parent: null });
  });

  it('leaves a global name unresolved without env', async () => {
    const { file, bound } = await bindSource('const a = Array;');
    const init = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].init;

    expect(symbolOf(bound, file, init)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
  });

  it('binds a value from env', async () => {
    const { file, bound } = await bindSource('const a = Array;', env);
    const init = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].init;
    const id = symbolOf(bound, file, init);

    expect(bound.scopes[0]).toMatchObject({ kind: 'global', parent: null });
    expect(bound.scopes[1]).toMatchObject({ kind: 'module', parent: 0 });
    expect(id).not.toBe(null);
    expect(bound.symbols[id ?? -1]).toMatchObject({
      name: 'Array',
      space: 'value',
      declNodeId: null,
      builtinId: 'Array',
    });
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a type from env', async () => {
    const { file, bound } = await bindSource('type T = Partial<string>;', env);
    const alias = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const typeName = (alias.typeAnnotation as TSTypeReference).typeName;
    const id = symbolOf(bound, file, typeName);

    expect(id).not.toBe(null);
    expect(bound.symbols[id ?? -1]).toMatchObject({
      name: 'Partial',
      space: 'type',
      builtinId: 'Partial',
    });
    expect(bound.diagnostics).toEqual([]);
  });

  it('lets a local declaration shadow env', async () => {
    const { file, bound } = await bindSource(
      'type Partial<T> = T; type X = Partial<string>;',
      env,
    );
    const local = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const alias = file.ast.program.body[1] as TSTypeAliasDeclaration;
    const typeName = (alias.typeAnnotation as TSTypeReference).typeName;
    const localId = symbolOf(bound, file, local.id);

    expect(sameSymbol(bound, file, local.id, typeName)).toBe(true);
    expect(bound.symbols[localId ?? -1]?.builtinId).toBe(null);
    expect(bound.diagnostics).toEqual([]);
  });

  it('passes env through bindProgram', async () => {
    const snapshot = await createSnapshot({
      utf8: new TextEncoder().encode('const a = Array;'),
      canonicalPath: 'a.ts',
      fileId: 1,
    });
    const file = parseFile(snapshot);
    const program = bindProgram([file], [], env);
    const init = (file.ast?.program.body[0] as VariableDeclaration)
      .declarations[0].init;
    const bound = program.files[0];
    const id = symbolOf(bound, file, init);

    expect(bound.symbols[id ?? -1]?.builtinId).toBe('Array');
    expect(bound.diagnostics).toEqual([]);
  });
});
