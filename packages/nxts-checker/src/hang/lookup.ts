import { isNil } from 'aidly';
import type { Hang } from './index';
import type { ObjectMember, TypeId, TypeRecord } from '../types';

export function recordOf(hang: Hang, typeId: TypeId) {
  return hang.context.table.types[typeId] ?? null;
}

export function isAtom(hang: Hang, typeId: TypeId, atom: string) {
  const record = recordOf(hang, typeId);
  return record?.kind === 'atom' && record.atom === atom;
}

export function membersOf(hang: Hang, typeId: TypeId) {
  const record = recordOf(hang, typeId);
  if (record?.kind === 'union') {
    return [...record.members];
  }
  if (isAtom(hang, typeId, 'never')) {
    return [];
  }
  return [typeId];
}

export function unionOf(hang: Hang, ids: readonly TypeId[]) {
  return hang.context.table.intern({ kind: 'union', members: ids });
}

export function withUndefined(hang: Hang, typeId: TypeId) {
  return unionOf(hang, [typeId, hang.context.table.atom('undefined')]);
}

export function stringLiteralOf(hang: Hang, value: string) {
  return hang.context.table.intern({
    kind: 'literal',
    base: hang.context.table.atom('string'),
    value: { kind: 'string', value },
  });
}

export function numericLiteralOf(hang: Hang, value: string) {
  return hang.context.table.intern({
    kind: 'literal',
    base: hang.context.table.atom('i32'),
    value: { kind: 'numeric', value },
  });
}

const stringKeyOf = (hang: Hang, typeId: TypeId) => {
  const record = recordOf(hang, typeId);
  if (record?.kind === 'literal' && record.value.kind === 'string') {
    return record.value.value;
  }
  return null;
};

const numericKeyOf = (hang: Hang, typeId: TypeId) => {
  const record = recordOf(hang, typeId);
  if (record?.kind === 'literal' && record.value.kind === 'numeric') {
    return record.value.value;
  }
  const text = stringKeyOf(hang, typeId);
  if (!isNil(text) && /^\d+$/.test(text)) {
    return text;
  }
  return null;
};

const isWideIndex = (hang: Hang, typeId: TypeId) => {
  return isAtom(hang, typeId, 'i32') || isAtom(hang, typeId, 'number');
};

const isStringIndex = (hang: Hang, typeId: TypeId) => {
  return isAtom(hang, typeId, 'string');
};

const propsOf = (hang: Hang, record: TypeRecord) => {
  if (
    record.kind === 'object' ||
    record.kind === 'interface' ||
    record.kind === 'dictionary'
  ) {
    return record.props;
  }
  if (record.kind === 'class') {
    return hang.context.table.classBodies.get(record.id)?.props ?? null;
  }
  return null;
};

const readProp = (hang: Hang, prop: ObjectMember) => {
  if (!prop.optional) {
    return prop.type;
  }
  return withUndefined(hang, prop.type);
};

const coversKey = (hang: Hang, set: readonly TypeId[], key: TypeId) => {
  if (set.includes(key)) {
    return true;
  }
  const record = recordOf(hang, key);
  if (record?.kind === 'literal' && record.value.kind === 'string') {
    return set.some((id) => isAtom(hang, id, 'string'));
  }
  if (record?.kind === 'literal' && record.value.kind === 'numeric') {
    return set.some(
      (id) => isAtom(hang, id, 'number') || isAtom(hang, id, 'i32'),
    );
  }
  if (isAtom(hang, key, 'i32')) {
    return set.some(
      (id) => isAtom(hang, id, 'i32') || isAtom(hang, id, 'number'),
    );
  }
  if (isAtom(hang, key, 'number')) {
    return set.some((id) => isAtom(hang, id, 'number'));
  }
  if (isAtom(hang, key, 'string')) {
    return set.some((id) => isAtom(hang, id, 'string'));
  }
  return false;
};

const intersectKeys = (hang: Hang, parts: readonly TypeId[]) => {
  if (parts.length === 0) {
    return hang.context.table.atom('never');
  }
  const sets = parts.map((part) => membersOf(hang, part));
  const candidates = new Set(sets.flat());
  const kept = [...candidates].filter((key) => {
    return sets.every((set) => coversKey(hang, set, key));
  });
  return unionOf(hang, kept);
};

const keysOfProps = (hang: Hang, props: readonly ObjectMember[]) => {
  if (props.length === 0) {
    return hang.context.table.atom('never');
  }
  return unionOf(
    hang,
    props.map((prop) => stringLiteralOf(hang, prop.key)),
  );
};

const dictionaryKeysOf = (
  hang: Hang,
  record: Extract<TypeRecord, { kind: 'dictionary' }>,
) => {
  const keys: TypeId[] = [];
  const keyAtom = recordOf(hang, record.key);
  const hasString = keyAtom?.kind === 'atom' && keyAtom.atom === 'string';
  const hasNumber =
    (keyAtom?.kind === 'atom' && keyAtom.atom === 'number') ||
    !isNil(record.numeric);
  if (hasString) {
    keys.push(
      hang.context.table.atom('string'),
      hang.context.table.atom('number'),
    );
  } else if (hasNumber) {
    keys.push(hang.context.table.atom('number'));
  }
  for (const prop of record.props) {
    if (hasString) {
      continue;
    }
    if (hasNumber && /^\d+$/.test(prop.key)) {
      continue;
    }
    keys.push(stringLiteralOf(hang, prop.key));
  }
  return unionOf(hang, keys);
};

const arrayKeysOf = (hang: Hang) => {
  return unionOf(hang, [
    hang.context.table.atom('i32'),
    stringLiteralOf(hang, 'length'),
  ]);
};

const tupleKeysOf = (
  hang: Hang,
  record: Extract<TypeRecord, { kind: 'tuple' }>,
) => {
  const keys: TypeId[] = [
    hang.context.table.atom('i32'),
    stringLiteralOf(hang, 'length'),
  ];
  for (const [index, element] of record.elements.entries()) {
    if (element.rest) {
      continue;
    }
    keys.push(stringLiteralOf(hang, String(index)));
  }
  return unionOf(hang, keys);
};

const tupleLengthOf = (
  hang: Hang,
  record: Extract<TypeRecord, { kind: 'tuple' }>,
) => {
  if (record.elements.some((element) => element.optional || element.rest)) {
    return hang.context.table.atom('i32');
  }
  return numericLiteralOf(hang, String(record.elements.length));
};

const indexDictionary = (
  hang: Hang,
  record: Extract<TypeRecord, { kind: 'dictionary' }>,
  index: TypeId,
) => {
  const key = stringKeyOf(hang, index);
  if (!isNil(key)) {
    const prop = record.props.find((item) => item.key === key) ?? null;
    if (!isNil(prop)) {
      return readProp(hang, prop);
    }
    const digits = numericKeyOf(hang, index);
    if (!isNil(digits) && !isNil(record.numeric)) {
      return withUndefined(hang, record.numeric.value);
    }
    if (isAtom(hang, record.key, 'string')) {
      return withUndefined(hang, record.value);
    }
    if (!isNil(digits) && isAtom(hang, record.key, 'number')) {
      return withUndefined(hang, record.value);
    }
    return null;
  }
  if (isStringIndex(hang, index)) {
    if (isAtom(hang, record.key, 'string')) {
      return withUndefined(hang, record.value);
    }
    return null;
  }
  if (isWideIndex(hang, index) || !isNil(numericKeyOf(hang, index))) {
    if (!isNil(record.numeric)) {
      return withUndefined(hang, record.numeric.value);
    }
    if (
      isAtom(hang, record.key, 'number') ||
      isAtom(hang, record.key, 'string')
    ) {
      return withUndefined(hang, record.value);
    }
  }
  return null;
};

const indexArray = (
  hang: Hang,
  record: Extract<TypeRecord, { kind: 'array' }>,
  index: TypeId,
) => {
  if (stringKeyOf(hang, index) === 'length') {
    return hang.context.table.atom('i32');
  }
  if (isWideIndex(hang, index) || !isNil(numericKeyOf(hang, index))) {
    return withUndefined(hang, record.element);
  }
  return null;
};

const indexTuple = (
  hang: Hang,
  record: Extract<TypeRecord, { kind: 'tuple' }>,
  index: TypeId,
) => {
  if (stringKeyOf(hang, index) === 'length') {
    return tupleLengthOf(hang, record);
  }
  if (isWideIndex(hang, index)) {
    const slots = record.elements
      .filter((element) => !element.rest)
      .map((element) => {
        if (!element.optional) {
          return element.type;
        }
        return withUndefined(hang, element.type);
      });
    return withUndefined(hang, unionOf(hang, slots));
  }
  const digits = numericKeyOf(hang, index);
  if (isNil(digits)) {
    return null;
  }
  const slot = record.elements[Number(digits)] ?? null;
  if (isNil(slot) || slot.rest) {
    return null;
  }
  if (!slot.optional) {
    return slot.type;
  }
  return withUndefined(hang, slot.type);
};

const indexConcrete = (hang: Hang, object: TypeId, index: TypeId) => {
  const record = recordOf(hang, object);
  if (isNil(record)) {
    return null;
  }
  if (record.kind === 'atom' && record.atom === 'never') {
    return hang.context.table.atom('never');
  }
  const props = propsOf(hang, record);
  if (!isNil(props) && record.kind !== 'dictionary') {
    const key = stringKeyOf(hang, index);
    if (isNil(key)) {
      return null;
    }
    const prop = props.find((item) => item.key === key) ?? null;
    if (isNil(prop)) {
      return null;
    }
    return readProp(hang, prop);
  }
  if (record.kind === 'dictionary') {
    return indexDictionary(hang, record, index);
  }
  if (record.kind === 'array') {
    return indexArray(hang, record, index);
  }
  if (record.kind === 'tuple') {
    return indexTuple(hang, record, index);
  }
  if (record.kind === 'function' || record.kind === 'construct') {
    if (stringKeyOf(hang, index) === 'name') {
      return hang.context.table.atom('string');
    }
    if (stringKeyOf(hang, index) === 'length') {
      return hang.context.table.atom('i32');
    }
    return null;
  }
  if (record.kind === 'atom' && record.atom === 'string') {
    if (stringKeyOf(hang, index) === 'length') {
      return hang.context.table.atom('i32');
    }
    if (isWideIndex(hang, index) || !isNil(numericKeyOf(hang, index))) {
      return withUndefined(hang, hang.context.table.atom('string'));
    }
    return null;
  }
  if (record.kind === 'literal' && record.value.kind === 'string') {
    return indexConcrete(hang, hang.context.table.atom('string'), index);
  }
  return null;
};

// keyof
// `keyof Point` → `"x" | "y"`
// `keyof i32[]` → `i32 | "length"`
export function keyofOf(hang: Hang, typeId: TypeId) {
  const record = recordOf(hang, typeId);
  if (isNil(record)) {
    return null;
  }
  if (record.kind === 'atom' && record.atom === 'never') {
    return unionOf(hang, [
      hang.context.table.atom('string'),
      hang.context.table.atom('number'),
    ]);
  }
  if (record.kind === 'atom' && record.atom === 'void') {
    return null;
  }
  if (
    record.kind === 'atom' &&
    (record.atom === 'null' || record.atom === 'undefined')
  ) {
    return hang.context.table.atom('never');
  }
  if (record.kind === 'unknown') {
    return hang.context.table.atom('never');
  }
  if (record.kind === 'union') {
    const parts: TypeId[] = [];
    for (const member of record.members) {
      const keys = keyofOf(hang, member);
      if (isNil(keys)) {
        return null;
      }
      parts.push(keys);
    }
    return intersectKeys(hang, parts);
  }
  if (record.kind === 'intersection') {
    const parts: TypeId[] = [];
    for (const member of record.members) {
      const keys = keyofOf(hang, member);
      if (isNil(keys)) {
        return null;
      }
      parts.push(keys);
    }
    return unionOf(hang, parts);
  }
  if (record.kind === 'object' || record.kind === 'interface') {
    return keysOfProps(hang, record.props);
  }
  if (record.kind === 'class') {
    const body = hang.context.table.classBodies.get(record.id) ?? null;
    if (isNil(body)) {
      return null;
    }
    return keysOfProps(hang, body.props);
  }
  if (record.kind === 'dictionary') {
    return dictionaryKeysOf(hang, record);
  }
  if (record.kind === 'array') {
    return arrayKeysOf(hang);
  }
  if (record.kind === 'atom' && record.atom === 'string') {
    return arrayKeysOf(hang);
  }
  if (record.kind === 'literal' && record.value.kind === 'string') {
    return arrayKeysOf(hang);
  }
  if (record.kind === 'tuple') {
    return tupleKeysOf(hang, record);
  }
  if (record.kind === 'function' || record.kind === 'construct') {
    return hang.context.table.atom('never');
  }
  return null;
}

// T[K]
// `User["nickname"]` → `string | undefined`
// `[string, i32][0]` → `string`
export function indexAccess(hang: Hang, object: TypeId, index: TypeId) {
  const indexRecord = recordOf(hang, index);
  if (indexRecord?.kind === 'union') {
    const parts: TypeId[] = [];
    for (const member of indexRecord.members) {
      const typeId = indexAccess(hang, object, member);
      if (isNil(typeId)) {
        return null;
      }
      parts.push(typeId);
    }
    return unionOf(hang, parts);
  }
  const objectRecord = recordOf(hang, object);
  if (objectRecord?.kind === 'union') {
    const parts: TypeId[] = [];
    for (const member of objectRecord.members) {
      const typeId = indexAccess(hang, member, index);
      if (isNil(typeId)) {
        return null;
      }
      parts.push(typeId);
    }
    return unionOf(hang, parts);
  }
  if (objectRecord?.kind === 'intersection') {
    const parts: TypeId[] = [];
    for (const member of objectRecord.members) {
      const typeId = indexAccess(hang, member, index);
      if (!isNil(typeId)) {
        parts.push(typeId);
      }
    }
    if (parts.length === 0) {
      return null;
    }
    return unionOf(hang, parts);
  }
  return indexConcrete(hang, object, index);
}
