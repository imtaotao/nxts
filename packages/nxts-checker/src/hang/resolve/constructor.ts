import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';
import { constructTypeOf } from './function';
import { finish } from './shared';

export function resolveConstructor(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSConstructorType') {
    return null;
  }
  return finish(
    hang,
    type,
    constructTypeOf(hang, type.params, type.returnType, subst),
    subst,
  );
}
