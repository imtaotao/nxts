import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { TypeId } from '../../types';
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
    if (isNil(member)) {
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

// 联合
// `string | i32`
// `"a" | "b"`
export function resolveUnion(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  return resolveMembers(hang, type, 'TSUnionType', 'union', subst);
}

// 交叉。`{ name: string } & { age: i32 }`
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
