import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { TypeId } from '../../types';
import { typeArgsOf } from '../ast';
import { instantiateDefaults, instantiateRef } from '../instantiate';
import { finish } from './shared';

export function resolveReference(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return null;
  }

  const symbolId = hang.symbolIn(type.typeName, 'type');
  if (isNil(symbolId)) {
    return null;
  }

  const args = typeArgsOf(type);
  if (!isNil(args)) {
    const argIds: TypeId[] = [];
    for (const arg of args) {
      const typeId = hang.resolveAtomType(arg, subst);
      if (isNil(typeId)) {
        return null;
      }
      argIds.push(typeId);
    }
    return finish(hang, type, instantiateRef(hang, symbolId, argIds), subst);
  }

  const substituted = subst?.get(symbolId) ?? null;
  if (!isNil(substituted)) {
    return substituted;
  }
  const typeId = hang.typeOfTypeSymbol(symbolId);

  if (!isNil(typeId)) {
    if (isNil(subst)) {
      hang.hangNode(type, typeId);
      hang.hangNode(type.typeName, typeId);
    }
    return typeId;
  }
  return finish(hang, type, instantiateDefaults(hang, symbolId), subst);
}
