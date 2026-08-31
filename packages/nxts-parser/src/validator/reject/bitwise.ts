// JS 位运算会 ToInt32 / ToUint32，>>> 还是无符号移位。
// 若对齐固定整数模型，语义会和 JS 分叉；没选定前先拒表达式，类型里的 | & 不动。
// no: 1 | 2
// no: ~1
// no: x |= 1

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

const bitwiseOps = new Set(["&", "|", "^", "~", "<<", ">>", ">>>"]);
const bitwiseAssigns = new Set(["&=", "|=", "^=", "<<=", ">>=", ">>>="]);

export const bitwiseRule: Rule = {
  name: "bitwise",
  check: (node) => {
    if (
      (node.type === "BinaryExpression" || node.type === "UnaryExpression") &&
      bitwiseOps.has(node.operator)
    ) {
      return rejectNode(node, "NXT1001", "parser.bitwise");
    }
    if (
      node.type === "AssignmentExpression" &&
      bitwiseAssigns.has(node.operator)
    ) {
      return rejectNode(node, "NXT1001", "parser.bitwise");
    }
    return null;
  },
};
