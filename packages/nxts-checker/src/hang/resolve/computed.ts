import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import { assignable } from '../../core/relation';
import type { ObjectMember, TypeId } from '../../types';
import { typeArgsOf } from '../ast';
import type { Hang } from '../index';
import { dictionaryOf } from '../intern';
import {
  isAtom,
  membersOf,
  recordOf,
  stringLiteralOf,
  unionOf,
} from '../lookup';
import { distributeMembers, matchExtends } from '../match';
import { finish } from './shared';

const typeParamSymbolOf = (hang: Hang, type: Node) => {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return null;
  }
  if (!isNil(typeArgsOf(type))) {
    return null;
  }
  const symbolId = hang.symbolIn(type.typeName, 'type');
  if (isNil(symbolId)) {
    return null;
  }
  for (const node of hang.file.nodes) {
    if (
      node.type === 'TSTypeParameter' &&
      hang.symbolIn(node.name, 'type') === symbolId
    ) {
      return symbolId;
    }
  }
  return null;
};

const mergeSubst = (
  subst: ReadonlyMap<number, TypeId> | undefined,
  infer: ReadonlyMap<number, TypeId>,
) => {
  const next = new Map(subst);
  for (const [symbolId, typeId] of infer) {
    next.set(symbolId, typeId);
  }
  return next;
};

const evaluateConditional = (
  hang: Hang,
  type: Extract<Node, { type: 'TSConditionalType' }>,
  source: TypeId,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  const infer = matchExtends(hang, source, type.extendsType, subst);
  if (!isNil(infer)) {
    return hang.resolveAtomType(type.trueType, mergeSubst(subst, infer));
  }
  const target = hang.resolveAtomType(type.extendsType, subst);
  if (!isNil(target) && assignable(hang.context.table, source, target)) {
    return hang.resolveAtomType(type.trueType, subst);
  }
  return hang.resolveAtomType(type.falseType, subst);
};

// 条件类型
// `T extends string ? T : never`
// `'ready' extends string ? true : false`
export function resolveConditional(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSConditionalType') {
    return null;
  }
  const check = hang.resolveAtomType(type.checkType, subst);
  if (isNil(check)) {
    return null;
  }
  const paramId = typeParamSymbolOf(hang, type.checkType);
  if (!isNil(paramId)) {
    if (isAtom(hang, check, 'never')) {
      return finish(hang, type, hang.context.table.atom('never'), subst);
    }
    const parts: TypeId[] = [];
    for (const member of distributeMembers(hang, check)) {
      const next = new Map(subst);
      next.set(paramId, member);
      const typeId = evaluateConditional(hang, type, member, next);
      if (isNil(typeId)) {
        return null;
      }
      parts.push(typeId);
    }
    return finish(hang, type, unionOf(hang, parts), subst);
  }
  return finish(
    hang,
    type,
    evaluateConditional(hang, type, check, subst),
    subst,
  );
}

export function resolveInfer(
  _hang: Hang,
  type: Node,
  _subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSInferType') {
    return null;
  }
  return null;
}

const mappedFlag = (value: boolean | '+' | '-' | null | undefined) => {
  if (value === true || value === '+') {
    return true;
  }
  return false;
};

const keyTextsOf = (hang: Hang, typeId: TypeId) => {
  const texts: string[] = [];
  let wide: 'string' | 'number' | null = null;
  for (const member of membersOf(hang, typeId)) {
    const record = recordOf(hang, member);
    if (record?.kind === 'literal' && record.value.kind === 'string') {
      texts.push(record.value.value);
      continue;
    }
    if (record?.kind === 'literal' && record.value.kind === 'numeric') {
      texts.push(record.value.value);
      continue;
    }
    if (isAtom(hang, member, 'string')) {
      wide = 'string';
      continue;
    }
    if (isAtom(hang, member, 'number') || isAtom(hang, member, 'i32')) {
      if (wide !== 'string') {
        wide = 'number';
      }
      continue;
    }
    if (isAtom(hang, member, 'never')) {
      continue;
    }
    return null;
  }
  return { texts, wide };
};

const remapKeys = (
  hang: Hang,
  _keyType: TypeId,
  nameType: Node,
  subst: Map<number, TypeId>,
) => {
  const remapped = hang.resolveAtomType(nameType, subst);
  if (isNil(remapped)) {
    return null;
  }
  if (isAtom(hang, remapped, 'never')) {
    return [];
  }
  const texts = keyTextsOf(hang, remapped);
  if (isNil(texts) || !isNil(texts.wide)) {
    return null;
  }
  return texts.texts.map((text) => stringLiteralOf(hang, text));
};

const mappedKeyOf = (type: Extract<Node, { type: 'TSMappedType' }>) => {
  return type.key;
};

const mappedConstraintOf = (type: Extract<Node, { type: 'TSMappedType' }>) => {
  return type.constraint;
};

// 映射类型
// `{ [K in keyof Point]: Point[K] }`
// `{ [K in "a" | "b"]: i32 }`
export function resolveMapped(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSMappedType' || isNil(type.typeAnnotation)) {
    return null;
  }
  const keyNode = mappedKeyOf(type);
  const constraint = mappedConstraintOf(type);
  if (isNil(keyNode) || isNil(constraint)) {
    return null;
  }
  const symbolId = hang.symbolIn(keyNode, 'type');
  if (isNil(symbolId)) {
    return null;
  }
  const keys = hang.resolveAtomType(constraint, subst);
  if (isNil(keys)) {
    return null;
  }
  const parts = keyTextsOf(hang, keys);
  if (isNil(parts)) {
    return null;
  }
  const optional = mappedFlag(type.optional);
  const readonly = mappedFlag(type.readonly);
  const props: ObjectMember[] = [];
  for (const text of parts.texts) {
    const next = new Map(subst);
    const keyType = stringLiteralOf(hang, text);
    next.set(symbolId, keyType);
    const names = isNil(type.nameType)
      ? [keyType]
      : remapKeys(hang, keyType, type.nameType, next);
    if (isNil(names)) {
      return null;
    }
    const value = hang.resolveAtomType(type.typeAnnotation, next);
    if (isNil(value)) {
      return null;
    }
    for (const name of names) {
      const record = recordOf(hang, name);
      if (record?.kind !== 'literal' || record.value.kind !== 'string') {
        return null;
      }
      props.push({
        key: record.value.value,
        type: value,
        optional,
        readonly,
        role: 'field',
      });
    }
  }
  if (!isNil(parts.wide)) {
    const next = new Map(subst);
    next.set(symbolId, hang.context.table.atom(parts.wide));
    const value = hang.resolveAtomType(type.typeAnnotation, next);
    if (isNil(value)) {
      return null;
    }
    return finish(
      hang,
      type,
      dictionaryOf(
        hang,
        props,
        [
          {
            key: hang.context.table.atom(parts.wide),
            value,
            readonly,
          },
        ],
        [],
        [],
      ),
      subst,
    );
  }
  return finish(
    hang,
    type,
    hang.context.table.intern({
      kind: 'object',
      props,
      calls: [],
      constructs: [],
    }),
    subst,
  );
}

const templatePartsOf = (hang: Hang, typeId: TypeId): string[] | null => {
  const record = recordOf(hang, typeId);
  if (isAtom(hang, typeId, 'never')) {
    return [];
  }
  if (record?.kind === 'union') {
    const parts: string[] = [];
    for (const member of record.members) {
      const texts = templatePartsOf(hang, member);
      if (isNil(texts)) {
        return null;
      }
      parts.push(...texts);
    }
    return parts;
  }
  if (record?.kind === 'literal' && record.value.kind === 'string') {
    return [record.value.value];
  }
  if (record?.kind === 'literal' && record.value.kind === 'boolean') {
    return [record.value.value ? 'true' : 'false'];
  }
  if (record?.kind === 'literal' && record.value.kind === 'numeric') {
    return [record.value.value];
  }
  if (isAtom(hang, typeId, 'boolean')) {
    return ['true', 'false'];
  }
  if (isAtom(hang, typeId, 'null')) {
    return ['null'];
  }
  if (isAtom(hang, typeId, 'undefined')) {
    return ['undefined'];
  }
  return null;
};

const cartesian = (left: readonly string[], right: readonly string[]) => {
  if (left.length === 0) {
    return [...right];
  }
  const out: string[] = [];
  for (const prefix of left) {
    for (const suffix of right) {
      out.push(`${prefix}${suffix}`);
    }
  }
  return out;
};

// 闭合模板
// `${"open" | "close"}Changed`
// `enabled:${boolean}`
export function resolveTemplate(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSTemplateLiteralType') {
    return null;
  }
  let texts = [type.quasis[0]?.value.cooked ?? ''];
  for (const [index, part] of type.types.entries()) {
    const typeId = hang.resolveAtomType(part, subst);
    if (isNil(typeId)) {
      return null;
    }
    const pieces = templatePartsOf(hang, typeId);
    if (isNil(pieces)) {
      return null;
    }
    texts = cartesian(texts, pieces);
    texts = cartesian(texts, [type.quasis[index + 1]?.value.cooked ?? '']);
  }
  if (texts.length === 0) {
    return finish(hang, type, hang.context.table.atom('never'), subst);
  }
  return finish(
    hang,
    type,
    unionOf(
      hang,
      texts.map((text) => stringLiteralOf(hang, text)),
    ),
    subst,
  );
}
