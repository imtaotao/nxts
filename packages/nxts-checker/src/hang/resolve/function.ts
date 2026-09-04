import type { Node } from '@babel/types';
import type { FunctionParam, TypeId } from '../../types';
import type { Hang } from '../index';
import { finish } from './shared';

const annotationOf = (node: Node) => {
  if ('typeAnnotation' in node && node.typeAnnotation != null) {
    return node.typeAnnotation;
  }
  if (node.type === 'RestElement') {
    return annotationOf(node.argument);
  }
  return null;
};

const optionalOf = (node: Node) => 'optional' in node && node.optional === true;

const paramOf = (
  hang: Hang,
  node: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (node.type === 'AssignmentPattern') {
    return paramOf(hang, node.left, subst);
  }
  if (node.type === 'TSParameterProperty') {
    return paramOf(hang, node.parameter, subst);
  }
  if (node.type === 'RestElement') {
    const annotation = annotationOf(node);
    if (annotation == null) {
      return null;
    }
    const typeId = hang.resolveAtomType(annotation, subst);
    if (typeId == null) {
      return null;
    }
    return { type: typeId, optional: false, rest: true };
  }
  if (
    node.type !== 'Identifier' &&
    node.type !== 'ObjectPattern' &&
    node.type !== 'ArrayPattern'
  ) {
    return null;
  }
  const annotation = annotationOf(node);
  if (annotation == null) {
    return null;
  }
  const typeId = hang.resolveAtomType(annotation, subst);
  if (typeId == null) {
    return null;
  }
  return { type: typeId, optional: optionalOf(node), rest: false };
};

const receiverOf = (
  hang: Hang,
  node: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (node.type !== 'Identifier' || node.name !== 'this') {
    return null;
  }
  const annotation = annotationOf(node);
  if (annotation == null) {
    return null;
  }
  return hang.resolveAtomType(annotation, subst);
};

export function functionTypeOf(
  hang: Hang,
  params: readonly Node[],
  returnType?: Node | null,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (returnType == null) {
    return null;
  }
  const collected: FunctionParam[] = [];
  let receiver: TypeId | null = null;
  for (const [index, param] of params.entries()) {
    const thisType = receiverOf(hang, param, subst);
    if (param.type === 'Identifier' && param.name === 'this') {
      if (index !== 0 || thisType == null) {
        return null;
      }
      receiver = thisType;
      continue;
    }
    const item = paramOf(hang, param, subst);
    if (item == null) {
      return null;
    }
    collected.push(item);
  }
  const resolvedReturn = hang.resolveAtomType(returnType, subst);
  if (resolvedReturn == null) {
    return null;
  }
  return hang.context.table.intern({
    kind: 'function',
    signatures: [
      {
        receiver,
        params: collected,
        returnType: resolvedReturn,
      },
    ],
  });
}

export function resolveFunction(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSFunctionType') {
    return null;
  }
  return finish(
    hang,
    type,
    functionTypeOf(hang, type.params, type.returnType, subst),
    subst,
  );
}
