import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';

export function resolveConstructor(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSConstructorType') {
    return null;
  }
  // TODO: `new (args) => T` 是构造入口，不能挂成 function，也不能挂成带 decl 的 classCtor。等图鉴补结构性构造签名。
  return null;
}
