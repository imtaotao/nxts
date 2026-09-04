import type { TypeId, TypeRecord } from '../../types';
import type { TypeTable } from '../typeTable';

// 规范化后的同一 TypeId。比赋值兼容更窄。
export function equal(left: TypeId, right: TypeId) {
  return left === right;
}

export type Of<K extends TypeRecord['kind']> = Extract<TypeRecord, { kind: K }>;

export type Relate = (
  table: TypeTable,
  source: TypeId,
  target: TypeId,
  seen: Set<string>,
) => boolean;

export type PairRule = (
  table: TypeTable,
  source: TypeRecord,
  target: TypeRecord,
  seen: Set<string>,
) => boolean;

export function pending() {
  return false;
}

export function recordOf(table: TypeTable, id: TypeId) {
  return table.types[id] ?? null;
}

export function isAtom(record: TypeRecord | null, atom: string) {
  return record?.kind === 'atom' && record.atom === atom;
}

export function atomOf(table: TypeTable, id: TypeId) {
  const record = recordOf(table, id);
  return record?.kind === 'atom' ? record.atom : null;
}

// rest 注解是 T[]，比位置时用元素 T。
export function arrayElementOf(table: TypeTable, id: TypeId) {
  const record = recordOf(table, id);
  return record?.kind === 'array' ? record.element : null;
}
