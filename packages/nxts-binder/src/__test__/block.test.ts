import type {
  BlockStatement,
  ExpressionStatement,
  FunctionDeclaration,
  IfStatement,
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

describe("block", () => {
  it("declares a let inside a block scope", async () => {
    const { file, bound } = await bindSource("const n = 1; { let m = n; }");
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const block = file.ast.program.body[1] as BlockStatement;
    const m = (block.body[0] as VariableDeclaration).declarations[0];

    expect(scopeKindOf(bound, "m")).toBe("block");
    expect(sameSymbol(bound, file, n, m.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("binds a shadowed inner name, not the outer one", async () => {
    const { file, bound } = await bindSource("const n = 1; { let n = 2; n; }");
    const outer = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].id;
    const block = file.ast.program.body[1] as BlockStatement;
    const inner = (block.body[0] as VariableDeclaration).declarations[0].id;
    const ref = (block.body[1] as ExpressionStatement).expression;

    expect(sameSymbol(bound, file, inner, ref)).toBe(true);
    expect(sameSymbol(bound, file, outer, ref)).toBe(false);
    expect(bound.diagnostics).toEqual([]);
  });

  it("keeps an if-body let inside the block", async () => {
    const { file, bound } = await bindSource(
      "const n = 1; function f() { if (n) { let m = n; return m; } }",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const fn = file.ast.program.body[1] as FunctionDeclaration;
    const iff = fn.body.body[0] as IfStatement;
    const thenBody = iff.consequent as BlockStatement;
    const m = (thenBody.body[0] as VariableDeclaration).declarations[0].id;
    const ret = thenBody.body[1] as ReturnStatement;

    expect(scopeKindOf(bound, "m")).toBe("block");
    expect(sameSymbol(bound, file, n, iff.test)).toBe(true);
    expect(sameSymbol(bound, file, m, ret.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("does not leak a block let to the outer function", async () => {
    const { file, bound } = await bindSource(
      "function f() { if (true) { let m = 1; } return m; }",
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const ret = fn.body.body[1] as ReturnStatement;

    expect(symbolOf(bound, file, ret.argument)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(["binder.unresolved"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["m"]);
  });

  it("binds both branches of an if-else", async () => {
    const { file, bound } = await bindSource(
      "function f(n) { if (n) { let a = n; return a; } else { let b = n; return b; } }",
    );
    const fn = file.ast.program.body[0] as FunctionDeclaration;
    const iff = fn.body.body[0] as IfStatement;
    const thenBody = iff.consequent as BlockStatement;
    const elseBody = iff.alternate as BlockStatement;
    const a = (thenBody.body[0] as VariableDeclaration).declarations[0].id;
    const b = (elseBody.body[0] as VariableDeclaration).declarations[0].id;
    const aRet = thenBody.body[1] as ReturnStatement;
    const bRet = elseBody.body[1] as ReturnStatement;

    expect(sameSymbol(bound, file, a, aRet.argument)).toBe(true);
    expect(sameSymbol(bound, file, b, bRet.argument)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});
