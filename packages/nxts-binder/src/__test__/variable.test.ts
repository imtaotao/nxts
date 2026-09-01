import type {
  ExpressionStatement,
  MemberExpression,
  VariableDeclaration,
} from "@babel/types";
import { describe, expect, it } from "vitest";
import { bindSource, diagnosticIds, sameSymbol, symbolOf } from "./utils";

describe("variable", () => {
  it("binds a later initializer to the declared symbol", async () => {
    const { file, bound } = await bindSource("const n = 1; let m = n;");
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const m = (file.ast.program.body[1] as VariableDeclaration).declarations[0];

    expect(sameSymbol(bound, file, n, m.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it("leaves an unresolved initializer unbound", async () => {
    const { file, bound } = await bindSource("let m = n;");
    const init = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].init;

    expect(symbolOf(bound, file, init)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(["binder.unresolved"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["n"]);
  });

  it("does not hoist a let before its declaration", async () => {
    const { file, bound } = await bindSource("n; let n = 1;");
    const ref = (file.ast.program.body[0] as ExpressionStatement).expression;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id;

    expect(symbolOf(bound, file, ref)).toBe(null);
    expect(symbolOf(bound, file, n)).not.toBe(null);
    expect(diagnosticIds(bound)).toEqual(["binder.unresolved"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["n"]);
  });

  it("reports a duplicate module binding", async () => {
    const { file, bound } = await bindSource("const n = 1; const n = 2;");
    const first = (file.ast.program.body[0] as VariableDeclaration)
      .declarations[0].id;
    const second = (file.ast.program.body[1] as VariableDeclaration)
      .declarations[0].id;

    expect(sameSymbol(bound, file, first, second)).toBe(false);
    expect(diagnosticIds(bound)).toEqual(["binder.duplicate"]);
    expect(bound.diagnostics[0]?.arguments).toEqual(["n"]);
  });

  it("does not treat a static member key as a value reference", async () => {
    const { file, bound } = await bindSource("const n = 1; let m = n.bar;");
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const member = (file.ast.program.body[1] as VariableDeclaration)
      .declarations[0].init as MemberExpression;

    expect(sameSymbol(bound, file, n, member.object)).toBe(true);
    expect(symbolOf(bound, file, member.property)).toBe(null);
    expect(bound.diagnostics).toEqual([]);
  });

  it("binds both sides of a computed member", async () => {
    const { file, bound } = await bindSource(
      "const n = 1; const k = 0; let m = n[k];",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const k = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id;
    const member = (file.ast.program.body[2] as VariableDeclaration)
      .declarations[0].init as MemberExpression;

    expect(sameSymbol(bound, file, n, member.object)).toBe(true);
    expect(sameSymbol(bound, file, k, member.property)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });
});
