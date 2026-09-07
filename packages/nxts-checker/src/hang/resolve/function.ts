import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { FunctionParam, TypeId } from '../../types';
import { finish } from './shared';

const annotationOf = (node: Node) => {
  if ('typeAnnotation' in node && !isNil(node.typeAnnotation)) {
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
    if (isNil(annotation)) {
      return null;
    }
    const typeId = hang.resolveAtomType(annotation, subst);
    if (isNil(typeId)) {
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
  if (isNil(annotation)) {
    return null;
  }
  const typeId = hang.resolveAtomType(annotation, subst);
  if (isNil(typeId)) {
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
  if (isNil(annotation)) {
    return null;
  }
  return hang.resolveAtomType(annotation, subst);
};

const signatureOf = (
  hang: Hang,
  params: readonly Node[],
  returnType?: Node | null,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (isNil(returnType)) {
    return null;
  }
  const collected: FunctionParam[] = [];
  let receiver: TypeId | null = null;
  for (const [index, param] of params.entries()) {
    const thisType = receiverOf(hang, param, subst);
    if (param.type === 'Identifier' && param.name === 'this') {
      if (index !== 0 || isNil(thisType)) {
        return null;
      }
      receiver = thisType;
      continue;
    }
    const item = paramOf(hang, param, subst);
    if (isNil(item)) {
      return null;
    }
    collected.push(item);
  }
  const resolvedReturn = hang.resolveAtomType(returnType, subst);
  if (isNil(resolvedReturn)) {
    return null;
  }
  return { receiver, params: collected, returnType: resolvedReturn };
};

// 函数签名
// `(n: i32) => string`
// `(this: Box, n: i32) => void`
export function functionTypeOf(
  hang: Hang,
  params: readonly Node[],
  returnType?: Node | null,
  subst?: ReadonlyMap<number, TypeId>,
) {
  const signature = signatureOf(hang, params, returnType, subst);
  if (isNil(signature)) {
    return null;
  }
  return hang.context.table.intern({
    kind: 'function',
    signatures: [signature],
  });
}

// 构造签名。`new (n: i32) => Box`
export function constructTypeOf(
  hang: Hang,
  params: readonly Node[],
  returnType?: Node | null,
  subst?: ReadonlyMap<number, TypeId>,
) {
  const signature = signatureOf(hang, params, returnType, subst);
  if (isNil(signature)) {
    return null;
  }
  return hang.context.table.intern({
    kind: 'construct',
    signatures: [signature],
  });
}

// 函数类型写法。`type F = (n: i32) => string`
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
