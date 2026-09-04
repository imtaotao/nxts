import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';

export function resolveConditional(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSConditionalType') {
    return null;
  }
  // TODO: T extends U ? X : Y 要 relation 的可赋值判断，不能只展开 AST。
  return null;
}

export function resolveInfer(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSInferType') {
    return null;
  }
  // TODO: infer U 只在条件类型匹配里有意义，等 infer 模块收约束。
  return null;
}

export function resolveMapped(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSMappedType') {
    return null;
  }
  // TODO: { [K in T]: U } 要 keyof/索引和可选性修饰，等 T41。
  return null;
}

export function resolveTemplate(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTemplateLiteralType') {
    return null;
  }
  // TODO: `${T}` 插值是类型运算，不是无插值字符串字面量。等 T41。
  return null;
}
