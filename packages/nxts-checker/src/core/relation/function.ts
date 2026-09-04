import { isNil } from 'aidly';
import type { FunctionParam, FunctionSignature, TypeId } from '../../types';
import type { TypeTable } from '../typeTable';
import { arrayElementOf, isAtom, recordOf } from './shared';
import type { Relate } from './shared';

const requiredCount = (params: readonly FunctionParam[]) => {
  let count = 0;
  for (const param of params) {
    if (param.optional || param.rest) {
      break;
    }
    count += 1;
  }
  return count;
};

export function signaturesFrom(table: TypeTable, ids: readonly TypeId[]) {
  const signatures: FunctionSignature[] = [];
  for (const id of ids) {
    const record = recordOf(table, id);
    if (record?.kind !== 'function' && record?.kind !== 'construct') {
      return null;
    }
    signatures.push(...record.signatures);
  }
  return signatures;
}

const restElement = (table: TypeTable, param: FunctionParam) => {
  return param.rest ? arrayElementOf(table, param.type) : null;
};

const returnsOf = (
  relate: Relate,
  table: TypeTable,
  source: FunctionSignature,
  target: FunctionSignature,
  seen: Set<string>,
) => {
  const fromReturn = recordOf(table, source.returnType);
  const toReturn = recordOf(table, target.returnType);
  if (isAtom(fromReturn, 'never')) {
    return isAtom(toReturn, 'never') || isAtom(toReturn, 'void');
  }
  if (isAtom(toReturn, 'void') && !isAtom(fromReturn, 'void')) {
    // 目标 void 不能吃掉有载荷的返回值。
    return false;
  }
  return relate(table, source.returnType, target.returnType, seen);
};

const receiverOf = (
  relate: Relate,
  table: TypeTable,
  source: FunctionSignature,
  target: FunctionSignature,
  seen: Set<string>,
) => {
  if (!isNil(source.receiver) && isNil(target.receiver)) {
    // 源要求 this，目标当普通函数调用会丢接收者。
    return false;
  }
  if (!isNil(source.receiver) && !isNil(target.receiver)) {
    return relate(table, target.receiver, source.receiver, seen);
  }
  return true;
};

const paramsOf = (
  relate: Relate,
  table: TypeTable,
  source: FunctionSignature,
  target: FunctionSignature,
  seen: Set<string>,
) => {
  if (requiredCount(source.params) > requiredCount(target.params)) {
    return false;
  }
  const fromParams = source.params;
  const toParams = target.params;
  const last = Math.max(fromParams.length, toParams.length);
  for (let index = 0; index < last; index += 1) {
    const from = fromParams[index] ?? null;
    const to = toParams[index] ?? null;
    if (!isNil(from) && from.rest) {
      const fromRest = restElement(table, from);
      if (isNil(fromRest)) {
        return false;
      }
      if (!isNil(to) && to.rest) {
        const toRest = restElement(table, to);
        return !isNil(toRest) && relate(table, toRest, fromRest, seen);
      }
      return toParams.slice(index).every((param) => {
        const rest = restElement(table, param);
        return relate(table, rest ?? param.type, fromRest, seen);
      });
    }
    if (!isNil(to) && to.rest) {
      const toRest = restElement(table, to);
      if (isNil(toRest)) {
        return false;
      }
      return fromParams.slice(index).every((param) => {
        const rest = restElement(table, param);
        return relate(table, toRest, rest ?? param.type, seen);
      });
    }
    if (isNil(to)) {
      return fromParams
        .slice(index)
        .every((param) => param.optional || param.rest);
    }
    if (isNil(from)) {
      continue;
    }
    if (!relate(table, to.type, from.type, seen)) {
      return false;
    }
  }
  return true;
};

const signatureOf = (
  relate: Relate,
  table: TypeTable,
  source: FunctionSignature,
  target: FunctionSignature,
  seen: Set<string>,
) => {
  return (
    receiverOf(relate, table, source, target, seen) &&
    paramsOf(relate, table, source, target, seen) &&
    returnsOf(relate, table, source, target, seen)
  );
};

// 目标每个签名都要被源的某一条盖住。源可以多几条重载。
// 参数逆变、返回协变。() => never 只直接兼容返回 never / void 的目标。
export function functionToFunction(
  relate: Relate,
  table: TypeTable,
  source: readonly FunctionSignature[],
  target: readonly FunctionSignature[],
  seen: Set<string>,
) {
  if (source.length === 0 || target.length === 0) {
    return false;
  }
  return target.every((to) => {
    return source.some((from) => {
      return signatureOf(relate, table, from, to, seen);
    });
  });
}
