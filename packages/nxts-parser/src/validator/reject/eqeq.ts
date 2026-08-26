import { rejectNode } from "../rejectNode";
import type { Rule } from "../../types";

export const eqeqRule: Rule = {
  name: "eqeq",
  check: (node) => {
    if (
      node.type === "BinaryExpression" &&
      (node.operator === "==" || node.operator === "!=")
    ) {
      return rejectNode(node, "NXT1001", "parser.eqeq");
    }
    return null;
  },
};
