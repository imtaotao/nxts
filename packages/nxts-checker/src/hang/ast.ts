import type { Node } from '@babel/types';

export function hasTypeParams(node: {
  typeParameters?: { params: readonly unknown[] } | null;
}) {
  return node.typeParameters != null && node.typeParameters.params.length > 0;
}

export function unwrapType(node: Node): Node {
  if (node.type === 'TSTypeAnnotation' || node.type === 'TSParenthesizedType') {
    return unwrapType(node.typeAnnotation);
  }
  return node;
}

export function typeArgsOf(type: Node) {
  if (type.type !== 'TSTypeReference') {
    return null;
  }
  const node = type.typeArguments ?? null;
  if (node == null || node.type !== 'TSTypeParameterInstantiation') {
    return null;
  }
  return node.params;
}

export function typeParamsOf(node: Node | null | undefined) {
  if (node == null || node.type !== 'TSTypeParameterDeclaration') {
    return null;
  }
  return node;
}
