import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from './index';
import type { MemberRole, ObjectMember, TypeId } from '../types';
import { hasTypeParams } from './ast';
import { constructTypeOf, functionTypeOf } from './resolve/function';

export function aliasDeclOf(hang: Hang, symbolId: number) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSTypeAliasDeclaration') {
      continue;
    }
    if (hang.symbolIn(node.id, 'type') === symbolId) {
      return node;
    }
  }
  return null;
}

export function typeDeclOf(hang: Hang, symbolId: number) {
  for (const node of hang.file.nodes) {
    if (
      node.type !== 'TSEnumDeclaration' &&
      node.type !== 'ClassDeclaration' &&
      node.type !== 'ClassExpression' &&
      node.type !== 'TSInterfaceDeclaration'
    ) {
      continue;
    }
    if (isNil(node.id)) {
      continue;
    }
    if (hang.symbolIn(node.id, 'type') === symbolId) {
      return node;
    }
  }
  return null;
}

const typeParamOf = (hang: Hang, symbolId: number) => {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSTypeParameter') {
      continue;
    }
    if (hang.symbolIn(node.name, 'type') === symbolId) {
      return node;
    }
  }
  return null;
};

const roleOf = (kind: unknown): MemberRole => {
  if (kind === 'get' || kind === 'set') {
    return kind;
  }
  return 'method';
};

const fieldOf = (
  hang: Hang,
  member: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (member.type !== 'TSPropertySignature') {
    return null;
  }
  if (member.computed || member.key.type !== 'Identifier') {
    return null;
  }
  if (isNil(member.typeAnnotation)) {
    return null;
  }
  const typeId = hang.resolveAtomType(member.typeAnnotation, subst);
  if (isNil(typeId)) {
    return null;
  }
  return {
    key: member.key.name,
    type: typeId,
    optional: member.optional === true,
    readonly: member.readonly === true,
    role: 'field' as const,
  };
};

const indexKeyAtom = (hang: Hang, typeId: TypeId) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (
    record?.kind === 'atom' &&
    (record.atom === 'string' || record.atom === 'number')
  ) {
    return typeId;
  }
  return null;
};

const indexOf = (
  hang: Hang,
  member: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (member.type !== 'TSIndexSignature') {
    return null;
  }
  const param = member.parameters[0] ?? null;
  if (
    isNil(param) ||
    param.type !== 'Identifier' ||
    isNil(param.typeAnnotation)
  ) {
    return null;
  }
  if (isNil(member.typeAnnotation)) {
    return null;
  }
  const keyId = hang.resolveAtomType(param.typeAnnotation, subst);
  const value = hang.resolveAtomType(member.typeAnnotation, subst);
  const key = isNil(keyId) ? null : indexKeyAtom(hang, keyId);
  if (isNil(key) || isNil(value)) {
    return null;
  }
  return {
    key,
    value,
    readonly: member.readonly === true,
  };
};

const methodOf = (
  hang: Hang,
  member: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (member.type !== 'TSMethodSignature') {
    return null;
  }
  if (member.computed || member.key.type !== 'Identifier') {
    return null;
  }
  const typeId = functionTypeOf(hang, member.params, member.returnType, subst);
  if (isNil(typeId)) {
    return null;
  }
  return {
    key: member.key.name,
    type: typeId,
    optional: member.optional === true,
    readonly: false,
    role: roleOf('kind' in member ? member.kind : null),
  };
};

export function signatureBody(
  hang: Hang,
  members: readonly Node[],
  subst?: ReadonlyMap<number, TypeId>,
) {
  const props: ObjectMember[] = [];
  const calls: TypeId[] = [];
  const constructs: TypeId[] = [];
  let index: { key: TypeId; value: TypeId; readonly: boolean } | null = null;
  for (const member of members) {
    if (member.type === 'TSPropertySignature') {
      const field = fieldOf(hang, member, subst);
      if (isNil(field)) {
        return null;
      }
      props.push(field);
      continue;
    }
    if (member.type === 'TSMethodSignature') {
      const method = methodOf(hang, member, subst);
      if (isNil(method)) {
        return null;
      }
      props.push(method);
      continue;
    }
    if (member.type === 'TSCallSignatureDeclaration') {
      const typeId = functionTypeOf(
        hang,
        member.params,
        member.returnType,
        subst,
      );
      if (isNil(typeId)) {
        return null;
      }
      calls.push(typeId);
      continue;
    }
    if (member.type === 'TSConstructSignatureDeclaration') {
      const typeId = constructTypeOf(
        hang,
        member.params,
        member.returnType,
        subst,
      );
      if (isNil(typeId)) {
        return null;
      }
      constructs.push(typeId);
      continue;
    }
    if (member.type === 'TSIndexSignature') {
      const item = indexOf(hang, member, subst);
      if (isNil(item)) {
        return null;
      }
      if (!isNil(index)) {
        // TODO: 字符串与数值双索引要进同一条 dictionary。继续：T30 已定；先扩展 dictionary 形状能存两套索引。
        return null;
      }
      index = item;
      continue;
    }
    return null;
  }
  return { props, calls, constructs, index };
}

export function signatureProps(
  hang: Hang,
  members: readonly Node[],
  subst?: ReadonlyMap<number, TypeId>,
) {
  const body = signatureBody(hang, members, subst);
  if (
    isNil(body) ||
    body.calls.length > 0 ||
    body.constructs.length > 0 ||
    !isNil(body.index)
  ) {
    return null;
  }
  return body.props;
}

export function internTypeParam(hang: Hang, symbolId: number) {
  const node = typeParamOf(hang, symbolId);
  if (isNil(node)) {
    return null;
  }
  const typeId = hang.context.table.intern({
    kind: 'typeParam',
    decl: { fileId: hang.file.snapshot.fileId, symbolId },
  });
  hang.symbolTypes[symbolId] = typeId;
  hang.hangNode(node.name, typeId);
  return typeId;
}

const internEnum = (
  hang: Hang,
  node: Extract<Node, { type: 'TSEnumDeclaration' }>,
  symbolId: number,
) => {
  const typeId = hang.context.table.intern({
    kind: 'enum',
    decl: { fileId: hang.file.snapshot.fileId, symbolId },
  });
  hang.symbolTypes[symbolId] = typeId;
  const valueId = hang.symbolIn(node.id, 'value');
  if (!isNil(valueId)) {
    hang.symbolTypes[valueId] = typeId;
  }
  return typeId;
};

const internClass = (
  hang: Hang,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
  symbolId: number,
) => {
  if (isNil(node.id) || hasTypeParams(node)) {
    return null;
  }
  const decl = { fileId: hang.file.snapshot.fileId, symbolId };
  const instance = hang.context.table.intern({
    kind: 'class',
    decl,
    args: [],
  });
  const ctor = hang.context.table.intern({
    kind: 'classCtor',
    decl,
    args: [],
  });
  hang.symbolTypes[symbolId] = instance;
  const valueId = hang.symbolIn(node.id, 'value');
  if (!isNil(valueId)) {
    hang.symbolTypes[valueId] = ctor;
  }
  return instance;
};

const inheritOf = (
  hang: Hang,
  typeId: TypeId,
  props: ObjectMember[],
  calls: TypeId[],
  constructs: TypeId[],
) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind === 'interface') {
    props.push(...record.props);
    calls.push(...record.calls);
    constructs.push(...record.constructs);
    return true;
  }
  if (record?.kind === 'object') {
    props.push(...record.props);
    calls.push(...record.calls);
    constructs.push(...record.constructs);
    return true;
  }
  if (record?.kind === 'function') {
    calls.push(typeId);
    return true;
  }
  if (record?.kind === 'construct') {
    constructs.push(typeId);
    return true;
  }
  if (record?.kind === 'dictionary') {
    // TODO: extends 字典要合并 key/value。继续：T30 已定；heritage 已能拿到 TypeId，这里补合并。
    return false;
  }
  return false;
};

const heritageTypeOf = (
  hang: Hang,
  node: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (
    node.type !== 'TSInterfaceHeritage' ||
    node.expression.type !== 'Identifier'
  ) {
    return null;
  }
  if (!isNil(node.typeArguments)) {
    // TODO: extends Named<T> 要走 instantiateRef。继续：T37 instantiate 已有；把入口挂到 Hang 上，intern 不要直接 import。
    return null;
  }
  const symbolId = hang.symbolIn(node.expression, 'type');
  if (isNil(symbolId)) {
    return null;
  }
  return subst?.get(symbolId) ?? hang.typeOfTypeSymbol(symbolId);
};

const mergeOwn = (inherited: ObjectMember[], own: ObjectMember[]) => {
  const byKey = new Map(inherited.map((prop) => [prop.key, prop]));
  for (const prop of own) {
    byKey.set(prop.key, prop);
  }
  return [...byKey.values()];
};

const sameMember = (left: ObjectMember, right: ObjectMember) =>
  left.type === right.type &&
  left.optional === right.optional &&
  left.readonly === right.readonly &&
  left.role === right.role;

const flattenParents = (inherited: ObjectMember[]) => {
  const byKey = new Map<string, ObjectMember>();
  for (const prop of inherited) {
    const current = byKey.get(prop.key) ?? null;
    if (isNil(current)) {
      byKey.set(prop.key, prop);
      continue;
    }
    if (!sameMember(current, prop)) {
      return null;
    }
  }
  return [...byKey.values()];
};

const mergeSignatures = (
  hang: Hang,
  typeIds: readonly TypeId[],
  kind: 'function' | 'construct',
) => {
  if (typeIds.length === 1) {
    return typeIds[0] ?? null;
  }
  const signatures = [];
  for (const typeId of typeIds) {
    const record = hang.context.table.types[typeId] ?? null;
    if (record?.kind !== kind) {
      return null;
    }
    signatures.push(...record.signatures);
  }
  return hang.context.table.intern({ kind, signatures });
};

export function collapseCallable(
  hang: Hang,
  props: readonly ObjectMember[],
  calls: readonly TypeId[],
  constructs: readonly TypeId[],
) {
  if (props.length === 0 && constructs.length === 0 && calls.length > 0) {
    return mergeSignatures(hang, calls, 'function');
  }
  if (props.length === 0 && calls.length === 0 && constructs.length > 0) {
    return mergeSignatures(hang, constructs, 'construct');
  }
  return null;
}

export function dictionaryOf(
  hang: Hang,
  props: readonly ObjectMember[],
  index: { key: TypeId; value: TypeId; readonly: boolean },
  calls: readonly TypeId[],
  constructs: readonly TypeId[],
) {
  if (calls.length > 0 || constructs.length > 0) {
    // TODO: 字典再带调用/构造还没有合在一条上的形状。继续：T29/T32 已定；先定图鉴是 interface 带 index 还是 dictionary 带 calls。
    return null;
  }
  return hang.context.table.intern({
    kind: 'dictionary',
    key: index.key,
    value: index.value,
    readonly: index.readonly,
    props,
  });
}

export function interfaceShape(
  hang: Hang,
  node: Extract<Node, { type: 'TSInterfaceDeclaration' }>,
  subst?: ReadonlyMap<number, TypeId>,
) {
  const inheritedProps: ObjectMember[] = [];
  const inheritedCalls: TypeId[] = [];
  const inheritedConstructs: TypeId[] = [];
  for (const parent of node.extends ?? []) {
    const typeId = heritageTypeOf(hang, parent, subst);
    if (
      isNil(typeId) ||
      !inheritOf(
        hang,
        typeId,
        inheritedProps,
        inheritedCalls,
        inheritedConstructs,
      )
    ) {
      return null;
    }
  }
  const parents = flattenParents(inheritedProps);
  if (isNil(parents)) {
    return null;
  }
  const own = signatureBody(hang, node.body.body, subst);
  if (isNil(own)) {
    return null;
  }
  const props = mergeOwn(parents, own.props);
  const calls = [...inheritedCalls, ...own.calls];
  const constructs = [...inheritedConstructs, ...own.constructs];
  if (!isNil(own.index)) {
    return dictionaryOf(hang, props, own.index, calls, constructs);
  }
  const collapsed = collapseCallable(hang, props, calls, constructs);
  if (!isNil(collapsed)) {
    return collapsed;
  }
  return hang.context.table.intern({
    kind: 'interface',
    props,
    calls,
    constructs,
    args: [],
  });
}

const internInterface = (
  hang: Hang,
  node: Extract<Node, { type: 'TSInterfaceDeclaration' }>,
  symbolId: number,
) => {
  if (hasTypeParams(node)) {
    return null;
  }
  const typeId = interfaceShape(hang, node);
  if (isNil(typeId)) {
    return null;
  }
  hang.symbolTypes[symbolId] = typeId;
  return typeId;
};

export function internNominal(hang: Hang, symbolId: number) {
  const node = typeDeclOf(hang, symbolId);
  if (isNil(node)) {
    return null;
  }
  if (node.type === 'TSEnumDeclaration') {
    return internEnum(hang, node, symbolId);
  }
  if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
    return internClass(hang, node, symbolId);
  }
  return internInterface(hang, node, symbolId);
}
