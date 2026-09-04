import type { Node } from '@babel/types';
import type { TupleElement, TypeId } from '../../types';
import type { Hang } from '../index';
import { signatureProps } from '../intern';
import { finish } from './shared';

export function resolveArray(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSArrayType') {
    return null;
  }
  const element = hang.resolveAtomType(type.elementType, subst);
  if (element == null) {
    return null;
  }
  return finish(
    hang,
    type,
    hang.context.table.intern({
      kind: 'array',
      element,
      readonly: false,
    }),
    subst,
  );
}

const namedTupleOf = (node: Node) => {
  if (node.type !== 'TSNamedTupleMember') {
    return { node, optional: false };
  }
  return { node: node.elementType, optional: node.optional === true };
};

const tupleElementOf = (
  hang: Hang,
  node: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  let current = namedTupleOf(node);
  let rest = false;
  if (current.node.type === 'TSRestType') {
    rest = true;
    current = namedTupleOf(current.node.typeAnnotation);
  }
  let inner = current.node;
  let optional = current.optional;
  if (inner.type === 'TSOptionalType') {
    optional = true;
    inner = inner.typeAnnotation;
  }
  const typeId = hang.resolveAtomType(inner, subst);
  if (typeId == null) {
    return null;
  }
  return { type: typeId, optional, rest };
};

export function resolveTuple(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTupleType') {
    return null;
  }
  const elements: TupleElement[] = [];
  for (const element of type.elementTypes) {
    const item = tupleElementOf(hang, element, subst);
    if (item == null) {
      return null;
    }
    elements.push(item);
  }
  return finish(
    hang,
    type,
    hang.context.table.intern({
      kind: 'tuple',
      elements,
      readonly: false,
    }),
    subst,
  );
}

export function resolveObject(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTypeLiteral') {
    return null;
  }
  const props = signatureProps(hang, type.members, subst);
  if (props == null) {
    // TODO: 对象字面量带调用签名还没有 callable object 图鉴，不能收成 function。
    return null;
  }
  return finish(
    hang,
    type,
    hang.context.table.intern({
      kind: 'object',
      props,
    }),
    subst,
  );
}
