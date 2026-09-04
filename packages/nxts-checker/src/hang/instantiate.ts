import type { Node } from '@babel/types';
import { internBuiltin } from '../link/builtin';
import type { TypeId } from '../types';
import { hasTypeParams, typeParamsOf } from './ast';
import type { Hang } from './index';
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
    params != null &&
    params.type === 'TSTypeParameterDeclaration' &&
    params.params.length > 0 &&
    params.params.every((param) => param.default != null)
  );
};

const substOf = (hang: Hang, params: Node | null, args: TypeId[]) => {
  if (params == null || params.type !== 'TSTypeParameterDeclaration') {
    return null;
  }
  if (args.length > params.params.length) {
    return null;
  }
  const subst = new Map<number, TypeId>();
  for (let index = 0; index < params.params.length; index += 1) {
    const param = params.params[index];
    const symbolId = hang.symbolIn(param.name, 'type');
    if (symbolId == null) {
      return null;
    }
    let typeId: TypeId | null = index < args.length ? args[index] : null;
    if (typeId == null) {
      if (param.default == null) {
        return null;
      }
      typeId = hang.resolveAtomType(param.default, subst);
    }
    if (typeId == null) {
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
  if (params == null || params.type !== 'TSTypeParameterDeclaration') {
    return null;
  }
  const out: TypeId[] = [];
  for (const param of params.params) {
    const symbolId = hang.symbolIn(param.name, 'type');
    const typeId = symbolId == null ? null : (subst.get(symbolId) ?? null);
    if (typeId == null) {
      return null;
    }
    out.push(typeId);
  }
  return out;
};

const instantiateArgs = (hang: Hang, params: Node | null, args: TypeId[]) => {
  const subst = substOf(hang, params, args);
  if (subst == null) {
    return null;
  }
  return filledArgs(hang, params, subst);
};

const instantiateAlias = (
  hang: Hang,
  symbolId: number,
  alias: Extract<Node, { type: 'TSTypeAliasDeclaration' }>,
  args: TypeId[],
): TypeId | null => {
  const subst = substOf(hang, typeParamsOf(alias.typeParameters), args);
  if (subst == null) {
    return null;
  }
  const filled = filledArgs(hang, typeParamsOf(alias.typeParameters), subst);
  if (filled == null) {
    return null;
  }
  if (hang.resolving.has(symbolId)) {
    return genericOf(hang, symbolId, filled);
  }
  hang.resolving.add(symbolId);
  const expanded = hang.resolveAtomType(alias.typeAnnotation, subst);
  hang.resolving.delete(symbolId);
  if (expanded != null) {
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
    symbol?.builtinId != null &&
    internBuiltin(hang.context.table, symbol.builtinId) == null
  ) {
    return hang.context.table.intern({
      kind: 'generic',
      decl: hang.context.builtinDecl(symbol.builtinId),
      args,
    });
  }
  const alias = aliasDeclOf(hang, symbolId);
  if (alias != null && hasTypeParams(alias)) {
    return instantiateAlias(hang, symbolId, alias, args);
  }
  const decl = typeDeclOf(hang, symbolId);
  if (decl == null) {
    return genericOf(hang, symbolId, args);
  }
  if (decl.type === 'ClassDeclaration' || decl.type === 'ClassExpression') {
    const filled = instantiateArgs(
      hang,
      typeParamsOf(decl.typeParameters),
      args,
    );
    if (filled == null) {
      return null;
    }
    return hang.context.table.intern({
      kind: 'class',
      decl: { fileId: hang.file.snapshot.fileId, symbolId },
      args: filled,
    });
  }
  if (decl.type === 'TSInterfaceDeclaration') {
    const subst = substOf(hang, typeParamsOf(decl.typeParameters), args);
    if (subst == null) {
      return null;
    }
    const filled = filledArgs(hang, typeParamsOf(decl.typeParameters), subst);
    if (filled == null) {
      return null;
    }
    const shape = interfaceShape(hang, decl, subst);
    if (shape != null) {
      return shape;
    }
    return genericOf(hang, symbolId, filled);
  }
  return genericOf(hang, symbolId, args);
};

const instantiateIfDefaults = (hang: Hang, symbolId: number) => {
  const alias = aliasDeclOf(hang, symbolId);
  if (alias != null && allDefaults(typeParamsOf(alias.typeParameters))) {
    return instantiate(hang, symbolId, []);
  }
  const decl = typeDeclOf(hang, symbolId);
  if (
    decl != null &&
    (decl.type === 'ClassDeclaration' ||
      decl.type === 'ClassExpression' ||
      decl.type === 'TSInterfaceDeclaration') &&
    allDefaults(typeParamsOf(decl.typeParameters))
  ) {
    return instantiate(hang, symbolId, []);
  }
  return null;
};

export function instantiateRef(hang: Hang, symbolId: number, args: TypeId[]) {
  const target = hang.context.ctorOf(hang, symbolId);
  return instantiate(target.hang, target.symbolId, args);
}

export function instantiateDefaults(hang: Hang, symbolId: number) {
  const target = hang.context.ctorOf(hang, symbolId);
  return instantiateIfDefaults(target.hang, target.symbolId);
}
