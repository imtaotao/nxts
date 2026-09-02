import type {
  ExpressionStatement,
  Identifier,
  MemberExpression,
  TSEnumDeclaration,
  VariableDeclaration,
} from '@babel/types';
import { describe, expect, it } from 'vitest';
import {
  bindSource,
  diagnosticIds,
  sameSymbol,
  scopeKindOf,
  symbolOf,
  symbolsOf,
} from './utils';

const typeRefOf = (node: Identifier) => {
  const annotation = node.typeAnnotation;
  if (annotation?.type !== 'TSTypeAnnotation') {
    return null;
  }
  const type = annotation.typeAnnotation;
  if (type.type !== 'TSTypeReference') {
    return null;
  }
  return type.typeName;
};

const spacesOf = (
  bound: Awaited<ReturnType<typeof bindSource>>['bound'],
  file: Awaited<ReturnType<typeof bindSource>>['file'],
  node?: Identifier | null,
) =>
  symbolsOf(bound, file, node)
    .map((id) => bound.symbols[id]?.space)
    .sort();

describe('enum', () => {
  it('binds an enum name in type and value space', async () => {
    const { file, bound } = await bindSource(
      'enum State { On } const n: State = State.On;',
    );
    const decl = file.ast.program.body[0] as TSEnumDeclaration;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id as Identifier;
    const member = (file.ast.program.body[1] as VariableDeclaration)
      .declarations[0].init as MemberExpression;

    expect(scopeKindOf(bound, 'State')).toBe('module');
    expect(spacesOf(bound, file, decl.id)).toEqual(['type', 'value']);
    expect(sameSymbol(bound, file, decl.id, typeRefOf(n))).toBe(true);
    expect(sameSymbol(bound, file, decl.id, member.object)).toBe(true);
    expect(sameSymbol(bound, file, typeRefOf(n), member.object)).toBe(false);
    expect(symbolOf(bound, file, member.property)).toBe(null);
    expect(bound.diagnostics).toEqual([]);
  });

  it('hoists an enum type but not its value', async () => {
    const { file, bound } = await bindSource(
      'const n: State = State; enum State { On }',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0];
    const decl = file.ast.program.body[1] as TSEnumDeclaration;

    expect(
      sameSymbol(bound, file, decl.id, typeRefOf(n.id as Identifier)),
    ).toBe(true);
    expect(symbolOf(bound, file, n.init)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['State']);
  });

  it('binds a later member initializer to a previous member', async () => {
    const { file, bound } = await bindSource('enum State { On, Off = On }');
    const decl = file.ast.program.body[0] as TSEnumDeclaration;
    const on = decl.body.members[0].id;
    const off = decl.body.members[1];

    expect(scopeKindOf(bound, 'On')).toBe('enum');
    expect(sameSymbol(bound, file, on, off.initializer)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not hoist a member before its declaration', async () => {
    const { file, bound } = await bindSource('enum State { Off = On, On }');
    const off = (file.ast.program.body[0] as TSEnumDeclaration).body.members[0];

    expect(symbolOf(bound, file, off.initializer)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['On']);
  });

  it('does not leak an enum member to the outer scope', async () => {
    const { file, bound } = await bindSource('enum State { On } On;');
    const leak = (file.ast.program.body[1] as ExpressionStatement).expression;

    expect(symbolOf(bound, file, leak)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['On']);
  });

  it('binds a member initializer to an outer value', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; enum State { On = n }',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const on = (file.ast.program.body[1] as TSEnumDeclaration).body.members[0];

    expect(sameSymbol(bound, file, n, on.initializer)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a const enum the same way as a plain enum', async () => {
    const { file, bound } = await bindSource(
      'const enum State { On } const n: State = State.On;',
    );
    const decl = file.ast.program.body[0] as TSEnumDeclaration;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id as Identifier;
    const member = (file.ast.program.body[1] as VariableDeclaration)
      .declarations[0].init as MemberExpression;

    expect(sameSymbol(bound, file, decl.id, typeRefOf(n))).toBe(true);
    expect(sameSymbol(bound, file, decl.id, member.object)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not leak a block enum to the outer scope', async () => {
    const { file, bound } = await bindSource('{ enum State { On } } State;');
    const leak = (file.ast.program.body[1] as ExpressionStatement).expression;

    expect(symbolOf(bound, file, leak)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['State']);
  });

  it('reports a duplicate enum name and a duplicate member', async () => {
    const { file, bound } = await bindSource(
      'enum State { On } enum State { On, On }',
    );
    const first = file.ast.program.body[0] as TSEnumDeclaration;
    const second = file.ast.program.body[1] as TSEnumDeclaration;

    expect(sameSymbol(bound, file, first.id, second.id)).toBe(false);
    expect(diagnosticIds(bound)).toEqual([
      'binder.duplicate',
      'binder.duplicate',
      'binder.duplicate',
    ]);
  });
});
