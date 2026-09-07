import { isNil } from 'aidly';
import type { TypeId, TypeRecord } from '../../types';
import type { TypeTable } from '../typeTable';
import { classToClass, classToInterface } from './class';
import { arrayToArray, tupleToArray, tupleToTuple } from './collection';
import {
  arrayToDictionary,
  dictionaryToDictionary,
  objectToDictionary,
} from './dictionary';
import { functionToFunction } from './function';
import {
  interfaceToInterface,
  objectToInterface,
  objectToObject,
} from './object';
import { equal, isAtom, pending, recordOf } from './shared';
import type { Of, PairRule, Relate } from './shared';

export { equal } from './shared';

// source 的值能不能当作 target 用。还不区分 NoOp / Pack，只给 true / false。
// class → 基类 / 接口读 table.classBodies；没有体时这两对为 false。
export function assignable(table: TypeTable, source: TypeId, target: TypeId) {
  const relate: Relate = (table, source, target, seen) => {
    return walk(table, source, target, seen, relate, pairs);
  };
  const pairs = pairsOf(relate);
  return relate(table, source, target, new Set());
}

const pairOf = (source: TypeId, target: TypeId) => `${source}>${target}`;

// 相等 / 环 / never → 联合交叉展开 → 字面量放宽 → 按 kind 对查表。
const walk = (
  table: TypeTable,
  source: TypeId,
  target: TypeId,
  seen: Set<string>,
  relate: Relate,
  pairs: Record<string, Record<string, PairRule>>,
) => {
  if (equal(source, target)) {
    return true;
  }
  const key = pairOf(source, target);
  if (seen.has(key)) {
    // 对象互相引用时，正在比的那一对先当成立，避免绕死。
    return true;
  }
  const from = recordOf(table, source);
  const to = recordOf(table, target);
  if (isNil(from) || isNil(to)) {
    return false;
  }
  if (isAtom(from, 'never')) {
    return true;
  }
  seen.add(key);
  if (from.kind === 'class' && to.kind === 'class') {
    return classToClass(table, source, target);
  }
  if (from.kind === 'class' && to.kind === 'interface') {
    return classToInterface(relate, table, source, to, seen);
  }
  return (
    combinatorOf(relate, table, from, to, source, target, seen) ??
    widenerOf(relate, table, from, to, target, seen) ??
    pairs[from.kind]?.[to.kind]?.(table, from, to, seen) ??
    false
  );
};

// S|T → U 每个成员都要能赋；S → U|V 命中一个即可。
// S → U&V 两边都要收；S&T → U 有一边能赋即可。顺序不能换。
const combinatorOf = (
  relate: Relate,
  table: TypeTable,
  from: TypeRecord,
  to: TypeRecord,
  source: TypeId,
  target: TypeId,
  seen: Set<string>,
) => {
  if (from.kind === 'union') {
    return from.members.every((member) => {
      return relate(table, member, target, seen);
    });
  }
  if (to.kind === 'union') {
    return to.members.some((member) => {
      return relate(table, source, member, seen);
    });
  }
  if (to.kind === 'intersection') {
    return to.members.every((member) => {
      return relate(table, source, member, seen);
    });
  }
  if (from.kind === 'intersection') {
    return from.members.some((member) => {
      return relate(table, member, target, seen);
    });
  }
  return null;
};

// 更窄身份丢到基础类型：字面量/品牌看 base，unique symbol 只到 symbol。
const widenerOf = (
  relate: Relate,
  table: TypeTable,
  from: TypeRecord,
  to: TypeRecord,
  target: TypeId,
  seen: Set<string>,
) => {
  if (from.kind === 'literal') {
    return relate(table, from.base, target, seen);
  }
  if (from.kind === 'brand') {
    return relate(table, from.base, target, seen);
  }
  if (from.kind === 'uniqueSymbol') {
    return isAtom(to, 'symbol');
  }
  return null;
};

// 源 kind → 目标 kind。没登记的格子就是不兼容（this / 泛型 / unknown 也走这里）。
const pairsOf = (relate: Relate): Record<string, Record<string, PairRule>> => ({
  object: {
    object: (table, from, to, seen) => {
      return objectToObject(
        relate,
        table,
        from as Of<'object'>,
        to as Of<'object'>,
        seen,
      );
    },
    interface: (table, from, to, seen) => {
      return objectToInterface(
        relate,
        table,
        from as Of<'object'>,
        to as Of<'interface'>,
        seen,
      );
    },
    dictionary: (table, from, to, seen) => {
      return objectToDictionary(
        relate,
        table,
        from as Of<'object'>,
        to as Of<'dictionary'>,
        seen,
      );
    },
  },
  array: {
    array: (_table, from, to) => {
      return arrayToArray(from as Of<'array'>, to as Of<'array'>);
    },
    dictionary: (table, from, to, _seen) => {
      return arrayToDictionary(
        relate,
        table,
        from as Of<'array'>,
        to as Of<'dictionary'>,
      );
    },
  },
  tuple: {
    tuple: (table, from, to) => {
      return tupleToTuple(table, from as Of<'tuple'>, to as Of<'tuple'>);
    },
    array: (table, from, to) => {
      return tupleToArray(table, from as Of<'tuple'>, to as Of<'array'>);
    },
  },
  function: {
    function: (table, from, to, seen) => {
      return functionToFunction(
        relate,
        table,
        (from as Of<'function'>).signatures,
        (to as Of<'function'>).signatures,
        seen,
      );
    },
  },
  construct: {
    construct: (table, from, to, seen) => {
      return functionToFunction(
        relate,
        table,
        (from as Of<'construct'>).signatures,
        (to as Of<'construct'>).signatures,
        seen,
      );
    },
  },
  enumMember: {
    enum: (_table, from, to) => {
      return from.kind === 'enumMember' && equal(from.enum, to.id);
    },
  },
  interface: {
    // 接口是多态视图，不能恢复成精确对象。
    object: pending,
    interface: (table, from, to, seen) => {
      return interfaceToInterface(
        relate,
        table,
        from as Of<'interface'>,
        to as Of<'interface'>,
        seen,
      );
    },
  },
  dictionary: {
    dictionary: (table, from, to, seen) => {
      return dictionaryToDictionary(
        relate,
        table,
        from as Of<'dictionary'>,
        to as Of<'dictionary'>,
        seen,
      );
    },
  },
});
