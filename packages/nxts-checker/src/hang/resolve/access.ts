import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { TypeId } from '../../types';
import { finish } from './shared';

const indexKeyOf = (hang: Hang, typeId: TypeId) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind === 'literal' && record.value.kind === 'string') {
    return record.value.value;
  }
  return null;
};

const indexOf = (hang: Hang, object: TypeId, index: TypeId) => {
  const record = hang.context.table.types[object] ?? null;
  if (record?.kind !== 'object' && record?.kind !== 'interface') {
    // TODO: 数组/元组下标、联合分配和泛型索引。继续：T40 已定；数组/元组图鉴已有，可按 T40 下标规则接。
    return null;
  }
  const key = indexKeyOf(hang, index);
  if (isNil(key)) {
    // TODO: 键联合、keyof 结果、数值下标。继续：T40 已定；先把键展开成联合再逐键查。
    return null;
  }
  const prop = record.props.find((item) => item.key === key) ?? null;
  if (isNil(prop)) {
    // TODO: 不存在的固定键应报错。继续：等 catalog 诊断接上，现在保持空。
    return null;
  }
  // TODO: 可选属性读取要并上 undefined。继续：T40 已定，hang 读到 optional 即可并上 undefined。
  return prop.type;
};

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
  return finish(hang, type, indexOf(hang, object, index), subst);
}
