import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';

export function resolveQuery(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTypeQuery') {
    return null;
  }
  // TODO: typeof 要读值空间 TypeId。继续：T40 已定；等 hang 编排改成类型/值不动点，或 hangValues 后再回填 typeof。
  return null;
}
