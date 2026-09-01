// f(a?: number, b: string) 调用时第二个实参对不上必选位置。
// 默认值和 rest 仍可跟在可选后；元组该顺序 Babel 已经报 OptionalTypeBeforeRequired。
// ok: function f(a: number, b?: string)
// ok: function f(a?: number, b = 1)
// no: function f(a?: number, b: string)

import { isArray } from "aidly";
import type { Node } from "@babel/types";
import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

const isOptionalParam = (param: Node) => {
  if (param.type === "TSParameterProperty") {
    return isOptionalParam(param.parameter);
  }
  return (
    param.type === "AssignmentPattern" ||
    ("optional" in param && param.optional === true)
  );
};

const hasRequiredAfterOptional = (params: Node[]) => {
  let seenOptional = false;
  for (const param of params) {
    if (param.type === "RestElement") {
      continue;
    }
    if (isOptionalParam(param)) {
      seenOptional = true;
      continue;
    }
    if (seenOptional) {
      return true;
    }
  }
  return false;
};

export const optionalOrderRule: Rule = {
  name: "optionalOrder",
  check: (node, ctx) => {
    if (
      "params" in node &&
      isArray(node.params) &&
      hasRequiredAfterOptional(node.params)
    ) {
      return rejectNode(node, ctx, "NXT1001", "parser.optionalOrder");
    }
    return null;
  },
};
