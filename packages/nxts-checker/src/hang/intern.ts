import type { Node } from '@babel/types';
import type { MemberRole, ObjectMember, TypeId } from '../types';
import type { Hang } from './index';
import { hasTypeParams } from './ast';
import { functionTypeOf } from './resolve/function';

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
    if (node.id == null) {
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
  if (member.typeAnnotation == null) {
    return null;
  }
  const typeId = hang.resolveAtomType(member.typeAnnotation, subst);
  if (typeId == null) {
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
  if (typeId == null) {
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
  for (const member of members) {
    if (member.type === 'TSPropertySignature') {
      const field = fieldOf(hang, member, subst);
      if (field == null) {
        return null;
      }
      props.push(field);
      continue;
    }
    if (member.type === 'TSMethodSignature') {
      const method = methodOf(hang, member, subst);
      if (method == null) {
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
      if (typeId == null) {
        return null;
      }
      calls.push(typeId);
      continue;
    }
    // TODO: TSIndexSignature 要挂成 dictionary；TSConstructSignatureDeclaration 要等构造签名图鉴。
    return null;
  }
  return { props, calls };
}

export function signatureProps(
  hang: Hang,
  members: readonly Node[],
  subst?: ReadonlyMap<number, TypeId>,
) {
  const body = signatureBody(hang, members, subst);
  if (body == null || body.calls.length > 0) {
    return null;
  }
  return body.props;
}

export function internTypeParam(hang: Hang, symbolId: number) {
  const node = typeParamOf(hang, symbolId);
  if (node == null) {
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
  if (valueId != null) {
    hang.symbolTypes[valueId] = typeId;
  }
  return typeId;
};

const internClass = (
  hang: Hang,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
  symbolId: number,
) => {
  if (node.id == null || hasTypeParams(node)) {
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
  if (valueId != null) {
    hang.symbolTypes[valueId] = ctor;
  }
  return instance;
};

const inheritOf = (
  hang: Hang,
  typeId: TypeId,
  props: ObjectMember[],
  calls: TypeId[],
) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind === 'interface') {
    props.push(...record.props);
    calls.push(...record.calls);
    return true;
  }
  if (record?.kind === 'object') {
    props.push(...record.props);
    return true;
  }
  if (record?.kind === 'function') {
    calls.push(typeId);
    return true;
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
  if (node.typeArguments != null) {
    // TODO: extends Named<T> 要走 instantiateRef；intern 不能直接引 instantiate，避免成环。
    return null;
  }
  const symbolId = hang.symbolIn(node.expression, 'type');
  if (symbolId == null) {
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
    if (current == null) {
      byKey.set(prop.key, prop);
      continue;
    }
    if (!sameMember(current, prop)) {
      return null;
    }
  }
  return [...byKey.values()];
};

const functionOfCalls = (hang: Hang, calls: readonly TypeId[]) => {
  if (calls.length === 1) {
    return calls[0] ?? null;
  }
  const signatures = [];
  for (const call of calls) {
    const record = hang.context.table.types[call] ?? null;
    if (record?.kind !== 'function') {
      return null;
    }
    signatures.push(...record.signatures);
  }
  return hang.context.table.intern({
    kind: 'function',
    signatures,
  });
};

export function interfaceShape(
  hang: Hang,
  node: Extract<Node, { type: 'TSInterfaceDeclaration' }>,
  subst?: ReadonlyMap<number, TypeId>,
) {
  const inheritedProps: ObjectMember[] = [];
  const inheritedCalls: TypeId[] = [];
  for (const parent of node.extends ?? []) {
    const typeId = heritageTypeOf(hang, parent, subst);
    if (
      typeId == null ||
      !inheritOf(hang, typeId, inheritedProps, inheritedCalls)
    ) {
      return null;
    }
  }
  const parents = flattenParents(inheritedProps);
  if (parents == null) {
    return null;
  }
  const own = signatureBody(hang, node.body.body, subst);
  if (own == null) {
    return null;
  }
  const props = mergeOwn(parents, own.props);
  const calls = [...inheritedCalls, ...own.calls];
  if (props.length === 0 && calls.length > 0) {
    return functionOfCalls(hang, calls);
  }
  return hang.context.table.intern({
    kind: 'interface',
    props,
    calls,
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
  if (typeId == null) {
    return null;
  }
  hang.symbolTypes[symbolId] = typeId;
  return typeId;
};

export function internNominal(hang: Hang, symbolId: number) {
  const node = typeDeclOf(hang, symbolId);
  if (node == null) {
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
