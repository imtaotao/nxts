// [1, , 2] 会留下没有元素的空洞。
// Nxts 普通数组是稠密连续存储：0..length-1 每个下标都有值，读写下标就是偏移。
// 空洞会逼出孔位标记或哈希槽，破坏固定元素布局和扫描；不是单纯禁一种写法。
// no: const a = [1, , 2]

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const arrayHoleRule: Rule = {
  name: "arrayHole",
  check: (node, ctx) => {
    if (
      node.type === "ArrayExpression" &&
      node.elements.some((element) => element === null)
    ) {
      return rejectNode(node, ctx, "parser.arrayHole");
    }
    return null;
  },
};
