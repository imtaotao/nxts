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
  // TODO: typeof 要读值空间 TypeId。hangTypes 在 hangValues 之前，值还没挂上；等编排把值挂进类型不动点，或 check 后再回填。
  return null;
}
