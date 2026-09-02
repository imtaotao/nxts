import type {
  BinaryExpression,
  BlockStatement,
  ForInStatement,
  ForOfStatement,
  ForStatement,
  FunctionDeclaration,
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

describe('for', () => {
  it('keeps a classic for-let in the loop scope', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; function f() { for (let i = 0; i < n; i++) { let m = i; } return i; }',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const fn = file.ast.program.body[1] as FunctionDeclaration;
    const loop = fn.body.body[0] as ForStatement;
    const i = (loop.init as VariableDeclaration).declarations[0].id;
    const test = loop.test as BinaryExpression;
    const mInit = ((loop.body as BlockStatement).body[0] as VariableDeclaration)
      .declarations[0].init;
    const leak = (fn.body.body[1] as ReturnStatement).argument;

    expect(scopeKindOf(bound, 'i')).toBe('block');
    expect(scopeKindOf(bound, 'm')).toBe('block');
    expect(sameSymbol(bound, file, n, test.right)).toBe(true);
    expect(sameSymbol(bound, file, i, mInit)).toBe(true);
    expect(symbolOf(bound, file, leak)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['i']);
  });

  it('binds for-of and for-in loop variables', async () => {
    const { file, bound } = await bindSource(
      'function f(items, obj) { for (const x of items) { return x; } for (const k in obj) { return k; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const forOf = fn.body.body[0] as ForOfStatement;
    const forIn = fn.body.body[1] as ForInStatement;
    const x = (forOf.left as VariableDeclaration).declarations[0].id;
    const k = (forIn.left as VariableDeclaration).declarations[0].id;
    const xRet = (forOf.body as BlockStatement).body[0] as ReturnStatement;
    const kRet = (forIn.body as BlockStatement).body[0] as ReturnStatement;

    expect(scopeKindOf(bound, 'x')).toBe('block');
    expect(scopeKindOf(bound, 'k')).toBe('block');
    expect(sameSymbol(bound, file, x, xRet.argument)).toBe(true);
    expect(sameSymbol(bound, file, k, kRet.argument)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], forOf.right)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[1], forIn.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not open a for scope when the head has no declaration', async () => {
    const { file, bound } = await bindSource(
      'function f() { let i = 0; for (i = 1; i < 2; i++) { return i; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const i = (fn.body.body[0] as VariableDeclaration).declarations[0].id;
    const loop = fn.body.body[1] as ForStatement;
    const ret = (loop.body as BlockStatement).body[0] as ReturnStatement;

    expect(scopeKindOf(bound, 'i')).toBe('function');
    expect(sameSymbol(bound, file, i, ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('resolves a for-of left-hand identifier without declaring it', async () => {
    const { file, bound } = await bindSource(
      'function f(x, items) { for (x of items) { return x; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const loop = fn.body.body[0] as ForOfStatement;
    const ret = (loop.body as BlockStatement).body[0] as ReturnStatement;

    expect(sameSymbol(bound, file, fn.params[0], loop.left)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});
