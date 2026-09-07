import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { TypeId } from '../../types';
import { keyofOf } from '../lookup';
import { finish } from './shared';

const readonlyOf = (hang: Hang, typeId: TypeId) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind === 'array') {
    return hang.context.table.intern({
      kind: 'array',
      element: record.element,
      readonly: true,
    });
  }
  if (record?.kind === 'tuple') {
    return hang.context.table.intern({
      kind: 'tuple',
      elements: record.elements,
      readonly: true,
    });
  }
  return null;
};

// 类型算子；`unique symbol` 见 hangUniqueConst
// `keyof Point`
// `readonly i32[]`
export function resolveOperator(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTypeOperator') {
    return null;
  }
  if (type.operator === 'unique') {
    // unique symbol 只挂在 const 注解上，见 hang/pattern。这里当普通类型写法保持空。
    return null;
  }
  const inner = hang.resolveAtomType(type.typeAnnotation, subst);
  if (isNil(inner)) {
    return null;
  }
  if (type.operator === 'keyof') {
    return finish(hang, type, keyofOf(hang, inner), subst);
  }
  if (type.operator === 'readonly') {
    return finish(hang, type, readonlyOf(hang, inner), subst);
  }
  return null;
}
