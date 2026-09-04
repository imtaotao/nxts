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
  // TODO: this 要绑到当前 class/interface 的实例 TypeId。继续：等 T56 定稿；check/this 负责绑定，这里只读已绑的 TypeId。
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
  // TODO: x is T 是收窄谓词，不是返回值本身。继续：T06 已定；等 flow/narrow 开工，这里只解析 T。
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
  // TODO: import('x').Y 要走模块链接。继续：等 T55 定稿是否接受 import() 类型，且 binder 能产出链接；现在只有静态 import 的 ModuleLink。
  return null;
}

export function resolveRejectedKeyword(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  // TODO: any / unknown / object / bigint / intrinsic 不是有效原子。继续：规范已拒；等 catalog 诊断接上，这里保持空，不能填 unknown。
  void type;
  return null;
}
