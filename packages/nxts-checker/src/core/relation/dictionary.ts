import { isNil } from 'aidly';
import type { TypeTable } from '../typeTable';
import { memberOf } from './object';
import { atomOf, equal } from './shared';
import type { Of, Relate } from './shared';

const keyWiden = (table: TypeTable, source: number, target: number) => {
  if (equal(source, target)) {
    return true;
  }
  // NumberDict → StringDict 可以，反向不行。
  return (
    atomOf(table, source) === 'number' && atomOf(table, target) === 'string'
  );
};

const valueOf = (
  relate: Relate,
  table: TypeTable,
  source: Of<'object' | 'dictionary'>,
  target: Of<'dictionary'>,
  seen: Set<string>,
) => {
  return source.props.every((prop) => {
    if (target.readonly) {
      return relate(table, prop.type, target.value, seen);
    }
    if (prop.readonly) {
      return false;
    }
    return (
      relate(table, prop.type, target.value, seen) &&
      relate(table, target.value, prop.type, seen)
    );
  });
};

const fixedOf = (
  relate: Relate,
  table: TypeTable,
  source: Of<'object' | 'dictionary'>,
  target: Of<'dictionary'>,
  seen: Set<string>,
) => {
  return target.props.every((prop) => {
    const from = source.props.find((item) => item.key === prop.key) ?? null;
    return !isNil(from) && memberOf(relate, table, from, prop, seen);
  });
};

// 精确对象进字典：成员能当索引值用。可写字典还要求字段可写且能收回 V。
export function objectToDictionary(
  relate: Relate,
  table: TypeTable,
  source: Of<'object'>,
  target: Of<'dictionary'>,
  seen: Set<string>,
) {
  if (source.calls.length > 0 || source.constructs.length > 0) {
    return false;
  }
  if (atomOf(table, target.key) === 'number') {
    if (source.props.some((prop) => !/^\d+$/.test(prop.key))) {
      return false;
    }
  }
  return (
    valueOf(relate, table, source, target, seen) &&
    fixedOf(relate, table, source, target, seen)
  );
}

// 可写 → 只读可以。值类型目前只认同一 TypeId。
export function dictionaryToDictionary(
  relate: Relate,
  table: TypeTable,
  source: Of<'dictionary'>,
  target: Of<'dictionary'>,
  seen: Set<string>,
) {
  if (target.readonly === false && source.readonly === true) {
    return false;
  }
  if (!keyWiden(table, source.key, target.key)) {
    return false;
  }
  if (!equal(source.value, target.value)) {
    return false;
  }
  const sourceNumeric = source.numeric ?? null;
  const targetNumeric = target.numeric ?? null;
  if (!isNil(targetNumeric)) {
    if (isNil(sourceNumeric)) {
      return false;
    }
    if (!keyWiden(table, sourceNumeric.key, targetNumeric.key)) {
      return false;
    }
    if (!equal(sourceNumeric.value, targetNumeric.value)) {
      return false;
    }
  }
  return (
    valueOf(relate, table, source, target, seen) &&
    fixedOf(relate, table, source, target, seen)
  );
}

// 数组只能进只读数值索引视图，元素 TypeId 必须相同。
export function arrayToDictionary(
  _relate: Relate,
  table: TypeTable,
  source: Of<'array'>,
  target: Of<'dictionary'>,
) {
  if (target.readonly === false || target.props.length > 0) {
    return false;
  }
  return (
    atomOf(table, target.key) === 'number' &&
    equal(source.element, target.value)
  );
}
