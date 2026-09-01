// declare 只描述外部已存在的符号，不生成实现。
// 应用源码必须自带定义；重载签名没有 declare 标志，不能按节点类型误杀。
// no: declare const x: number

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const declareRule: Rule = {
  name: "declare",
  check: (node, ctx) => {
    if ("declare" in node && node.declare === true) {
      return rejectNode(node, ctx, "parser.declare");
    }
    return null;
  },
};
