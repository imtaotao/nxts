import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { TypeId } from '../../types';
import { indexAccess } from '../lookup';
import { finish } from './shared';

// 索引访问
// `Point["x"]`
// `User["id" | "name"]`
// `i32[][i32]`
// `Entry[0]`
export function resolveAccess(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSIndexedAccessType') {
    return null;
  }
  const object = hang.resolveAtomType(type.objectType, subst);
  const index = hang.resolveAtomType(type.indexType, subst);
  if (isNil(object) || isNil(index)) {
    return null;
  }
  return finish(hang, type, indexAccess(hang, object, index), subst);
}
