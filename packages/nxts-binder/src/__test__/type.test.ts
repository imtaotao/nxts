import type {
  CallExpression,
  ExpressionStatement,
  FunctionDeclaration,
  Identifier,
  TSAsExpression,
  TSInterfaceDeclaration,
  TSSatisfiesExpression,
  TSConditionalType,
  TSInferType,
  TSPropertySignature,
  TSTypeAliasDeclaration,
  TSTypeLiteral,
  TSTypeQuery,
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

describe('type', () => {
  it('binds a type alias to a later annotation', async () => {
    const { file, bound } = await bindSource(
      'type User = number; const n: User = 1;',
    );
    const alias = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id as Identifier;

    expect(scopeKindOf(bound, 'User')).toBe('module');
    expect(sameSymbol(bound, file, alias.id, typeRefOf(n))).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('hoists a type alias before later statements', async () => {
    const { file, bound } = await bindSource(
      'const n: User = 1; type User = number;',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id as Identifier;
    const alias = file.ast.program.body[1] as TSTypeAliasDeclaration;

    expect(sameSymbol(bound, file, alias.id, typeRefOf(n))).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('allows the same name in type and value space', async () => {
    const { file, bound } = await bindSource(
      'type Config = number; const Config = 1;',
    );
    const alias = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const value = (file.ast.program.body[1] as VariableDeclaration)
      .declarations[0].id;

    expect(sameSymbol(bound, file, alias.id, value)).toBe(false);
    expect(
      bound.symbols
        .filter((symbol) => symbol.name === 'Config')
        .map((symbol) => symbol.space)
        .sort(),
    ).toEqual(['type', 'value']);
    expect(bound.diagnostics).toEqual([]);
  });

  it('reports a duplicate type-space name', async () => {
    const { file, bound } = await bindSource(
      'type User = number; type User = string;',
    );
    const first = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const second = file.ast.program.body[1] as TSTypeAliasDeclaration;

    expect(sameSymbol(bound, file, first.id, second.id)).toBe(false);
    expect(diagnosticIds(bound)).toEqual(['binder.duplicate']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['User']);
  });

  it('leaves an unresolved type name unbound', async () => {
    const { file, bound } = await bindSource('const n: Missing = 1;');
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id as Identifier;

    expect(symbolOf(bound, file, typeRefOf(n))).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['Missing']);
  });

  it('binds as and satisfies type names', async () => {
    const { file, bound } = await bindSource(
      'type User = number; const a = 1 as User; const b = 1 satisfies User;',
    );
    const alias = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const asType = (
      (file.ast.program.body[1] as VariableDeclaration).declarations[0]
        .init as TSAsExpression
    ).typeAnnotation as TSTypeReference;
    const satisfiesType = (
      (file.ast.program.body[2] as VariableDeclaration).declarations[0]
        .init as TSSatisfiesExpression
    ).typeAnnotation as TSTypeReference;

    expect(sameSymbol(bound, file, alias.id, asType.typeName)).toBe(true);
    expect(sameSymbol(bound, file, alias.id, satisfiesType.typeName)).toBe(
      true,
    );
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a type argument on a call', async () => {
    const { file, bound } = await bindSource(
      'type User = number; function f() {} f<User>();',
    );
    const alias = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const call = (file.ast.program.body[2] as ExpressionStatement)
      .expression as CallExpression;
    const arg = call.typeArguments?.params[0] as TSTypeReference;

    expect(sameSymbol(bound, file, alias.id, arg.typeName)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a type parameter on an alias', async () => {
    const { file, bound } = await bindSource('type Box<T> = T;');
    const alias = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const param = alias.typeParameters?.params[0].name;
    const rhs = alias.typeAnnotation as TSTypeReference;

    expect(scopeKindOf(bound, 'T')).toBe('typeParams');
    expect(sameSymbol(bound, file, param, rhs.typeName)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a type parameter on a function', async () => {
    const { file, bound } = await bindSource(
      'function f<T>(x: T) { return x; }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const typeParams = fn.typeParameters;
    if (typeParams?.type !== 'TSTypeParameterDeclaration') {
      throw new Error('expected TS type parameters');
    }
    const param = typeParams.params[0].name;
    const x = fn.params[0] as Identifier;

    expect(scopeKindOf(bound, 'T')).toBe('typeParams');
    expect(sameSymbol(bound, file, param, typeRefOf(x))).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds typeof to a value name', async () => {
    const { file, bound } = await bindSource('const n = 1; type T = typeof n;');
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const alias = file.ast.program.body[1] as TSTypeAliasDeclaration;
    const query = alias.typeAnnotation as TSTypeQuery;

    expect(sameSymbol(bound, file, n, query.exprName)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds infer names in the true branch only', async () => {
    const { file, bound } = await bindSource(
      'type Box<T> = { value: T }; type Value<T> = T extends Box<infer U> ? U : T;',
    );
    const alias = file.ast.program.body[1] as TSTypeAliasDeclaration;
    const cond = alias.typeAnnotation as TSConditionalType;
    const inferType = (cond.extendsType as TSTypeReference).typeArguments
      ?.params[0] as TSInferType;

    expect(scopeKindOf(bound, 'U')).toBe('infer');
    expect(
      sameSymbol(
        bound,
        file,
        inferType.typeParameter.name,
        (cond.trueType as TSTypeReference).typeName,
      ),
    ).toBe(true);
    expect(
      sameSymbol(
        bound,
        file,
        alias.typeParameters?.params[0].name,
        (cond.falseType as TSTypeReference).typeName,
      ),
    ).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not see infer names in the false branch', async () => {
    const { file, bound } = await bindSource(
      'type Bad<T> = T extends infer U ? U : U;',
    );
    const cond = (file.ast.program.body[0] as TSTypeAliasDeclaration)
      .typeAnnotation as TSConditionalType;

    expect(
      symbolOf(bound, file, (cond.falseType as TSTypeReference).typeName),
    ).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['U']);
  });

  it('reuses the same infer name in one conditional', async () => {
    const { file, bound } = await bindSource(
      'type Values<T> = T extends { left: infer U; right: infer U } ? U : never;',
    );
    const cond = (file.ast.program.body[0] as TSTypeAliasDeclaration)
      .typeAnnotation as TSConditionalType;
    const members = (cond.extendsType as TSTypeLiteral).members;
    const left = (
      (members[0] as TSPropertySignature).typeAnnotation
        ?.typeAnnotation as TSInferType
    ).typeParameter.name;
    const right = (
      (members[1] as TSPropertySignature).typeAnnotation
        ?.typeAnnotation as TSInferType
    ).typeParameter.name;

    expect(sameSymbol(bound, file, left, right)).toBe(true);
    expect(
      sameSymbol(
        bound,
        file,
        left,
        (cond.trueType as TSTypeReference).typeName,
      ),
    ).toBe(true);
    expect(diagnosticIds(bound)).toEqual([]);
  });

  it('binds an infer constraint type name', async () => {
    const { file, bound } = await bindSource(
      'type Num = number; type Idx<T> = T extends `${infer N extends Num}` ? N : never;',
    );
    const num = file.ast.program.body[0] as TSTypeAliasDeclaration;
    const cond = (file.ast.program.body[1] as TSTypeAliasDeclaration)
      .typeAnnotation as TSConditionalType;
    const inferType = (cond.extendsType as { types: TSInferType[] }).types[0];

    expect(
      sameSymbol(
        bound,
        file,
        inferType.typeParameter.name,
        (cond.trueType as TSTypeReference).typeName,
      ),
    ).toBe(true);
    expect(
      sameSymbol(
        bound,
        file,
        num.id,
        (inferType.typeParameter.constraint as TSTypeReference).typeName,
      ),
    ).toBe(true);
    expect(scopeKindOf(bound, 'N')).toBe('infer');
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds an interface name and its extends clause', async () => {
    const { file, bound } = await bindSource(
      'interface Base {} interface User extends Base { n: number; }',
    );
    const base = file.ast.program.body[0] as TSInterfaceDeclaration;
    const user = file.ast.program.body[1] as TSInterfaceDeclaration;

    expect(scopeKindOf(bound, 'User')).toBe('module');
    expect(
      sameSymbol(bound, file, base.id, user.extends?.[0]?.expression),
    ).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});
