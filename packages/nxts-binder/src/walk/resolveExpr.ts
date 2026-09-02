import type { Node, ObjectExpression } from '@babel/types';
import { bindClassLike } from '../declare/class';
import { bindFunctionLike } from '../declare/function';
import { resolvePattern } from '../declare/pattern';
import type { BinderContext } from '../context';
import { resolveType } from './resolveType';

const resolveObjectMember = (
  binder: BinderContext,
  property: ObjectExpression['properties'][number],
) => {
  if (property.type === 'SpreadElement') {
    resolveExpr(binder, property.argument);
    return;
  }
  if (property.computed) {
    resolveExpr(binder, property.key);
  }
  if (property.type === 'ObjectMethod') {
    bindFunctionLike(binder, property.params, property.body, null, {
      typeParameters: property.typeParameters,
      returnType: property.returnType,
    });
    return;
  }
  resolveExpr(binder, property.value);
};

export function resolveExpr(binder: BinderContext, node: Node) {
  if (binder.isInvalid(node)) {
    return;
  }
  switch (node.type) {
    case 'Identifier':
      binder.resolve('value', node);
      return;
    case 'ObjectPattern':
    case 'ArrayPattern':
    case 'AssignmentPattern':
    case 'RestElement':
      resolvePattern(binder, node);
      return;
    case 'FunctionExpression':
      bindFunctionLike(binder, node.params, node.body, node.id, {
        typeParameters: node.typeParameters,
        returnType: node.returnType,
      });
      return;
    case 'ArrowFunctionExpression':
      bindFunctionLike(binder, node.params, node.body, null, {
        typeParameters: node.typeParameters,
        returnType: node.returnType,
      });
      return;
    case 'ClassExpression':
      bindClassLike(binder, node, true);
      return;
    case 'ParenthesizedExpression':
    case 'TSNonNullExpression':
      resolveExpr(binder, node.expression);
      return;
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
      resolveExpr(binder, node.expression);
      resolveType(binder, node.typeAnnotation);
      return;
    case 'TSInstantiationExpression':
      resolveExpr(binder, node.expression);
      resolveType(binder, node.typeArguments);
      return;
    case 'UnaryExpression':
    case 'UpdateExpression':
    case 'AwaitExpression':
      resolveExpr(binder, node.argument);
      return;
    case 'YieldExpression':
      if (node.argument) {
        resolveExpr(binder, node.argument);
      }
      return;
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'AssignmentExpression':
      resolveExpr(binder, node.left);
      resolveExpr(binder, node.right);
      return;
    case 'ConditionalExpression':
      resolveExpr(binder, node.test);
      resolveExpr(binder, node.consequent);
      resolveExpr(binder, node.alternate);
      return;
    case 'SequenceExpression':
      for (const expression of node.expressions) {
        resolveExpr(binder, expression);
      }
      return;
    case 'SpreadElement':
      resolveExpr(binder, node.argument);
      return;
    case 'ArrayExpression':
      for (const element of node.elements) {
        if (element) {
          resolveExpr(binder, element);
        }
      }
      return;
    case 'ObjectExpression':
      for (const property of node.properties) {
        resolveObjectMember(binder, property);
      }
      return;
    case 'TemplateLiteral':
      for (const expression of node.expressions) {
        resolveExpr(binder, expression);
      }
      return;
    case 'ImportExpression':
      resolveExpr(binder, node.source);
      return;
    case 'CallExpression':
    case 'NewExpression':
    case 'OptionalCallExpression':
      resolveExpr(binder, node.callee);
      resolveType(binder, node.typeArguments);
      for (const argument of node.arguments) {
        if (argument.type !== 'ArgumentPlaceholder') {
          resolveExpr(binder, argument);
        }
      }
      return;
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      resolveExpr(binder, node.object);
      if (node.computed) {
        resolveExpr(binder, node.property);
      }
      return;
    default:
      return;
  }
}
