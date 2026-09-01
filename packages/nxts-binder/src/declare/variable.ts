import type { VariableDeclaration } from "@babel/types";
import type { BinderContext } from "../context";
import { resolveExpr } from "../walk/resolveExpr";
import { declarePattern } from "./pattern";

export function declareVariable(
  binder: BinderContext,
  statement: VariableDeclaration,
) {
  if (statement.kind !== "const" && statement.kind !== "let") {
    return;
  }
  for (const declarator of statement.declarations) {
    declarePattern(binder, declarator.id);
    if (declarator.init) {
      resolveExpr(binder, declarator.init);
    }
  }
}
