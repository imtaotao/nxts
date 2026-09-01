// { get x() {} } 给对象装 accessor 描述符，读 x 变成调用。
// 普通对象是精确形状的数据记录，字段按偏移取值；描述符会破坏固定布局。
// 类访问器挂在类上，编译期已知，不走这条。
// no: const o = { get x() { return 1 } }

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const objectLiteralAccessorRule: Rule = {
  name: "objectLiteralAccessor",
  check: (node, ctx) => {
    if (
      node.type === "ObjectMethod" &&
      (node.kind === "get" || node.kind === "set")
    ) {
      return rejectNode(node, ctx, "NXT1001", "parser.objectLiteralAccessor");
    }
    return null;
  },
};
