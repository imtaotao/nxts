// any 让后续读写都绕过检查，布局和调用约定也无法闭合。
// 未知外部值用 unknown 再显式收窄。
// no: const x: any = 1

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const anyKeywordRule: Rule = {
  name: "anyKeyword",
  check: (node, ctx) => {
    if (node.type === "TSAnyKeyword") {
      return rejectNode(node, ctx, "NXT1003", "parser.any");
    }
    return null;
  },
};
