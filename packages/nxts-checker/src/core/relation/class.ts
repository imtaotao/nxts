import { isNil } from 'aidly';
import type { TypeId } from '../../types';
import type { TypeTable } from '../typeTable';
import { objectToInterface } from './object';
import { equal } from './shared';
import type { Of, Relate } from './shared';

const bodyOf = (table: TypeTable, typeId: TypeId) => {
  return table.classBodies.get(typeId) ?? null;
};

// 派生类到基类。只走静态 extends，不比字段。
// `class Dog extends Animal`
// `class Child extends Parent`
export function classToClass(table: TypeTable, source: TypeId, target: TypeId) {
  const seen = new Set<TypeId>();
  let current = source;
  while (!seen.has(current)) {
    seen.add(current);
    const parent = bodyOf(table, current)?.extends ?? null;
    if (isNil(parent)) {
      return false;
    }
    if (equal(parent, target)) {
      return true;
    }
    current = parent;
  }
  return false;
}

// 类到接口。侧表字段当对象成员，多出来的留下。
// `class Point { x: number; y: number }` → `{ x: number }`
export function classToInterface(
  relate: Relate,
  table: TypeTable,
  source: TypeId,
  target: Of<'interface'>,
  seen: Set<string>,
) {
  const body = bodyOf(table, source);
  if (isNil(body)) {
    return false;
  }
  return objectToInterface(
    relate,
    table,
    {
      kind: 'object',
      id: source,
      props: body.props,
      calls: [],
      constructs: [],
    },
    target,
    seen,
  );
}
