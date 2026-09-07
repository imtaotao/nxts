import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from './index';
import type { TypeId } from '../types';
import { internBuiltin } from '../link/builtin';
import { hasTypeParams, typeParamsOf } from './ast';
import { recordClassBody } from './classBody';
import { aliasDeclOf, interfaceShape, typeDeclOf } from './intern';

const genericOf = (hang: Hang, symbolId: number, args: TypeId[]) => {
  return hang.context.table.intern({
    kind: 'generic',
    decl: { fileId: hang.file.snapshot.fileId, symbolId },
    args,
  });
};

const allDefaults = (params: Node | null) => {
  return (
    !isNil(params) &&
    params.type === 'TSTypeParameterDeclaration' &&
    params.params.length > 0 &&
    params.params.every((param) => !isNil(param.default))
  );
};

const substOf = (hang: Hang, params: Node | null, args: TypeId[]) => {
  if (isNil(params) || params.type !== 'TSTypeParameterDeclaration') {
    return null;
  }
  if (args.length > params.params.length) {
    return null;
  }
  const subst = new Map<number, TypeId>();
  for (let index = 0; index < params.params.length; index += 1) {
    const param = params.params[index];
    const symbolId = hang.symbolIn(param.name, 'type');
    if (isNil(symbolId)) {
      return null;
    }
    let typeId: TypeId | null = index < args.length ? args[index] : null;
    if (isNil(typeId)) {
      if (isNil(param.default)) {
        return null;
      }
      typeId = hang.resolveAtomType(param.default, subst);
    }
    if (isNil(typeId)) {
      return null;
    }
    subst.set(symbolId, typeId);
  }
  return subst;
};

const filledArgs = (
  hang: Hang,
  params: Node | null,
  subst: ReadonlyMap<number, TypeId>,
) => {
  if (isNil(params) || params.type !== 'TSTypeParameterDeclaration') {
    return null;
  }
  const out: TypeId[] = [];
  for (const param of params.params) {
    const symbolId = hang.symbolIn(param.name, 'type');
    const typeId = isNil(symbolId) ? null : (subst.get(symbolId) ?? null);
    if (isNil(typeId)) {
      return null;
    }
    out.push(typeId);
  }
  return out;
};

const instantiateAlias = (
  hang: Hang,
  symbolId: number,
  alias: Extract<Node, { type: 'TSTypeAliasDeclaration' }>,
  args: TypeId[],
): TypeId | null => {
  const subst = substOf(hang, typeParamsOf(alias.typeParameters), args);
  if (isNil(subst)) {
    return null;
  }
  const filled = filledArgs(hang, typeParamsOf(alias.typeParameters), subst);
  if (isNil(filled)) {
    return null;
  }
  if (hang.resolving.has(symbolId)) {
    return genericOf(hang, symbolId, filled);
  }
  hang.resolving.add(symbolId);
  const expanded = hang.resolveAtomType(alias.typeAnnotation, subst);
  hang.resolving.delete(symbolId);
  if (!isNil(expanded)) {
    return expanded;
  }
  return genericOf(hang, symbolId, filled);
};

const instantiate = (
  hang: Hang,
  symbolId: number,
  args: TypeId[],
): TypeId | null => {
  const symbol = hang.file.symbols[symbolId] ?? null;
  if (
    !isNil(symbol?.builtinId) &&
    isNil(internBuiltin(hang.context.table, symbol.builtinId))
  ) {
    return hang.context.table.intern({
      kind: 'generic',
      decl: hang.context.builtinDecl(symbol.builtinId),
      args,
    });
  }
  const alias = aliasDeclOf(hang, symbolId);
  if (!isNil(alias) && hasTypeParams(alias)) {
    return instantiateAlias(hang, symbolId, alias, args);
  }
  const decl = typeDeclOf(hang, symbolId);
  if (isNil(decl)) {
    return genericOf(hang, symbolId, args);
  }
  if (decl.type === 'ClassDeclaration' || decl.type === 'ClassExpression') {
    const params = typeParamsOf(decl.typeParameters);
    const subst = substOf(hang, params, args);
    const filled = isNil(subst) ? null : filledArgs(hang, params, subst);
    if (isNil(filled) || isNil(subst)) {
      return null;
    }
    const typeId = hang.context.table.intern({
      kind: 'class',
      decl: { fileId: hang.file.snapshot.fileId, symbolId },
      args: filled,
    });
    recordClassBody(hang, typeId, decl, subst);
    return typeId;
  }
  if (decl.type === 'TSInterfaceDeclaration') {
    const subst = substOf(hang, typeParamsOf(decl.typeParameters), args);
    if (isNil(subst)) {
      return null;
    }
    const filled = filledArgs(hang, typeParamsOf(decl.typeParameters), subst);
    if (isNil(filled)) {
      return null;
    }
    const shape = interfaceShape(hang, decl, subst);
    if (!isNil(shape)) {
      return shape;
    }
    return genericOf(hang, symbolId, filled);
  }
  return genericOf(hang, symbolId, args);
};

const instantiateIfDefaults = (hang: Hang, symbolId: number) => {
  const alias = aliasDeclOf(hang, symbolId);
  if (!isNil(alias) && allDefaults(typeParamsOf(alias.typeParameters))) {
    return instantiate(hang, symbolId, []);
  }
  const decl = typeDeclOf(hang, symbolId);
  if (
    !isNil(decl) &&
    (decl.type === 'ClassDeclaration' ||
      decl.type === 'ClassExpression' ||
      decl.type === 'TSInterfaceDeclaration') &&
    allDefaults(typeParamsOf(decl.typeParameters))
  ) {
    return instantiate(hang, symbolId, []);
  }
  return null;
};

// 带实参实例化
// `Cell<i32>`
// `Named<string>`
// `Promise<i32>`
export function instantiateRef(hang: Hang, symbolId: number, args: TypeId[]) {
  const target = hang.context.ctorOf(hang, symbolId);
  return instantiate(target.hang, target.symbolId, args);
}

// 默认实参。`type Box<T = number> = T` 写成 `Box`
export function instantiateDefaults(hang: Hang, symbolId: number) {
  const target = hang.context.ctorOf(hang, symbolId);
  return instantiateIfDefaults(target.hang, target.symbolId);
}
