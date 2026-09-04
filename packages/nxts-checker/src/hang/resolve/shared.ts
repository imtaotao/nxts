import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { TypeId } from '../../types';

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
  if (!isNil(typeId) && isNil(subst)) {
    hang.hangNode(type, typeId);
  }
  return typeId;
}
