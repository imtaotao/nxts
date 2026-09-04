import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';
import { finish } from './shared';

const resolveMembers = (
  hang: Hang,
  type: Node,
  expected: 'TSUnionType' | 'TSIntersectionType',
  kind: 'union' | 'intersection',
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (type.type !== expected) {
    return null;
  }
  const members: TypeId[] = [];
  for (const item of type.types) {
    const member = hang.resolveAtomType(item, subst);
    if (member == null) {
      return null;
    }
    members.push(member);
  }
  return finish(
    hang,
    type,
    hang.context.table.intern({ kind, members }),
    subst,
  );
};

export function resolveUnion(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  return resolveMembers(hang, type, 'TSUnionType', 'union', subst);
}

export function resolveIntersection(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  return resolveMembers(
    hang,
    type,
    'TSIntersectionType',
    'intersection',
    subst,
  );
}
