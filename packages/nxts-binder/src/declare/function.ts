import type {
  BlockStatement,
  Expression,
  FunctionDeclaration,
  Identifier,
  Node,
} from "@babel/types";
import type { BinderContext } from "../context";
import { bindStatementList } from "../walk/bindStatements";
import { resolveExpr } from "../walk/resolveExpr";
import { declarePattern } from "./pattern";

export function bindFunctionLike(
  binder: BinderContext,
  params: readonly Node[],
  body: BlockStatement | Expression,
  name?: Identifier | null,
) {
  binder.openScope("function");
  if (name) {
    binder.declare("value", name);
  }
  for (const param of params) {
    declarePattern(binder, param);
  }
  if (body.type === "BlockStatement") {
    bindStatementList(binder, body.body);
  } else {
    resolveExpr(binder, body);
  }
  binder.closeScope();
}

export function declareFunction(
  binder: BinderContext,
  statement: FunctionDeclaration,
) {
  if (statement.id && !binder.isBound(statement.id)) {
    binder.declare("value", statement.id);
  }
  bindFunctionLike(binder, statement.params, statement.body);
}
