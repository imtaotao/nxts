// override 是 TS 关键字，不改变 JS 方法槽。
// 覆盖关系由 Checker 按类层次识别，写了关键字反而多一套源码契约。
// no: override m() {}

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const overrideRule: Rule = {
  name: "override",
  check: (node, ctx) => {
    if ("override" in node && node.override === true) {
      return rejectNode(node, ctx, "NXT1001", "parser.override");
    }
    return null;
  },
};
