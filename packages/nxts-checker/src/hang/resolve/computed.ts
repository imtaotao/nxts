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
  // TODO: T extends U ? X : Y。继续：T41 已定，assignable 已有；闭合后 intern 已有 kind，不新开条件条目。
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
  // TODO: infer U 只在条件匹配里收约束。继续：T41 已定；不要和 core/infer（值推导）混用。
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
  // TODO: { [K in T]: U }。继续：T41 已定；等 keyof/索引 hang 覆盖操作数（对象/接口已能查）。
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
  // TODO: `${T}` 插值是类型运算。继续：T41 已定；无插值字面量已在 literal，有插值按 T41 闭合。
  return null;
}
