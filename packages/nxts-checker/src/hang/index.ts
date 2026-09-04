import { isNil } from 'aidly';
import type { BindFileResult } from '@nxts/binder';
import type { Identifier, Node } from '@babel/types';
import type { TypeId } from '../types';
import type { CheckContext } from '../context';
import { internBuiltin } from '../link/builtin';
import { hasTypeParams, unwrapType } from './ast';
import { aliasDeclOf, internNominal, internTypeParam } from './intern';
import { hangPattern as applyPattern } from './pattern';
import { resolveByType } from './resolve';

export class Hang {
  readonly context: CheckContext;
  readonly file: BindFileResult;
  readonly symbolTypes: (TypeId | null)[];
  readonly nodeTypes: (TypeId | null)[];
  readonly resolving = new Set<number>();

  constructor(context: CheckContext, file: BindFileResult) {
    this.context = context;
    this.file = file;
    this.symbolTypes = file.symbols.map(() => null);
    this.nodeTypes = Array.from(
      { length: file.nodeToSymbols.length },
      () => null,
    );
  }

  nodeIdOf(node: object) {
    return (
      this.file.nodeIds.get(node as BindFileResult['nodes'][number]) ?? null
    );
  }

  symbolIn(node: object, space: 'value' | 'type') {
    const nodeId = this.nodeIdOf(node);
    if (isNil(nodeId)) {
      return null;
    }
    for (const id of this.file.nodeToSymbols[nodeId] ?? []) {
      if (this.file.symbols[id]?.space === space) {
        return id;
      }
    }
    return null;
  }

  hangNode(node: object, typeId: TypeId) {
    const nodeId = this.nodeIdOf(node);
    if (!isNil(nodeId)) {
      this.nodeTypes[nodeId] = typeId;
    }
  }

  typeOfTypeSymbol(symbolId: number): TypeId | null {
    const cached = this.symbolTypes[symbolId] ?? null;
    if (!isNil(cached)) {
      return cached;
    }
    const symbol = this.file.symbols[symbolId] ?? null;
    if (isNil(symbol) || symbol.space !== 'type') {
      return null;
    }
    if (!isNil(symbol.builtinId)) {
      const typeId = internBuiltin(this.context.table, symbol.builtinId);
      if (!isNil(typeId)) {
        this.symbolTypes[symbolId] = typeId;
      }
      return typeId;
    }
    if (this.resolving.has(symbolId)) {
      return null;
    }

    const alias = aliasDeclOf(this, symbolId);
    if (!isNil(alias)) {
      if (hasTypeParams(alias)) {
        return null;
      }
      this.resolving.add(symbolId);
      const typeId = this.resolveAtomType(alias.typeAnnotation);
      this.resolving.delete(symbolId);
      if (isNil(typeId)) {
        return null;
      }
      this.symbolTypes[symbolId] = typeId;
      this.hangNode(alias.id, typeId);
      this.hangNode(alias.typeAnnotation, typeId);
      return typeId;
    }

    const nominal = internNominal(this, symbolId);
    if (!isNil(nominal)) {
      return nominal;
    }
    return internTypeParam(this, symbolId);
  }

  resolveAtomType(
    node: Node,
    subst?: ReadonlyMap<number, TypeId>,
  ): TypeId | null {
    const type = unwrapType(node);
    return resolveByType[type.type]?.(this, type, subst) ?? null;
  }

  hangValueIdent(node: Identifier) {
    return applyPattern(this, node);
  }

  hangPattern(node: Node, expected?: TypeId) {
    return applyPattern(this, node, expected);
  }
}
