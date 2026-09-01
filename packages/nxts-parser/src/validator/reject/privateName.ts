// #x 是运行时弱映射式硬隐藏，实例布局里要额外藏槽。
// Nxts 的 private 只是静态访问控制，字段仍是普通自身属性。
// no: class A { #x = 1 }

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const privateNameRule: Rule = {
  name: "privateName",
  check: (node, ctx) => {
    if (node.type === "PrivateName") {
      return rejectNode(node, ctx, "NXT1001", "parser.privateName");
    }
    return null;
  },
};
