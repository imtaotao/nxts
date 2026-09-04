import { isNil } from 'aidly';
import type { ObjectMember } from '../../types';
import type { TypeTable } from '../typeTable';
import { functionToFunction, signaturesFrom } from './function';
import type { Of, Relate } from './shared';

const mixedOf = (
  props: readonly ObjectMember[],
  calls: readonly number[],
  constructs: readonly number[],
) => {
  return (
    (calls.length > 0 && constructs.length > 0) ||
    (props.length > 0 && (calls.length > 0 || constructs.length > 0))
  );
};

const callablesOf = (
  relate: Relate,
  table: TypeTable,
  source: readonly number[],
  target: readonly number[],
  seen: Set<string>,
) => {
  if (target.length === 0) {
    return true;
  }
  const from = signaturesFrom(table, source);
  const to = signaturesFrom(table, target);
  if (isNil(from) || isNil(to)) {
    return false;
  }
  return functionToFunction(relate, table, from, to, seen);
};

// 角色、可选、只读不能放宽。只读字段协变；可写字段两边都要兼容。
export function memberOf(
  relate: Relate,
  table: TypeTable,
  source: ObjectMember,
  target: ObjectMember,
  seen: Set<string>,
) {
  if (source.role !== target.role) {
    return false;
  }
  if (target.optional === false && source.optional === true) {
    return false;
  }
  if (target.readonly === false && source.readonly === true) {
    return false;
  }
  if (target.readonly) {
    return relate(table, source.type, target.type, seen);
  }
  return (
    relate(table, source.type, target.type, seen) &&
    relate(table, target.type, source.type, seen)
  );
}

const propsOf = (
  relate: Relate,
  table: TypeTable,
  source: readonly ObjectMember[],
  target: readonly ObjectMember[],
  seen: Set<string>,
  exact: boolean,
) => {
  if (exact && source.length !== target.length) {
    return false;
  }
  return target.every((prop) => {
    const from = source.find((item) => item.key === prop.key) ?? null;
    return !isNil(from) && memberOf(relate, table, from, prop, seen);
  });
};

// 精确对象：键集合必须相同，多一个字段都不行。调用/属性不能混。
export function objectToObject(
  relate: Relate,
  table: TypeTable,
  source: Of<'object'>,
  target: Of<'object'>,
  seen: Set<string>,
) {
  if (
    mixedOf(source.props, source.calls, source.constructs) ||
    mixedOf(target.props, target.calls, target.constructs)
  ) {
    return false;
  }
  return (
    propsOf(relate, table, source.props, target.props, seen, true) &&
    callablesOf(relate, table, source.calls, target.calls, seen) &&
    callablesOf(relate, table, source.constructs, target.constructs, seen)
  );
}

// 对象 → 接口：目标成员都满足即可，多出来的字段留在原对象上。
export function objectToInterface(
  relate: Relate,
  table: TypeTable,
  source: Of<'object'>,
  target: Of<'interface'>,
  seen: Set<string>,
) {
  if (mixedOf(target.props, target.calls, target.constructs)) {
    return false;
  }
  return (
    propsOf(relate, table, source.props, target.props, seen, false) &&
    callablesOf(relate, table, source.calls, target.calls, seen) &&
    callablesOf(relate, table, source.constructs, target.constructs, seen)
  );
}

// 接口 → 上位接口：目标成员都满足即可。不能恢复成精确对象。
export function interfaceToInterface(
  relate: Relate,
  table: TypeTable,
  source: Of<'interface'>,
  target: Of<'interface'>,
  seen: Set<string>,
) {
  if (
    mixedOf(source.props, source.calls, source.constructs) ||
    mixedOf(target.props, target.calls, target.constructs)
  ) {
    return false;
  }
  return (
    propsOf(relate, table, source.props, target.props, seen, false) &&
    callablesOf(relate, table, source.calls, target.calls, seen) &&
    callablesOf(relate, table, source.constructs, target.constructs, seen)
  );
}
