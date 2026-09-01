// abstract 表示“有槽无实现”，要单独的构造禁止和缺失实现协议。
// 当前类必须可构造、成员必须有体，不留抽象洞。
// no: abstract class A {}
// no: abstract m(): void

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const abstractRule: Rule = {
  name: "abstract",
  check: (node, ctx) => {
    if ("abstract" in node && node.abstract === true) {
      return rejectNode(node, ctx, "parser.abstract");
    }
    return null;
  },
};
