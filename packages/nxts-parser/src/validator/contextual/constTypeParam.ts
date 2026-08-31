// const T 要求从调用实参把类型收成字面量。
// 函数/方法/类有构造或调用入口；接口和别名只是类型构造器，没有这次调用。
// 别名上的 const 由 Babel 报 InvalidModifierOnTypeParameter。
// ok: function f<const T>() {}
// ok: class A<const T> {}
// no: interface I<const T> {}
// no: type T<const U> = U

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const constTypeParamRule: Rule = {
  name: "constTypeParam",
  check: (node, ctx) => {
    if (node.type !== "TSTypeParameter" || node.const !== true) {
      return null;
    }
    const list = ctx.parent;
    if (list?.type !== "TSTypeParameterDeclaration") {
      return null;
    }
    const owner = ctx.parents.get(list) ?? null;
    if (owner?.type === "TSInterfaceDeclaration") {
      return rejectNode(node, "NXT1001", "parser.constTypeParam");
    }
    return null;
  },
};
