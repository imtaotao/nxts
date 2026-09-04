import type { Identifier, Node } from '@babel/types';
import type { BindFileResult } from '@nxts/binder';
import type { CheckContext } from '../context';
import { atomKindOfKeyword, internBuiltin } from '../link/builtin';
import type { TypeId } from '../types';

const nodeIdOf = (file: BindFileResult, node: object) =>
  file.nodeIds.get(node as BindFileResult['nodes'][number]) ?? null;

const symbolIn = (
  file: BindFileResult,
  node: object,
  space: 'value' | 'type',
) => {
  const nodeId = nodeIdOf(file, node);
  if (nodeId == null) {
    return null;
  }
  for (const id of file.nodeToSymbols[nodeId] ?? []) {
    if (file.symbols[id]?.space === space) {
      return id;
    }
  }
  return null;
};

const resolveAtomType = (
  context: CheckContext,
  file: BindFileResult,
  node: Node,
) => {
  const keyword = atomKindOfKeyword(node.type);
  if (keyword != null) {
    return context.table.atom(keyword);
  }
  if (node.type !== 'TSTypeReference' || node.typeName.type !== 'Identifier') {
    return null;
  }
  const symbolId = symbolIn(file, node.typeName, 'type');
  if (symbolId == null) {
    return null;
  }
  const builtinId = file.symbols[symbolId]?.builtinId ?? null;
  if (builtinId == null) {
    return null;
  }
  return internBuiltin(context.table, builtinId);
};

const hangIdentifier = (
  context: CheckContext,
  file: BindFileResult,
  node: Identifier,
  symbolTypes: (TypeId | null)[],
  nodeTypes: (TypeId | null)[],
) => {
  const annotation = node.typeAnnotation;
  if (annotation == null || annotation.type !== 'TSTypeAnnotation') {
    return;
  }
  const typeId = resolveAtomType(context, file, annotation.typeAnnotation);
  if (typeId == null) {
    return;
  }
  const symbolId = symbolIn(file, node, 'value');
  if (symbolId != null) {
    symbolTypes[symbolId] = typeId;
  }
  const nameNodeId = nodeIdOf(file, node);
  if (nameNodeId != null) {
    nodeTypes[nameNodeId] = typeId;
  }
  const typeNodeId = nodeIdOf(file, annotation.typeAnnotation);
  if (typeNodeId != null) {
    nodeTypes[typeNodeId] = typeId;
  }
};

export function checkVariables(
  context: CheckContext,
  file: BindFileResult,
  symbolTypes: (TypeId | null)[],
  nodeTypes: (TypeId | null)[],
) {
  for (const node of file.nodes) {
    if (node.type !== 'VariableDeclaration') {
      continue;
    }
    if (node.kind !== 'const' && node.kind !== 'let') {
      continue;
    }
    for (const declarator of node.declarations) {
      if (declarator.id.type !== 'Identifier') {
        continue;
      }
      hangIdentifier(context, file, declarator.id, symbolTypes, nodeTypes);
    }
  }
}
