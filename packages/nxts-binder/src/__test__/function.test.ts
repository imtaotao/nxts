import type {
  BinaryExpression,
  BlockStatement,
  ExpressionStatement,
  FunctionDeclaration,
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

describe("function", () => {
  it("binds a module function, its params, and body references", async () => {
    const { file, bound } = await bindSource(
      "const n = 1; function f(a) { let m = n + a; }",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const fn = file.ast.program.body[1] as FunctionDeclaration;
    const init = (fn.body.body[0] as VariableDeclaration).declarations[0]
      .init as BinaryExpression;

    expect(scopeKindOf(bound, "f")).toBe("module");
    expect(scopeKindOf(bound, "a")).toBe("function");
    expect(sameSymbol(bound, file, n, init.left)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], init.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("binds a nested function to outer values and params", async () => {
    const { file, bound } = await bindSource(
      "const n = 1; function f(a) { function g() { let m = n + a; } }",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const fn = file.ast.program.body[1] as FunctionDeclaration;
    const nested = fn.body.body[0] as FunctionDeclaration;
    const init = (nested.body.body[0] as VariableDeclaration).declarations[0]
      .init as BinaryExpression;

    expect(scopeKindOf(bound, "g")).toBe("function");
    expect(sameSymbol(bound, file, n, init.left)).toBe(true);
    expect(sameSymbol(bound, file, fn.params[0], init.right)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("hoists a module function name before later statements", async () => {
    const { file, bound } = await bindSource("let m = f; function f() {}");
    const m = (file.ast.program.body[0] as VariableDeclaration).declarations[0];
    const fn = file.ast.program.body[1] as FunctionDeclaration;

    expect(sameSymbol(bound, file, fn.id, m.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("hoists a nested function name inside its function scope", async () => {
    const { file, bound } = await bindSource(
      "function f() { return g; function g() {} }",
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const ret = fn.body.body[0] as ReturnStatement;
    const nested = fn.body.body[1] as FunctionDeclaration;

    expect(sameSymbol(bound, file, nested.id, ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("hoists a function name inside its block scope", async () => {
    const { file, bound } = await bindSource("{ let m = f; function f() {} }");
    const block = file.ast.program.body[0] as BlockStatement;
    const m = (block.body[0] as VariableDeclaration).declarations[0];
    const fn = block.body[1] as FunctionDeclaration;

    expect(scopeKindOf(bound, "f")).toBe("block");
    expect(sameSymbol(bound, file, fn.id, m.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("does not leak a block function to the outer scope", async () => {
    const { file, bound } = await bindSource("{ function f() {} } f;");
    const leak = (file.ast.program.body[1] as ExpressionStatement).expression;

    expect(symbolOf(bound, file, leak)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(["binder.unresolved"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["f"]);
  });

  it("reports a duplicate when let and function share a name", async () => {
    const { file, bound } = await bindSource("let f = 1; function f() {}");
    const letF = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].id;
    const fn = file.ast.program.body[1] as FunctionDeclaration;

    expect(sameSymbol(bound, file, letF, fn.id)).toBe(false);
    expect(diagnosticIds(bound)).toEqual(["binder.duplicate"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["f"]);
  });
});
