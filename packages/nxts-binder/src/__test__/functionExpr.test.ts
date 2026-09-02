import type {
  ArrowFunctionExpression,
  AssignmentPattern,
  BinaryExpression,
  BlockStatement,
  CallExpression,
  ExpressionStatement,
  FunctionExpression,
  ObjectExpression,
  ObjectMethod,
  RestElement,
  ReturnStatement,
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

const initOf = (
  file: Awaited<ReturnType<typeof bindSource>>['file'],
  index: number,
) => (file.ast.program.body[index] as VariableDeclaration).declarations[0].init;

describe('function expression', () => {
  it('binds an arrow expression body', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; const f = (a) => n + a;',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const arrow = initOf(file, 1) as ArrowFunctionExpression;
    const body = arrow.body as BinaryExpression;

    expect(scopeKindOf(bound, 'a')).toBe('function');
    expect(sameSymbol(bound, file, n, body.left)).toBe(true);
    expect(sameSymbol(bound, file, arrow.params[0], body.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds an arrow block body', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; const f = (a) => { return n + a; };',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const arrow = initOf(file, 1) as ArrowFunctionExpression;
    const ret = (arrow.body as BlockStatement).body[0] as ReturnStatement;
    const sum = ret.argument as BinaryExpression;

    expect(sameSymbol(bound, file, n, sum.left)).toBe(true);
    expect(sameSymbol(bound, file, arrow.params[0], sum.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a function expression and keeps its name inside', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; const f = function g(a) { return g(n + a); }; g;',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const expr = initOf(file, 1) as FunctionExpression;
    const ret = expr.body.body[0] as ReturnStatement;
    const call = ret.argument as CallExpression;
    const sum = call.arguments[0] as BinaryExpression;
    const leak = (file.ast.program.body[2] as ExpressionStatement).expression;

    expect(scopeKindOf(bound, 'g')).toBe('function');
    expect(sameSymbol(bound, file, expr.id, call.callee)).toBe(true);
    expect(sameSymbol(bound, file, n, sum.left)).toBe(true);
    expect(sameSymbol(bound, file, expr.params[0], sum.right)).toBe(true);
    expect(symbolOf(bound, file, leak)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['g']);
  });

  it('does not hoist a function expression name', async () => {
    const { file, bound } = await bindSource(
      'let m = g; const f = function g() {};',
    );
    const m = (file.ast.program.body[0] as VariableDeclaration).declarations[0];

    expect(symbolOf(bound, file, m.init)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['g']);
  });

  it('binds an object method body', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; const o = { m(a) { return n + a; } };',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const method = (initOf(file, 1) as ObjectExpression)
      .properties[0] as ObjectMethod;
    const ret = method.body.body[0] as ReturnStatement;
    const sum = ret.argument as BinaryExpression;

    expect(sameSymbol(bound, file, n, sum.left)).toBe(true);
    expect(sameSymbol(bound, file, method.params[0], sum.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds default and rest parameter names', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; const f = (a = n, ...b) => a + b;',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const arrow = initOf(file, 1) as ArrowFunctionExpression;
    const first = arrow.params[0] as AssignmentPattern;
    const rest = arrow.params[1] as RestElement;
    const body = arrow.body as BinaryExpression;

    expect(sameSymbol(bound, file, n, first.right)).toBe(true);
    expect(sameSymbol(bound, file, first.left, body.left)).toBe(true);
    expect(sameSymbol(bound, file, rest.argument, body.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not leak arrow parameters to the outer scope', async () => {
    const { file, bound } = await bindSource('const f = (a) => a; a;');
    const arrow = initOf(file, 0) as ArrowFunctionExpression;
    const leak = (file.ast.program.body[1] as ExpressionStatement).expression;

    expect(sameSymbol(bound, file, arrow.params[0], arrow.body)).toBe(true);
    expect(symbolOf(bound, file, leak)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['a']);
  });
});
