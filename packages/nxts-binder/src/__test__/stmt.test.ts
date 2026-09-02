import type {
  BinaryExpression,
  BlockStatement,
  BreakStatement,
  CallExpression,
  ExpressionStatement,
  ForStatement,
  FunctionDeclaration,
  IfStatement,
  LabeledStatement,
  ObjectPattern,
  ObjectProperty,
  ReturnStatement,
  SwitchStatement,
  ThrowStatement,
  TryStatement,
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

describe('switch', () => {
  it('shares a switch-level let across cases', async () => {
    const { file, bound } = await bindSource(
      'function f(n) { switch (n) { case 1: let m = n; break; case 2: return m; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const sw = fn.body.body[0] as SwitchStatement;
    const m = (sw.cases[0].consequent[0] as VariableDeclaration).declarations[0]
      .id;
    const ret = sw.cases[1].consequent[0] as ReturnStatement;

    expect(scopeKindOf(bound, 'm')).toBe('block');
    expect(sameSymbol(bound, file, fn.params[0], sw.discriminant)).toBe(true);
    expect(sameSymbol(bound, file, m, ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not leak a case-block let to another case', async () => {
    const { file, bound } = await bindSource(
      'function f(n) { switch (n) { case 1: { let m = n; break; } case 2: return m; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const sw = fn.body.body[0] as SwitchStatement;
    const ret = sw.cases[1].consequent[0] as ReturnStatement;

    expect(symbolOf(bound, file, ret.argument)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['m']);
  });

  it('hoists a function declared in a later case', async () => {
    const { file, bound } = await bindSource(
      'function f(n) { switch (n) { case 1: return g(); case 2: function g() {} } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const sw = fn.body.body[0] as SwitchStatement;
    const call = (sw.cases[0].consequent[0] as ReturnStatement)
      .argument as CallExpression;
    const g = sw.cases[1].consequent[0] as FunctionDeclaration;

    expect(sameSymbol(bound, file, g.id, call.callee)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});

describe('throw and try', () => {
  it('binds a throw argument', async () => {
    const { file, bound } = await bindSource('const n = 1; throw n;');
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const thrown = (file.ast.program.body[1] as ThrowStatement).argument;

    expect(sameSymbol(bound, file, n, thrown)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds a catch parameter in the catch scope', async () => {
    const { file, bound } = await bindSource(
      'function f(n) { try { throw n; } catch (e) { return e + n; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const tryStmt = fn.body.body[0] as TryStatement;
    const thrown = (tryStmt.block.body[0] as ThrowStatement).argument;
    const e = tryStmt.handler?.param;
    const sum = (tryStmt.handler?.body.body[0] as ReturnStatement)
      .argument as BinaryExpression;

    expect(scopeKindOf(bound, 'e')).toBe('catch');
    expect(sameSymbol(bound, file, fn.params[0], thrown)).toBe(true);
    expect(sameSymbol(bound, file, e, sum.left)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], sum.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('does not leak a catch parameter', async () => {
    const { file, bound } = await bindSource(
      'function f() { try {} catch (e) {} return e; }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const ret = fn.body.body[1] as ReturnStatement;

    expect(symbolOf(bound, file, ret.argument)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['e']);
  });

  it('binds a destructured catch parameter and a finally reference', async () => {
    const { file, bound } = await bindSource(
      'function f(n) { try {} catch ({ e }) { return e; } finally { n; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const tryStmt = fn.body.body[0] as TryStatement;
    const e = (
      (tryStmt.handler?.param as ObjectPattern).properties[0] as ObjectProperty
    ).value;
    const ret = tryStmt.handler?.body.body[0] as ReturnStatement;
    const finallyRef = (tryStmt.finalizer?.body[0] as ExpressionStatement)
      .expression;

    expect(sameSymbol(bound, file, e, ret.argument)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], finallyRef)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});

describe('label', () => {
  it('binds a labeled break to the label', async () => {
    const { file, bound } = await bindSource(
      'function f(n) { loop: for (;;) { if (n) break loop; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const labeled = fn.body.body[0] as LabeledStatement;
    const loop = labeled.body as ForStatement;
    const iff = (loop.body as BlockStatement).body[0] as IfStatement;
    const br = iff.consequent as BreakStatement;

    expect(sameSymbol(bound, file, labeled.label, br.label)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('leaves an unknown label unbound', async () => {
    const { file, bound } = await bindSource(
      'function f() { for (;;) { break loop; } }',
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const loop = fn.body.body[0] as ForStatement;
    const br = (loop.body as BlockStatement).body[0] as BreakStatement;

    expect(symbolOf(bound, file, br.label)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['loop']);
  });
});
