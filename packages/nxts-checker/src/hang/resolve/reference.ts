import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';
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
  if (symbolId == null) {
    return null;
  }

  const args = typeArgsOf(type);
  if (args != null) {
    const argIds: TypeId[] = [];
    for (const arg of args) {
      const typeId = hang.resolveAtomType(arg, subst);
      if (typeId == null) {
        return null;
      }
      argIds.push(typeId);
    }
    return finish(hang, type, instantiateRef(hang, symbolId, argIds), subst);
  }

  const substituted = subst?.get(symbolId) ?? null;
  if (substituted != null) {
    return substituted;
  }
  const typeId = hang.typeOfTypeSymbol(symbolId);

  if (typeId != null) {
    if (subst == null) {
      hang.hangNode(type, typeId);
      hang.hangNode(type.typeName, typeId);
    }
    return typeId;
  }
  return finish(hang, type, instantiateDefaults(hang, symbolId), subst);
}
