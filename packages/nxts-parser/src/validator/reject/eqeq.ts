// == / != 会按 JS 做 ToPrimitive 和类型强制。
// 静态类型下同值可能比较出不同结果，只保留 === / !==。
// no: 1 == 2
// no: 1 != 2

import { rejectNode } from "../rejectNode";
import type { Rule } from "../../types";

export const eqeqRule: Rule = {
  name: "eqeq",
  check: (node, ctx) => {
    if (
      node.type === "BinaryExpression" &&
      (node.operator === "==" || node.operator === "!=")
    ) {
      return rejectNode(node, ctx, "parser.eqeq");
    }
    return null;
  },
};
