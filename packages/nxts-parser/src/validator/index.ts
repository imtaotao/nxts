import type { Node } from "@babel/types";
import { rules } from "./rules";

export function validate(nodes: Node[]) {
  const diagnostics = [];
  for (const node of nodes) {
    for (const rule of rules) {
      const diagnostic = rule.check(node);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
  }
  return diagnostics;
}
