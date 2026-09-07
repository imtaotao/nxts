import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { TypeId } from '../../types';
import type { Hang } from '../index';
import { indexAccess, stringLiteralOf } from '../lookup';
import { finish } from './shared';

const enumDeclOf = (hang: Hang, symbolId: number) => {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSEnumDeclaration' || isNil(node.id)) {
      continue;
    }
    if (hang.symbolIn(node.id, 'value') === symbolId) {
      return node;
    }
  }
  return null;
};

const enumMemberOf = (hang: Hang, enumSymbolId: number, name: string) => {
  const node = enumDeclOf(hang, enumSymbolId);
  if (isNil(node)) {
    return null;
  }
  for (const member of node.body.members) {
    if (member.id.type !== 'Identifier' || member.id.name !== name) {
      continue;
    }
    const memberId = hang.symbolIn(member.id, 'value');
    if (isNil(memberId)) {
      return null;
    }
    return hang.symbolTypes[memberId] ?? null;
  }
  return null;
};

const valueTypeOf = (hang: Hang, symbolId: number) => {
  if (!isNil(enumDeclOf(hang, symbolId))) {
    return null;
  }
  return hang.symbolTypes[symbolId] ?? null;
};

const queryName = (hang: Hang, node: Node): TypeId | null => {
  if (node.type === 'Identifier') {
    const symbolId = hang.symbolIn(node, 'value');
    if (isNil(symbolId)) {
      return null;
    }
    return valueTypeOf(hang, symbolId);
  }
  if (node.type !== 'TSQualifiedName') {
    return null;
  }
  if (node.left.type === 'Identifier') {
    const symbolId = hang.symbolIn(node.left, 'value');
    if (!isNil(symbolId) && !isNil(enumDeclOf(hang, symbolId))) {
      return enumMemberOf(hang, symbolId, node.right.name);
    }
  }
  const object = queryName(hang, node.left);
  if (isNil(object)) {
    return null;
  }
  return indexAccess(hang, object, stringLiteralOf(hang, node.right.name));
};

// 类型查询
// `typeof n`
// `typeof f`
// `typeof Box`
// `typeof config.host`
// `typeof Kind.Ready`
export function resolveQuery(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTypeQuery') {
    return null;
  }
  return finish(hang, type, queryName(hang, type.exprName), subst);
}
