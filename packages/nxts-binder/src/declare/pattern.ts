import type { Identifier, Node } from '@babel/types';
import type { BinderContext } from '../context';
import { resolveExpr } from '../walk/resolveExpr';

const walkPattern = (
  binder: BinderContext,
  node: Node,
  onName: (name: Identifier) => void,
) => {
  switch (node.type) {
    case 'Identifier':
      onName(node);
      return;
    case 'AssignmentPattern':
      walkPattern(binder, node.left, onName);
      resolveExpr(binder, node.right);
      return;
    case 'RestElement':
      walkPattern(binder, node.argument, onName);
      return;
    case 'ObjectPattern':
      for (const property of node.properties) {
        if (property.type === 'RestElement') {
          walkPattern(binder, property, onName);
          continue;
        }
        if (property.computed) {
          resolveExpr(binder, property.key);
        }
        walkPattern(binder, property.value, onName);
      }
      return;
    case 'ArrayPattern':
      for (const element of node.elements) {
        if (element) {
          walkPattern(binder, element, onName);
        }
      }
      return;
    default:
      return;
  }
};

export function declarePattern(binder: BinderContext, node: Node) {
  walkPattern(binder, node, (name) => {
    binder.declare('value', name);
  });
}

export function resolvePattern(binder: BinderContext, node: Node) {
  walkPattern(binder, node, (name) => {
    binder.resolve('value', name);
  });
}
