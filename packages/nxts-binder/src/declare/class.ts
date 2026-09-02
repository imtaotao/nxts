import type {
  ClassDeclaration,
  ClassExpression,
  Identifier,
  Node,
} from '@babel/types';
import type { BinderContext } from '../context';
import { bindStatementList } from '../walk/bindStatements';
import { resolveExpr } from '../walk/resolveExpr';
import { resolveType } from '../walk/resolveType';
import { bindFunctionLike } from './function';
import { withTypeParams } from './type';

const declareClassName = (binder: BinderContext, name: Identifier) => {
  binder.declare('value', name);
  binder.declare('type', name);
};

const bindClassMember = (binder: BinderContext, member: Node) => {
  switch (member.type) {
    case 'ClassMethod':
    case 'ClassPrivateMethod':
      if (member.type === 'ClassMethod' && member.computed) {
        resolveExpr(binder, member.key);
      }
      bindFunctionLike(binder, member.params, member.body, null, {
        typeParameters: member.typeParameters,
        returnType: member.returnType,
      });
      return;
    case 'ClassProperty':
    case 'ClassAccessorProperty':
      if (member.computed) {
        resolveExpr(binder, member.key);
      }
      resolveType(binder, member.typeAnnotation);
      if (member.value) {
        resolveExpr(binder, member.value);
      }
      return;
    case 'ClassPrivateProperty':
      resolveType(binder, member.typeAnnotation);
      if (member.value) {
        resolveExpr(binder, member.value);
      }
      return;
    case 'StaticBlock':
      bindStatementList(binder, member.body);
      return;
    case 'TSIndexSignature':
      resolveType(binder, member);
      return;
    case 'TSDeclareMethod':
      if (member.computed) {
        resolveExpr(binder, member.key);
      }
      withTypeParams(binder, member.typeParameters, () => {
        for (const param of member.params) {
          resolveType(binder, param);
        }
        resolveType(binder, member.returnType);
      });
      return;
    default:
      return;
  }
};

export function bindClassLike(
  binder: BinderContext,
  node: ClassDeclaration | ClassExpression,
  nameInClassScope?: boolean,
) {
  if (!nameInClassScope && node.id && !binder.isBound(node.id)) {
    declareClassName(binder, node.id);
  }
  binder.openScope('class');
  if (nameInClassScope && node.id) {
    declareClassName(binder, node.id);
  }
  withTypeParams(binder, node.typeParameters, () => {
    if (node.superClass) {
      resolveExpr(binder, node.superClass);
    }
    resolveType(binder, node.superTypeArguments);
    for (const item of node.implements ?? []) {
      resolveType(binder, item);
    }
    for (const member of node.body.body) {
      bindClassMember(binder, member);
    }
  });
  binder.closeScope();
}

export function declareClass(
  binder: BinderContext,
  statement: ClassDeclaration,
) {
  bindClassLike(binder, statement);
}
