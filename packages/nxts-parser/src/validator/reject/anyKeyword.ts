import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const anyKeywordRule: Rule = {
  name: "anyKeyword",
  check: (node) => {
    if (node.type === "TSAnyKeyword") {
      return rejectNode(node, "NXT1003", "parser.any");
    }
    return null;
  },
};
