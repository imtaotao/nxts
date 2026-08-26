import { isArray } from "aidly";
import { VISITOR_KEYS, isNode } from "@babel/types";
import type { Node } from "@babel/types";

export function assignNodeIds(root: Node | null) {
  const nodes: Node[] = [];
  const nodeIds = new WeakMap<Node, number>();

  if (root) {
    const visit = (node: Node) => {
      if (nodeIds.has(node)) {
        return;
      }
      nodeIds.set(node, nodes.length);
      nodes.push(node);

      const keys = VISITOR_KEYS[node.type];
      if (keys == null) {
        return;
      }
      for (const key of keys) {
        const child = node[key as keyof Node];
        if (isArray(child)) {
          for (const item of child) {
            if (isNode(item)) {
              visit(item);
            }
          }
        } else if (isNode(child)) {
          visit(child);
        }
      }
    };
    visit(root);
  }
  return { nodes, nodeIds };
}
