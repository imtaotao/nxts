import type { Node } from '@babel/types';
import type { BinderContext } from '../context';
import { resolveExpr } from './resolveExpr';
import { withTypeParams } from '../declare/type';

const resolveName = (
  binder: BinderContext,
  node: Node,
  space: 'type' | 'value',
) => {
  if (node.type === 'Identifier') {
    binder.resolve(space, node);
    return;
  }
  if (node.type === 'TSQualifiedName') {
    resolveName(binder, node.left, space);
  }
};

const resolveTypeArgs = (binder: BinderContext, node?: Node | null) => {
  if (node == null || node.type !== 'TSTypeParameterInstantiation') {
    return;
  }
  for (const param of node.params) {
    resolveType(binder, param);
  }
};

const resolveHeritage = (
  binder: BinderContext,
  node: Extract<Node, { type: 'TSInterfaceHeritage' | 'TSClassImplements' }>,
) => {
  if (node.expression.type === 'Identifier') {
    binder.resolve('type', node.expression);
  }
  resolveTypeArgs(binder, node.typeArguments);
};

const resolveSignature = (
  binder: BinderContext,
  node: {
    typeParameters?: Node | null;
    params?: readonly Node[];
    parameters?: readonly Node[];
    returnType?: Node | null;
    typeAnnotation?: Node | null;
  },
) => {
  withTypeParams(binder, node.typeParameters, () => {
    for (const param of node.params ?? node.parameters ?? []) {
      resolveType(binder, param);
    }
    resolveType(binder, node.returnType ?? node.typeAnnotation);
  });
};

const resolveTypeMember = (binder: BinderContext, node: Node) => {
  switch (node.type) {
    case 'TSPropertySignature':
      if (node.computed) {
        resolveExpr(binder, node.key);
      }
      resolveType(binder, node.typeAnnotation);
      return;
    case 'TSMethodSignature':
      if (node.computed) {
        resolveExpr(binder, node.key);
      }
      resolveSignature(binder, node);
      return;
    case 'TSIndexSignature':
    case 'TSCallSignatureDeclaration':
    case 'TSConstructSignatureDeclaration':
      resolveSignature(binder, node);
      return;
    default:
      return;
  }
};

export function resolveType(binder: BinderContext, node?: Node | null) {
  if (node == null || binder.isInvalid(node)) {
    return;
  }
  switch (node.type) {
    case 'TSTypeAnnotation':
    case 'TSParenthesizedType':
    case 'TSOptionalType':
    case 'TSRestType':
    case 'TSTypeOperator':
      resolveType(binder, node.typeAnnotation);
      return;
    case 'Identifier':
    case 'ObjectPattern':
    case 'ArrayPattern':
      resolveType(binder, node.typeAnnotation);
      return;
    case 'RestElement':
      resolveType(binder, node.typeAnnotation);
      resolveType(binder, node.argument);
      return;
    case 'TSParameterProperty':
      resolveType(binder, node.parameter);
      return;
    case 'TSTypeReference':
      resolveName(binder, node.typeName, 'type');
      resolveTypeArgs(binder, node.typeArguments);
      return;
    case 'TSInterfaceHeritage':
    case 'TSClassImplements':
      resolveHeritage(binder, node);
      return;
    case 'TSTypeParameterInstantiation':
      resolveTypeArgs(binder, node);
      return;
    case 'TSArrayType':
      resolveType(binder, node.elementType);
      return;
    case 'TSUnionType':
    case 'TSIntersectionType':
      for (const type of node.types) {
        resolveType(binder, type);
      }
      return;
    case 'TSTupleType':
      for (const element of node.elementTypes) {
        resolveType(binder, element);
      }
      return;
    case 'TSNamedTupleMember':
      resolveType(binder, node.elementType);
      return;
    case 'TSTypeLiteral':
      for (const member of node.members) {
        resolveTypeMember(binder, member);
      }
      return;
    case 'TSFunctionType':
    case 'TSConstructorType':
      resolveSignature(binder, node);
      return;
    case 'TSTypeQuery':
      resolveName(binder, node.exprName, 'value');
      resolveTypeArgs(binder, node.typeArguments);
      return;
    case 'TSIndexedAccessType':
      resolveType(binder, node.objectType);
      resolveType(binder, node.indexType);
      return;
    case 'TSConditionalType':
      resolveType(binder, node.checkType);
      binder.openScope('infer');
      resolveType(binder, node.extendsType);
      resolveType(binder, node.trueType);
      binder.closeScope();
      resolveType(binder, node.falseType);
      return;
    case 'TSTemplateLiteralType':
      for (const type of node.types) {
        resolveType(binder, type);
      }
      return;
    case 'TSTypePredicate':
      resolveType(binder, node.typeAnnotation);
      return;
    case 'TSPropertySignature':
    case 'TSMethodSignature':
    case 'TSIndexSignature':
    case 'TSCallSignatureDeclaration':
    case 'TSConstructSignatureDeclaration':
      resolveTypeMember(binder, node);
      return;
    case 'TSMappedType':
      binder.openScope('typeParams');
      binder.declare('type', node.key);
      resolveType(binder, node.constraint);
      resolveType(binder, node.nameType);
      resolveType(binder, node.typeAnnotation);
      binder.closeScope();
      return;
    case 'TSInferType':
      binder.declareOnce('type', node.typeParameter.name);
      resolveType(binder, node.typeParameter.constraint);
      return;
    default:
      return;
  }
}
