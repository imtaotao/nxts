import type { Identifier, Node } from '@babel/types';
import type { BinderContext } from '../context';
import { resolveExpr } from '../walk/resolveExpr';
import { resolveType } from '../walk/resolveType';

const walkPattern = (
  binder: BinderContext,
  node: Node,
  onName: (name: Identifier) => void,
) => {
  switch (node.type) {
    case 'Identifier':
      onName(node);
      resolveType(binder, node.typeAnnotation);
      return;
    case 'AssignmentPattern':
      walkPattern(binder, node.left, onName);
      resolveExpr(binder, node.right);
      return;
    case 'TSParameterProperty':
      walkPattern(binder, node.parameter, onName);
      return;
    case 'RestElement':
      resolveType(binder, node.typeAnnotation);
      walkPattern(binder, node.argument, onName);
      return;
    case 'ObjectPattern':
      resolveType(binder, node.typeAnnotation);
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
      resolveType(binder, node.typeAnnotation);
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
