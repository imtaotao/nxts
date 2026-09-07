import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import { assignable } from '../core/relation';
import type { TypeId } from '../types';
import { typeArgsOf, unwrapType } from './ast';
import type { Hang } from './index';
import { membersOf, recordOf, unionOf } from './lookup';

export function hasInfer(node?: Node | null): boolean {
  if (isNil(node)) {
    return false;
  }
  switch (node.type) {
    case 'TSInferType':
      return true;
    case 'TSTypeAnnotation':
    case 'TSParenthesizedType':
    case 'TSTypeOperator':
    case 'TSOptionalType':
    case 'TSRestType':
      return hasInfer(node.typeAnnotation);
    case 'TSNamedTupleMember':
      return hasInfer(node.elementType);
    case 'TSArrayType':
      return hasInfer(node.elementType);
    case 'TSUnionType':
    case 'TSIntersectionType':
      return node.types.some((item) => hasInfer(item));
    case 'TSTupleType':
      return node.elementTypes.some((item) => hasInfer(item));
    case 'TSTypeReference':
      return (typeArgsOf(node) ?? []).some((item) => hasInfer(item));
    case 'TSFunctionType':
    case 'TSConstructorType':
      return (
        node.params.some((item) => hasInfer(item)) || hasInfer(node.returnType)
      );
    case 'TSIndexedAccessType':
      return hasInfer(node.objectType) || hasInfer(node.indexType);
    case 'TSTypeLiteral':
      return node.members.some((item) => hasInfer(item));
    case 'TSPropertySignature':
    case 'TSIndexSignature':
      return hasInfer(node.typeAnnotation);
    case 'TSCallSignatureDeclaration':
    case 'TSConstructSignatureDeclaration':
    case 'TSMethodSignature':
      return (
        node.params.some((item) => hasInfer(item)) || hasInfer(node.returnType)
      );
    case 'TSConditionalType':
      return (
        hasInfer(node.checkType) ||
        hasInfer(node.extendsType) ||
        hasInfer(node.trueType) ||
        hasInfer(node.falseType)
      );
    case 'TSMappedType':
      return (
        hasInfer(node.constraint) ||
        hasInfer(node.typeAnnotation) ||
        hasInfer(node.nameType)
      );
    case 'TSTemplateLiteralType':
      return node.types.some((item) => hasInfer(item));
    case 'RestElement':
      return hasInfer(node.argument) || hasInfer(node.typeAnnotation);
    case 'Identifier':
    case 'AssignmentPattern':
      return hasInfer('typeAnnotation' in node ? node.typeAnnotation : null);
    default:
      return false;
  }
}

const bindInfer = (
  hang: Hang,
  pattern: Extract<Node, { type: 'TSInferType' }>,
  source: TypeId,
  infer: Map<number, TypeId>,
) => {
  const symbolId = hang.symbolIn(pattern.typeParameter.name, 'type');
  if (isNil(symbolId)) {
    return false;
  }
  const existing = infer.get(symbolId) ?? null;
  if (!isNil(existing) && existing !== source) {
    return false;
  }
  infer.set(symbolId, source);
  return true;
};

const sameDecl = (
  hang: Hang,
  source: { fileId: number; symbolId: number },
  symbolId: number,
) => {
  const symbol = hang.file.symbols[symbolId] ?? null;
  if (!isNil(symbol?.builtinId)) {
    const decl = hang.context.builtinDecl(symbol.builtinId);
    return source.fileId === decl.fileId && source.symbolId === decl.symbolId;
  }
  const target = hang.context.ctorOf(hang, symbolId);
  return (
    source.fileId === target.hang.file.snapshot.fileId &&
    source.symbolId === target.symbolId
  );
};

const matchArgs = (
  hang: Hang,
  sources: readonly TypeId[],
  args: readonly Node[],
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: Map<number, TypeId>,
) => {
  if (sources.length !== args.length) {
    return false;
  }
  return args.every((arg, index) => {
    const source = sources[index];
    return !isNil(source) && matchType(hang, source, arg, subst, infer);
  });
};

const propsOf = (hang: Hang, typeId: TypeId) => {
  const record = recordOf(hang, typeId);
  if (record?.kind === 'object' || record?.kind === 'interface') {
    return record.props;
  }
  if (record?.kind === 'class') {
    return hang.context.table.classBodies.get(record.id)?.props ?? null;
  }
  return null;
};

const matchLiteral = (
  hang: Hang,
  source: TypeId,
  pattern: Node,
  subst: ReadonlyMap<number, TypeId> | undefined,
  _infer: Map<number, TypeId>,
) => {
  const target = hang.resolveAtomType(pattern, subst);
  if (isNil(target)) {
    return false;
  }
  return assignable(hang.context.table, source, target);
};

const matchReference = (
  hang: Hang,
  source: TypeId,
  pattern: Extract<Node, { type: 'TSTypeReference' }>,
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: Map<number, TypeId>,
) => {
  if (pattern.typeName.type !== 'Identifier') {
    return false;
  }
  const symbolId = hang.symbolIn(pattern.typeName, 'type');
  if (isNil(symbolId)) {
    return false;
  }
  const args = typeArgsOf(pattern) ?? [];
  const record = recordOf(hang, source);
  if (
    (record?.kind === 'generic' || record?.kind === 'class') &&
    args.length > 0
  ) {
    if (!sameDecl(hang, record.decl, symbolId)) {
      return false;
    }
    return matchArgs(hang, record.args, args, subst, infer);
  }
  return matchLiteral(hang, source, pattern, subst, infer);
};

const matchArray = (
  hang: Hang,
  source: TypeId,
  element: Node,
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: Map<number, TypeId>,
) => {
  const record = recordOf(hang, source);
  if (record?.kind === 'array') {
    return matchType(hang, record.element, element, subst, infer);
  }
  if (record?.kind === 'tuple') {
    const slots = record.elements
      .filter((item) => !item.rest)
      .map((item) => item.type);
    return matchType(hang, unionOf(hang, slots), element, subst, infer);
  }
  return false;
};

const matchFunction = (
  hang: Hang,
  source: TypeId,
  pattern: Extract<Node, { type: 'TSFunctionType' | 'TSConstructorType' }>,
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: Map<number, TypeId>,
) => {
  const record = recordOf(hang, source);
  const expected = pattern.type === 'TSFunctionType' ? 'function' : 'construct';
  if (record?.kind !== expected) {
    return false;
  }
  const signature = record.signatures[record.signatures.length - 1] ?? null;
  if (isNil(signature)) {
    return false;
  }
  const rest = pattern.params[0] ?? null;
  if (
    pattern.params.length === 1 &&
    rest?.type === 'RestElement' &&
    hasInfer(rest)
  ) {
    const tuple = hang.context.table.intern({
      kind: 'tuple',
      elements: signature.params.map((param) => ({
        type: param.type,
        optional: param.optional,
        rest: param.rest,
      })),
      readonly: true,
    });
    if (!matchType(hang, tuple, rest, subst, infer)) {
      return false;
    }
    if (isNil(pattern.returnType)) {
      return false;
    }
    return matchType(
      hang,
      signature.returnType,
      pattern.returnType,
      subst,
      infer,
    );
  }
  if (pattern.params.length !== signature.params.length) {
    return false;
  }
  for (const [index, param] of pattern.params.entries()) {
    const sourceParam = signature.params[index] ?? null;
    if (
      isNil(sourceParam) ||
      !matchType(hang, sourceParam.type, param, subst, infer)
    ) {
      return false;
    }
  }
  if (isNil(pattern.returnType)) {
    return false;
  }
  return matchType(
    hang,
    signature.returnType,
    pattern.returnType,
    subst,
    infer,
  );
};

const matchObject = (
  hang: Hang,
  source: TypeId,
  pattern: Extract<Node, { type: 'TSTypeLiteral' }>,
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: Map<number, TypeId>,
) => {
  const props = propsOf(hang, source);
  if (isNil(props)) {
    return false;
  }
  for (const member of pattern.members) {
    if (member.type !== 'TSPropertySignature') {
      return false;
    }
    const key = member.key;
    if (key.type !== 'Identifier') {
      return false;
    }
    const prop = props.find((item) => item.key === key.name) ?? null;
    if (isNil(prop) || isNil(member.typeAnnotation)) {
      return false;
    }
    if (!matchType(hang, prop.type, member.typeAnnotation, subst, infer)) {
      return false;
    }
  }
  return true;
};

const matchTuple = (
  hang: Hang,
  source: TypeId,
  pattern: Extract<Node, { type: 'TSTupleType' }>,
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: Map<number, TypeId>,
) => {
  const record = recordOf(hang, source);
  if (record?.kind !== 'tuple') {
    return false;
  }
  if (pattern.elementTypes.length !== record.elements.length) {
    return false;
  }
  return pattern.elementTypes.every((element, index) => {
    const slot = record.elements[index] ?? null;
    return !isNil(slot) && matchType(hang, slot.type, element, subst, infer);
  });
};

export function matchType(
  hang: Hang,
  source: TypeId,
  pattern: Node,
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: Map<number, TypeId>,
): boolean {
  const type = unwrapType(pattern);
  if (type.type === 'TSInferType') {
    return bindInfer(hang, type, source, infer);
  }
  if (!hasInfer(type)) {
    return matchLiteral(hang, source, type, subst, infer);
  }
  if (type.type === 'TSTypeReference') {
    return matchReference(hang, source, type, subst, infer);
  }
  if (type.type === 'TSArrayType') {
    return matchArray(hang, source, type.elementType, subst, infer);
  }
  if (type.type === 'TSTypeOperator' && type.operator === 'readonly') {
    return matchType(hang, source, type.typeAnnotation, subst, infer);
  }
  if (type.type === 'TSTupleType') {
    return matchTuple(hang, source, type, subst, infer);
  }
  if (type.type === 'TSFunctionType' || type.type === 'TSConstructorType') {
    return matchFunction(hang, source, type, subst, infer);
  }
  if (type.type === 'TSTypeLiteral') {
    return matchObject(hang, source, type, subst, infer);
  }
  if (type.type === 'TSUnionType') {
    for (const member of type.types) {
      const next = new Map(infer);
      if (matchType(hang, source, member, subst, next)) {
        for (const [symbolId, typeId] of next) {
          infer.set(symbolId, typeId);
        }
        return true;
      }
    }
    return false;
  }
  if (type.type === 'TSIntersectionType') {
    return type.types.every((member) => {
      return matchType(hang, source, member, subst, infer);
    });
  }
  if (type.type === 'RestElement') {
    const annotation =
      type.typeAnnotation ??
      ('typeAnnotation' in type.argument ? type.argument.typeAnnotation : null);
    if (isNil(annotation)) {
      return false;
    }
    return matchType(hang, source, annotation, subst, infer);
  }
  if (type.type === 'Identifier' && !isNil(type.typeAnnotation)) {
    return matchType(hang, source, type.typeAnnotation, subst, infer);
  }
  return false;
}

// 条件 extends、infer
// `T extends Promise<infer U> ? U : T`
// `T extends string ? T : never`
export function matchExtends(
  hang: Hang,
  source: TypeId,
  pattern: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  const infer = new Map<number, TypeId>();
  if (hasInfer(pattern)) {
    if (!matchType(hang, source, pattern, subst, infer)) {
      return null;
    }
    return infer;
  }
  if (!matchLiteral(hang, source, pattern, subst, infer)) {
    return null;
  }
  return infer;
}

export function distributeMembers(hang: Hang, typeId: TypeId) {
  const record = recordOf(hang, typeId);
  if (record?.kind === 'union') {
    return [...record.members];
  }
  return membersOf(hang, typeId);
}
