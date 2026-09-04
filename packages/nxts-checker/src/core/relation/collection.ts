import type { TupleElement } from '../../types';
import type { TypeTable } from '../typeTable';
import { arrayElementOf, equal } from './shared';
import type { Of } from './shared';

const restOf = (table: TypeTable, item: TupleElement) => {
  return item.rest ? arrayElementOf(table, item.type) : null;
};

const spanOf = (table: TypeTable, elements: readonly TupleElement[]) => {
  let required = 0;
  let optional = 0;
  let rest: number | null = null;
  let broken = false;
  for (const item of elements) {
    if (item.rest) {
      rest = arrayElementOf(table, item.type);
      broken = rest === null;
      break;
    }
    if (item.optional) {
      optional += 1;
    } else {
      required += 1;
    }
  }
  return {
    required,
    max: rest === null ? required + optional : null,
    rest,
    broken,
    prefix: elements.filter((item) => item.rest === false).length,
  };
};

const typeAt = (
  table: TypeTable,
  elements: readonly TupleElement[],
  index: number,
) => {
  let cursor = 0;
  for (const item of elements) {
    if (item.rest) {
      return restOf(table, item);
    }
    if (cursor === index) {
      return item.type;
    }
    cursor += 1;
  }
  return null;
};

// T[] → readonly T[] 可以，反向不行。元素目前只认同一 TypeId。
export function arrayToArray(source: Of<'array'>, target: Of<'array'>) {
  if (target.readonly === false && source.readonly === true) {
    return false;
  }
  // TODO: readonly S[] → readonly T[] 要 S→T 无操作且布局相同。继续：等 assignable 能区分 NoOp / Pack，联合注入不能当无操作。
  return equal(source.element, target.element);
}

// 源的每种长度都要落在目标长度里；逐位 TypeId 相同。可变可以当只读看。
export function tupleToTuple(
  table: TypeTable,
  source: Of<'tuple'>,
  target: Of<'tuple'>,
) {
  if (target.readonly === false && source.readonly === true) {
    return false;
  }
  const from = spanOf(table, source.elements);
  const to = spanOf(table, target.elements);
  if (from.broken || to.broken) {
    return false;
  }
  if (from.required < to.required) {
    return false;
  }
  if (to.max !== null && (from.max === null || from.max > to.max)) {
    return false;
  }
  const last = from.max ?? Math.max(from.prefix, to.prefix);
  for (let index = 0; index < last; index += 1) {
    const left = typeAt(table, source.elements, index);
    const right = typeAt(table, target.elements, index);
    if (left === null || right === null || !equal(left, right)) {
      return false;
    }
  }
  if (from.rest !== null) {
    return to.rest !== null && equal(from.rest, to.rest);
  }
  return true;
}

// 同构元组 → 只读数组：每个实际位置都是同一个元素 TypeId。
export function tupleToArray(
  table: TypeTable,
  source: Of<'tuple'>,
  target: Of<'array'>,
) {
  if (target.readonly === false) {
    return false;
  }
  return source.elements.every((item) => {
    if (item.rest) {
      const rest = restOf(table, item);
      return rest !== null && equal(rest, target.element);
    }
    return equal(item.type, target.element);
  });
}
