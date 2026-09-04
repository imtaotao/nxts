import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';

export function resolveThisType(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSThisType') {
    return null;
  }
  // TODO: this 要绑到当前 class/interface 的实例 TypeId，等 check/this。
  return null;
}

export function resolvePredicate(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTypePredicate') {
    return null;
  }
  // TODO: x is T 是收窄谓词，不是返回值本身。等 flow/narrow。
  return null;
}

export function resolveImportType(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSImportType') {
    return null;
  }
  // TODO: import('x').Y 要走模块链接，等 link 能解析类型导入。
  return null;
}

export function resolveRejectedKeyword(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  // TODO: any / unknown / object / bigint / intrinsic 不是当前语言有效原子。若 parser 放行，这里保持空，由诊断拒绝，不能冒充 unknown。
  void type;
  return null;
}
