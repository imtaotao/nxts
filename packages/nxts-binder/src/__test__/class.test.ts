import type {
  BlockStatement,
  ClassDeclaration,
  ClassExpression,
  ClassMethod,
  ClassProperty,
  ExpressionStatement,
  Identifier,
  NewExpression,
  ReturnStatement,
  TSClassImplements,
  TSParameterProperty,
  TSTypeAnnotation,
  TSTypeReference,
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

describe('class', () => {
  it('binds a class name in type and value space', async () => {
    const { file, bound } = await bindSource(
      'class User {} const u: User = new User();',
    );
    const decl = file.ast.program.body[0] as ClassDeclaration;
    const u = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id as Identifier;
    const constructed = (
      (file.ast.program.body[1] as VariableDeclaration).declarations[0]
        .init as NewExpression
    ).callee;

    expect(scopeKindOf(bound, 'User')).toBe('module');
    expect(spacesOf(bound, file, decl.id)).toEqual(['type', 'value']);
    expect(sameSymbol(bound, file, decl.id, typeRefOf(u))).toBe(true);
    expect(sameSymbol(bound, file, decl.id, constructed)).toBe(true);
    expect(sameSymbol(bound, file, typeRefOf(u), constructed)).toBe(false);
    expect(bound.diagnostics).toEqual([]);
  });

  it('hoists a class name in both spaces', async () => {
    const { file, bound } = await bindSource(
      'const u: User = User; class User {}',
    );
    const u = (file.ast.program.body[0] as VariableDeclaration).declarations[0];
    const decl = file.ast.program.body[1] as ClassDeclaration;

    expect(
      sameSymbol(bound, file, decl.id, typeRefOf(u.id as Identifier)),
    ).toBe(true);
    expect(sameSymbol(bound, file, decl.id, u.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds extends in value space and implements in type space', async () => {
    const { file, bound } = await bindSource(
      'interface Named {} class Animal {} class Dog extends Animal implements Named {}',
    );
    const named = file.ast.program.body[0];
    const animal = file.ast.program.body[1] as ClassDeclaration;
    const dog = file.ast.program.body[2] as ClassDeclaration;
    const implemented = dog.implements?.[0] as TSClassImplements;

    expect(sameSymbol(bound, file, animal.id, dog.superClass)).toBe(true);
    expect(
      sameSymbol(
        bound,
        file,
        named.type === 'TSInterfaceDeclaration' ? named.id : null,
        implemented.expression,
      ),
    ).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a class type parameter in members', async () => {
    const { file, bound } = await bindSource('class Box<T> { x: T }');
    const decl = file.ast.program.body[0] as ClassDeclaration;
    const typeParams = decl.typeParameters;
    if (typeParams?.type !== 'TSTypeParameterDeclaration') {
      throw new Error('expected TS type parameters');
    }
    const param = typeParams.params[0].name;
    const field = decl.body.body[0] as ClassProperty;
    const type = (field.typeAnnotation as TSTypeAnnotation)
      .typeAnnotation as TSTypeReference;

    expect(scopeKindOf(bound, 'T')).toBe('typeParams');
    expect(sameSymbol(bound, file, param, type.typeName)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds constructor params and the class name inside methods', async () => {
    const { file, bound } = await bindSource(
      'class User { constructor(name: string) { this.name = name; } m() { return User; } }',
    );
    const decl = file.ast.program.body[0] as ClassDeclaration;
    const ctor = decl.body.body[0] as ClassMethod;
    const assign = ctor.body.body[0];
    const method = decl.body.body[1] as ClassMethod;
    const ret = method.body.body[0] as ReturnStatement;
    const name = ctor.params[0] as Identifier;
    const used =
      assign.type === 'ExpressionStatement' &&
      assign.expression.type === 'AssignmentExpression'
        ? assign.expression.right
        : null;

    expect(sameSymbol(bound, file, name, used)).toBe(true);
    expect(sameSymbol(bound, file, decl.id, ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not leak a class expression name', async () => {
    const { file, bound } = await bindSource(
      'const C = class D { m() { return D; } }; D;',
    );
    const expr = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].init as ClassExpression;
    const ret = (expr.body.body[0] as ClassMethod).body
      .body[0] as ReturnStatement;
    const leak = file.ast.program.body[1];

    expect(scopeKindOf(bound, 'D')).toBe('class');
    expect(spacesOf(bound, file, expr.id)).toEqual(['type', 'value']);
    expect(sameSymbol(bound, file, expr.id, ret.argument)).toBe(true);
    expect(
      symbolOf(
        bound,
        file,
        leak.type === 'ExpressionStatement' ? leak.expression : null,
      ),
    ).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['D']);
  });

  it('reports a duplicate class name', async () => {
    const { file, bound } = await bindSource('class User {} class User {}');
    const first = file.ast.program.body[0] as ClassDeclaration;
    const second = file.ast.program.body[1] as ClassDeclaration;

    expect(sameSymbol(bound, file, first.id, second.id)).toBe(false);
    expect(diagnosticIds(bound)).toEqual([
      'binder.duplicate',
      'binder.duplicate',
    ]);
    expect(bound.diagnostics[0]?.arguments).toEqual(['User']);
  });

  it('hoists a class name inside its block scope', async () => {
    const { file, bound } = await bindSource(
      '{ const u: User = User; class User {} }',
    );
    const block = file.ast.program.body[0] as BlockStatement;
    const u = (block.body[0] as VariableDeclaration).declarations[0];
    const decl = block.body[1] as ClassDeclaration;

    expect(scopeKindOf(bound, 'User')).toBe('block');
    expect(
      sameSymbol(bound, file, decl.id, typeRefOf(u.id as Identifier)),
    ).toBe(true);
    expect(sameSymbol(bound, file, decl.id, u.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not leak a block class to the outer scope', async () => {
    const { file, bound } = await bindSource('{ class User {} } User;');
    const leak = (file.ast.program.body[1] as ExpressionStatement).expression;

    expect(symbolOf(bound, file, leak)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['User']);
  });

  it('leaves unresolved heritage names unbound', async () => {
    const { file, bound } = await bindSource(
      'class Dog extends Missing implements Ghost {}',
    );
    const dog = file.ast.program.body[0] as ClassDeclaration;
    const implemented = dog.implements?.[0] as TSClassImplements;

    expect(symbolOf(bound, file, dog.superClass)).toBe(null);
    expect(symbolOf(bound, file, implemented.expression)).toBe(null);
    expect(diagnosticIds(bound)).toEqual([
      'binder.unresolved',
      'binder.unresolved',
    ]);
    expect(bound.diagnostics.map((item) => item.arguments)).toEqual([
      ['Missing'],
      ['Ghost'],
    ]);
  });

  it('binds a field initializer and a computed member key', async () => {
    const { file, bound } = await bindSource(
      "const n = 1; const k = 'x'; class C { [k] = n }",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const k = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id;
    const field = (file.ast.program.body[2] as ClassDeclaration).body
      .body[0] as ClassProperty;

    expect(sameSymbol(bound, file, k, field.key)).toBe(true);
    expect(sameSymbol(bound, file, n, field.value)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a constructor parameter property', async () => {
    const { file, bound } = await bindSource(
      'class Point { constructor(public x: number) { return x; } }',
    );
    const ctor = (file.ast.program.body[0] as ClassDeclaration).body
      .body[0] as ClassMethod;
    const param = (ctor.params[0] as TSParameterProperty).parameter;
    const ret = ctor.body.body[0] as ReturnStatement;

    expect(sameSymbol(bound, file, param, ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('reports type and value clashes with a class name', async () => {
    const { file, bound } = await bindSource(
      'class Config {} type Config = number; const Config = 1;',
    );
    const decl = file.ast.program.body[0] as ClassDeclaration;

    expect(spacesOf(bound, file, decl.id)).toEqual(['type', 'value']);
    expect(diagnosticIds(bound)).toEqual([
      'binder.duplicate',
      'binder.duplicate',
    ]);
  });
});
