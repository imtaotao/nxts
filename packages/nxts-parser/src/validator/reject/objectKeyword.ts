// 裸 object 只表示“非原始值”，没有字段、容器类别或固定布局。
// 需要结构用精确对象/接口，需要先接未知值用 unknown。
// no: const x: object = {}

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const objectKeywordRule: Rule = {
  name: "objectKeyword",
  check: (node, ctx) => {
    if (node.type === "TSObjectKeyword") {
      return rejectNode(node, ctx, "parser.objectKeyword");
    }
    return null;
  },
};
