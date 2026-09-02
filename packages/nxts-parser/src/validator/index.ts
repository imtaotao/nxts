import type { Node } from '@babel/types';
import type { RuleContext } from '../types';
import { rules } from './rules';

export function validate(
  nodes: Node[],
  parents: WeakMap<Node, Node> = new WeakMap(),
  invalidNodes: Set<Node> = new Set(),
  identity: { fileId: number; sourceVersion: number } = {
    fileId: 0,
    sourceVersion: 0,
  },
) {
  const diagnostics = [];
  const ctx: RuleContext = {
    parent: null,
    parents,
    invalidNodes,
    fileId: identity.fileId,
    sourceVersion: identity.sourceVersion,
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
