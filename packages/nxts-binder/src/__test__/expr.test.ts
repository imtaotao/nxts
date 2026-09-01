import type {
  ArrayExpression,
  AwaitExpression,
  ConditionalExpression,
  FunctionDeclaration,
  ObjectExpression,
  ObjectProperty,
  ParenthesizedExpression,
  ReturnStatement,
  SequenceExpression,
  SpreadElement,
  TSInstantiationExpression,
  TSSatisfiesExpression,
  VariableDeclaration,
} from "@babel/types";
import { describe, expect, it } from "vitest";
import { bindSource, sameSymbol, symbolOf } from "./utils";

const initOf = (
  file: Awaited<ReturnType<typeof bindSource>>["file"],
  index: number,
) => (file.ast.program.body[index] as VariableDeclaration).declarations[0].init;

describe("expr", () => {
  it("binds object values and computed keys, not static keys", async () => {
    const { file, bound } = await bindSource(
      "const n = 1; let m = { n, k: n, [n]: 1, ...n };",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const object = initOf(file, 1) as ObjectExpression;
    const shorthand = object.properties[0] as ObjectProperty;
    const staticProp = object.properties[1] as ObjectProperty;
    const computed = object.properties[2] as ObjectProperty;
    const spread = object.properties[3] as SpreadElement;

    expect(sameSymbol(bound, file, n, shorthand.value)).toBe(true);
    expect(sameSymbol(bound, file, n, staticProp.value)).toBe(true);
    expect(symbolOf(bound, file, staticProp.key)).toBe(null);
    expect(sameSymbol(bound, file, n, computed.key)).toBe(true);
    expect(sameSymbol(bound, file, n, spread.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("binds identifiers nested in value expressions", async () => {
    const { file, bound } = await bindSource(
      "const n = 1; let m = n ? [n, ...n] : (n, n);",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const cond = initOf(file, 1) as ConditionalExpression;
    const array = cond.consequent as ArrayExpression;
    const seq = (cond.alternate as ParenthesizedExpression)
      .expression as SequenceExpression;

    expect(sameSymbol(bound, file, n, cond.test)).toBe(true);
    expect(sameSymbol(bound, file, n, array.elements[0])).toBe(true);
    expect(
      sameSymbol(bound, file, n, (array.elements[1] as SpreadElement).argument),
    ).toBe(true);
    expect(sameSymbol(bound, file, n, seq.expressions[0])).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("binds the inner value of wrapper expressions", async () => {
    const { file, bound } = await bindSource(
      "function f() {} const n = 1; let a = n satisfies i32; let b = f<i32>; async function g() { return await n; }",
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id;
    const satisfies = initOf(file, 2) as TSSatisfiesExpression;
    const instantiated = initOf(file, 3) as TSInstantiationExpression;
    const asyncFn = file.ast.program.body[4] as FunctionDeclaration;
    const awaited = (asyncFn.body.body[0] as ReturnStatement)
      .argument as AwaitExpression;

    expect(sameSymbol(bound, file, n, satisfies.expression)).toBe(true);
    expect(sameSymbol(bound, file, fn.id, instantiated.expression)).toBe(true);
    expect(sameSymbol(bound, file, n, awaited.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});
