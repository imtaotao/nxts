// foo`hi` 要构造 { raw, cooked } 模板对象再调用 tag。
// 这块运行时对象和调用约定未定义；普通插值模板 `hi ${1}` 可以。
// no: foo`hi`

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const taggedTemplateRule: Rule = {
  name: "taggedTemplate",
  check: (node, ctx) => {
    if (node.type === "TaggedTemplateExpression") {
      return rejectNode(node, ctx, "NXT1001", "parser.taggedTemplate");
    }
    return null;
  },
};
