// JS 里任意函数都能写 new.target，表示“谁用 new 调了我”。
// Nxts 只有类可构造，这个元数据只在类构造器（及其词法箭头）有意义。
// ok: class A { constructor() { new.target } }
// ok: class A { constructor() { const f = () => new.target } }
// no: function f() { new.target }
// no: class A { m() { new.target } }
// no: class A { static { new.target } }

import type { Node } from "@babel/types";
import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

const isNewTarget = (node: Node) =>
  node.type === "MetaProperty" &&
  node.meta.name === "new" &&
  node.property.name === "target";

const isConstructor = (node: Node) =>
  (node.type === "ClassMethod" || node.type === "ClassPrivateMethod") &&
  node.kind === "constructor";

const isFunctionBoundary = (node: Node) =>
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "ObjectMethod" ||
  node.type === "ClassMethod" ||
  node.type === "ClassPrivateMethod";

export const newTargetRule: Rule = {
  name: "newTarget",
  check: (node, ctx) => {
    if (!isNewTarget(node)) {
      return null;
    }
    let current = ctx.parent;

    while (current) {
      if (isConstructor(current)) {
        return null;
      }
      if (current.type === "ArrowFunctionExpression") {
        current = ctx.parents.get(current) ?? null;
        continue;
      }
      if (current.type === "StaticBlock" || isFunctionBoundary(current)) {
        return rejectNode(node, "NXT1001", "parser.newTarget");
      }
      current = ctx.parents.get(current) ?? null;
    }
    return rejectNode(node, "NXT1001", "parser.newTarget");
  },
};
