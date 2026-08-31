// <T>value 和 JSX 抢 <，而且是无检查强制转换。
// 品牌和字面量收窄走 as，普通 as Type 再交给 Checker。
// no: const x = <number>1

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const typeAssertionRule: Rule = {
  name: "typeAssertion",
  check: (node) => {
    if (node.type === "TSTypeAssertion") {
      return rejectNode(node, "NXT1001", "parser.typeAssertion");
    }
    return null;
  },
};
