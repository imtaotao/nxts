import type {
  ArrayPattern,
  AssignmentExpression,
  AssignmentPattern,
  BinaryExpression,
  BlockStatement,
  ExpressionStatement,
  ForOfStatement,
  FunctionDeclaration,
  ObjectPattern,
  ObjectProperty,
  ParenthesizedExpression,
  RestElement,
  ReturnStatement,
  VariableDeclaration,
} from "@babel/types";
import { describe, expect, it } from "vitest";
import {
  bindSource,
  diagnosticIds,
  sameSymbol,
  scopeKindOf,
  symbolOf,
} from "./utils";

const declaratorOf = (
  file: Awaited<ReturnType<typeof bindSource>>["file"],
  index: number,
) => (file.ast.program.body[index] as VariableDeclaration).declarations[0];

const assignmentOf = (
  file: Awaited<ReturnType<typeof bindSource>>["file"],
  index: number,
) =>
  (
    (file.ast.program.body[index] as ExpressionStatement)
      .expression as ParenthesizedExpression
  ).expression as AssignmentExpression;

describe("destructure", () => {
  it("declares object pattern names and skips static keys", async () => {
    const { file, bound } = await bindSource(
      "const src = 1; const k = 1; const { a, b: c, [k]: d, e = src, ...r } = src;",
    );
    const src = declaratorOf(file, 0).id;
    const k = declaratorOf(file, 1).id;
    const pattern = declaratorOf(file, 2).id as ObjectPattern;
    const shorthand = pattern.properties[0] as ObjectProperty;
    const renamed = pattern.properties[1] as ObjectProperty;
    const computed = pattern.properties[2] as ObjectProperty;
    const def = pattern.properties[3] as ObjectProperty;
    const rest = pattern.properties[4] as RestElement;

    expect(symbolOf(bound, file, shorthand.value)).not.toBe(null);
    expect(symbolOf(bound, file, renamed.key)).toBe(null);
    expect(symbolOf(bound, file, renamed.value)).not.toBe(null);
    expect(sameSymbol(bound, file, k, computed.key)).toBe(true);
    expect(
      sameSymbol(bound, file, src, (def.value as AssignmentPattern).right),
    ).toBe(true);
    expect(symbolOf(bound, file, rest.argument)).not.toBe(null);
    expect(bound.diagnostics).toEqual([]);
  });

  it("declares array pattern names including rest", async () => {
    const { file, bound } = await bindSource(
      "const src = 1; const [a, , b, ...r] = src;",
    );
    const pattern = declaratorOf(file, 1).id as ArrayPattern;

    expect(symbolOf(bound, file, pattern.elements[0])).not.toBe(null);
    expect(symbolOf(bound, file, pattern.elements[2])).not.toBe(null);
    expect(
      symbolOf(bound, file, (pattern.elements[3] as RestElement).argument),
    ).not.toBe(null);
    expect(bound.diagnostics).toEqual([]);
  });

  it("binds a nested pattern name at its use site", async () => {
    const { file, bound } = await bindSource(
      "const src = 1; const { a: { b } } = src; b;",
    );
    const pattern = declaratorOf(file, 1).id as ObjectPattern;
    const inner = (pattern.properties[0] as ObjectProperty)
      .value as ObjectPattern;
    const b = (inner.properties[0] as ObjectProperty).value;
    const ref = (file.ast.program.body[2] as ExpressionStatement).expression;

    expect(sameSymbol(bound, file, b, ref)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("resolves assignment pattern names", async () => {
    const { file, bound } = await bindSource(
      "const src = 1; let a; let c; ({ a, b: c } = src);",
    );
    const src = declaratorOf(file, 0).id;
    const a = declaratorOf(file, 1).id;
    const c = declaratorOf(file, 2).id;
    const assign = assignmentOf(file, 3);
    const pattern = assign.left as ObjectPattern;
    const shorthand = pattern.properties[0] as ObjectProperty;
    const renamed = pattern.properties[1] as ObjectProperty;

    expect(sameSymbol(bound, file, src, assign.right)).toBe(true);
    expect(sameSymbol(bound, file, a, shorthand.value)).toBe(true);
    expect(symbolOf(bound, file, renamed.key)).toBe(null);
    expect(sameSymbol(bound, file, c, renamed.value)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("leaves an assignment pattern name unbound when it was not declared", async () => {
    const { file, bound } = await bindSource("const src = 1; ({ a } = src);");
    const assign = assignmentOf(file, 1);
    const a = ((assign.left as ObjectPattern).properties[0] as ObjectProperty)
      .value;

    expect(symbolOf(bound, file, a)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(["binder.unresolved"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["a"]);
  });

  it("reports a duplicate name inside one pattern", async () => {
    const { file, bound } = await bindSource(
      "const src = 1; const { a, b: a } = src;",
    );
    const pattern = declaratorOf(file, 1).id as ObjectPattern;
    const first = (pattern.properties[0] as ObjectProperty).value;
    const second = (pattern.properties[1] as ObjectProperty).value;

    expect(sameSymbol(bound, file, first, second)).toBe(false);
    expect(diagnosticIds(bound)).toEqual(["binder.duplicate"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["a"]);
  });

  it("declares destructured function parameters", async () => {
    const { file, bound } = await bindSource(
      "const n = 1; function f({ a }, [b]) { return a + b + n; }",
    );
    const n = declaratorOf(file, 0).id;
    const fn = file.ast.program.body[1] as FunctionDeclaration;
    const first = fn.params[0] as ObjectPattern;
    const second = fn.params[1] as ArrayPattern;
    const a = (first.properties[0] as ObjectProperty).value;
    const b = second.elements[0];
    const sum = (fn.body.body[0] as ReturnStatement)
      .argument as BinaryExpression;
    const left = sum.left as BinaryExpression;

    expect(scopeKindOf(bound, "a")).toBe("function");
    expect(scopeKindOf(bound, "b")).toBe("function");
    expect(sameSymbol(bound, file, a, left.left)).toBe(true);
    expect(sameSymbol(bound, file, b, left.right)).toBe(true);
    expect(sameSymbol(bound, file, n, sum.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("declares a for-of object pattern in the loop scope", async () => {
    const { file, bound } = await bindSource(
      "function f(items) { for (const { x } of items) { return x; } }",
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const loop = fn.body.body[0] as ForOfStatement;
    const x = (
      ((loop.left as VariableDeclaration).declarations[0].id as ObjectPattern)
        .properties[0] as ObjectProperty
    ).value;
    const ret = (loop.body as BlockStatement).body[0] as ReturnStatement;

    expect(scopeKindOf(bound, "x")).toBe("block");
    expect(sameSymbol(bound, file, x, ret.argument)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], loop.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("resolves a for-of assignment pattern without declaring it", async () => {
    const { file, bound } = await bindSource(
      "function f(x, items) { for ({ a: x } of items) { return x; } }",
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const loop = fn.body.body[0] as ForOfStatement;
    const x = ((loop.left as ObjectPattern).properties[0] as ObjectProperty)
      .value;
    const ret = (loop.body as BlockStatement).body[0] as ReturnStatement;

    expect(sameSymbol(bound, file, fn.params[0], x)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});
