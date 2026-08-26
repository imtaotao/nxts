import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const varRule: Rule = {
  name: "var",
  check: (node) => {
    if (node.type === "VariableDeclaration" && node.kind === "var") {
      return rejectNode(node, "NXT1001", "parser.var");
    }
    return null;
  },
};
