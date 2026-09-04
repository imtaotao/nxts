import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';

export type TypeResolver = (
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => TypeId | null;

export function finish(
  hang: Hang,
  type: Node,
  typeId: TypeId | null,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (typeId != null && subst == null) {
    hang.hangNode(type, typeId);
  }
  return typeId;
}
