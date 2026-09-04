import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { TypeId } from '../../types';
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

const keyofOf = (hang: Hang, typeId: TypeId) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind !== 'object' && record?.kind !== 'interface') {
    // TODO: 数组/元组/类/联合的 keyof 键域还要对照 T40，等成员表和联合规则齐了再挂。
    return null;
  }
  const string = hang.context.table.atom('string');
  const keys = record.props.map((prop) =>
    hang.context.table.intern({
      kind: 'literal',
      base: string,
      value: { kind: 'string', value: prop.key },
    }),
  );
  if (keys.length === 0) {
    return hang.context.table.atom('never');
  }
  return hang.context.table.intern({ kind: 'union', members: keys });
};

export function resolveOperator(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTypeOperator') {
    return null;
  }
  if (type.operator === 'unique') {
    // TODO: unique symbol 是声明身份，不是对任意内层类型的算子。等 T18。
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
