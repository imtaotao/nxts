import { isArray } from "aidly";
import { VISITOR_KEYS, isNode } from "@babel/types";
import type { Node } from "@babel/types";

export function assignNodeIds(root: Node | null) {
  const nodes: Node[] = [];
  const nodeIds = new WeakMap<Node, number>();
  const parents = new WeakMap<Node, Node>();

  if (root) {
    const visit = (node: Node, parent: Node | null) => {
      if (nodeIds.has(node)) {
        return;
      }
      nodeIds.set(node, nodes.length);
      nodes.push(node);
      if (parent) {
        parents.set(node, parent);
      }

      const keys = VISITOR_KEYS[node.type];
      if (keys == null) {
        return;
      }
      for (const key of keys) {
        const child = node[key as keyof Node];
        if (isArray(child)) {
          for (const item of child) {
            if (isNode(item)) {
              visit(item, node);
            }
          }
        } else if (isNode(child)) {
          visit(child, node);
        }
      }
    };
    visit(root, null);
  }
  return { nodes, nodeIds, parents };
}
