import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const bigintLiteralRule: Rule = {
  name: "bigintLiteral",
  check: (node) => {
    if (node.type === "BigIntLiteral") {
      return rejectNode(node, "NXT1001", "parser.bigintLiteral");
    }
    return null;
  },
};
