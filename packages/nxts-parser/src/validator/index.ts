import type { Node } from "@babel/types";
import type { RuleContext } from "../types";
import { rules } from "./rules";

export function validate(
  nodes: Node[],
  parents: WeakMap<Node, Node> = new WeakMap(),
) {
  const diagnostics = [];
  const ctx: RuleContext = {
    parent: null,
    parents,
  };
  for (const node of nodes) {
    ctx.parent = parents.get(node) ?? null;
    for (const rule of rules) {
      const diagnostic = rule.check(node, ctx);
      if (diagnostic) {
        diagnostics.push(diagnostic);
      }
    }
  }
  return diagnostics;
}
