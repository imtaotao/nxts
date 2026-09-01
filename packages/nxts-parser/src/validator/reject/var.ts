// var 有函数作用域、声明提升和重复声明兼容。
// Nxts 只有词法 let/const，不实现这套规则，也不能 silently 改写成 let。
// no: var a = 1

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const varRule: Rule = {
  name: "var",
  check: (node, ctx) => {
    if (node.type === "VariableDeclaration" && node.kind === "var") {
      return rejectNode(node, ctx, "parser.var");
    }
    return null;
  },
};
