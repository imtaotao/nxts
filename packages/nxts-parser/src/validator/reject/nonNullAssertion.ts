// y! 只改静态类型，运行时不检查，null/undefined 仍可能在。
// 空值要用收窄、?? 或显式判断，不能靠断言骗过布局。
// no: const x = y!

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const nonNullAssertionRule: Rule = {
  name: "nonNullAssertion",
  check: (node, ctx) => {
    if (node.type === "TSNonNullExpression") {
      return rejectNode(node, ctx, "NXT1001", "parser.nonNullAssertion");
    }
    return null;
  },
};
