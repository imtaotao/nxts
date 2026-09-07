import { isNil } from 'aidly';
import type { Identifier, Node } from '@babel/types';
import type { Hang } from './index';
import type { TypeId } from '../types';
import { unwrapType } from './ast';

export function walkPatternIdents(
  node: Node,
  visit: (name: Identifier) => void,
) {
  switch (node.type) {
    case 'Identifier':
      visit(node);
      return;
    case 'AssignmentPattern':
      walkPatternIdents(node.left, visit);
      return;
    case 'TSParameterProperty':
      walkPatternIdents(node.parameter, visit);
      return;
    case 'RestElement':
      walkPatternIdents(node.argument, visit);
      return;
    case 'ObjectPattern':
      for (const property of node.properties) {
        if (property.type === 'RestElement') {
          continue;
        }
        walkPatternIdents(property.value, visit);
      }
      return;
    case 'ArrayPattern':
      for (const element of node.elements) {
        if (element) {
          walkPatternIdents(element, visit);
        }
      }
      return;
    default:
      return;
  }
}

const annotationOf = (node: Node) => {
  if ('typeAnnotation' in node && !isNil(node.typeAnnotation)) {
    return node.typeAnnotation;
  }
  if (node.type === 'RestElement') {
    return annotationOf(node.argument);
  }
  return null;
};

const hangIdent = (hang: Hang, node: Identifier, typeId: TypeId) => {
  const symbolId = hang.symbolIn(node, 'value');
  if (!isNil(symbolId)) {
    hang.symbolTypes[symbolId] = typeId;
  }
  hang.hangNode(node, typeId);
};

const propsOf = (hang: Hang, typeId: TypeId) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind === 'object' || record?.kind === 'interface') {
    return record.props;
  }
  return null;
};

const tupleOf = (hang: Hang, typeId: TypeId) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind === 'tuple') {
    return record.elements;
  }
  return null;
};

const hangObjectPattern = (
  hang: Hang,
  node: Extract<Node, { type: 'ObjectPattern' }>,
  typeId: TypeId,
) => {
  const props = propsOf(hang, typeId);
  if (isNil(props)) {
    return;
  }
  for (const property of node.properties) {
    if (property.type === 'RestElement') {
      // TODO: object rest 要减去已解构键。继续：等 T52 赋值/解构类型定稿。
      continue;
    }
    const key = property.key;
    if (property.computed || key.type !== 'Identifier') {
      continue;
    }
    const member = props.find((prop) => prop.key === key.name) ?? null;
    if (isNil(member)) {
      continue;
    }
    hangPattern(hang, property.value, member.type);
  }
};

const arrayOf = (hang: Hang, typeId: TypeId) => {
  const record = hang.context.table.types[typeId] ?? null;
  if (record?.kind === 'array') {
    return record;
  }
  return null;
};

const hangArrayPattern = (
  hang: Hang,
  node: Extract<Node, { type: 'ArrayPattern' }>,
  typeId: TypeId,
) => {
  const array = arrayOf(hang, typeId);
  if (!isNil(array)) {
    for (const element of node.elements) {
      if (isNil(element)) {
        continue;
      }
      if (element.type === 'RestElement') {
        hangPattern(
          hang,
          element,
          hang.context.table.intern({
            kind: 'array',
            element: array.element,
            readonly: array.readonly,
          }),
        );
        continue;
      }
      hangPattern(hang, element, array.element);
    }
    return;
  }
  const record = hang.context.table.types[typeId] ?? null;
  const elements = tupleOf(hang, typeId);
  if (isNil(elements) || isNil(record) || record.kind !== 'tuple') {
    return;
  }
  for (const [index, element] of node.elements.entries()) {
    if (isNil(element)) {
      continue;
    }
    if (element.type === 'RestElement') {
      const rest = elements.slice(index);
      if (rest.some((slot) => slot.rest)) {
        continue;
      }
      hangPattern(
        hang,
        element,
        hang.context.table.intern({
          kind: 'tuple',
          elements: rest,
          readonly: record.readonly,
        }),
      );
      continue;
    }
    const slot = elements[index] ?? null;
    if (isNil(slot) || slot.rest) {
      continue;
    }
    hangPattern(hang, element, slot.type);
  }
};

// const 上的 unique symbol。`const token: unique symbol = Symbol()`
export function hangUniqueConst(hang: Hang, node: Identifier) {
  const annotation = annotationOf(node);
  if (isNil(annotation)) {
    return null;
  }
  const type = unwrapType(annotation);
  if (type.type !== 'TSTypeOperator' || type.operator !== 'unique') {
    return null;
  }
  if (unwrapType(type.typeAnnotation).type !== 'TSSymbolKeyword') {
    return null;
  }
  const symbolId = hang.symbolIn(node, 'value');
  if (isNil(symbolId)) {
    return null;
  }
  const typeId = hang.context.table.intern({
    kind: 'uniqueSymbol',
    decl: { fileId: hang.file.snapshot.fileId, symbolId },
  });
  hang.hangNode(type, typeId);
  hangIdent(hang, node, typeId);
  return typeId;
}

// 绑定模式
// `const n: i32`
// `const { title }: Named`
// `const [x, ...rest]: [i32, string, boolean]`
export function hangPattern(hang: Hang, node: Node, expected?: TypeId) {
  const annotation = annotationOf(node);
  const annotated = isNil(annotation) ? null : hang.resolveAtomType(annotation);
  if (!isNil(annotation) && !isNil(annotated)) {
    hang.hangNode(unwrapType(annotation), annotated);
  }
  const typeId = annotated ?? expected ?? null;
  if (isNil(typeId)) {
    return null;
  }
  switch (node.type) {
    case 'Identifier':
      hangIdent(hang, node, typeId);
      return typeId;
    case 'AssignmentPattern':
      return hangPattern(hang, node.left, typeId);
    case 'TSParameterProperty':
      return hangPattern(hang, node.parameter, typeId);
    case 'ObjectPattern':
      hang.hangNode(node, typeId);
      hangObjectPattern(hang, node, typeId);
      return typeId;
    case 'ArrayPattern':
      hang.hangNode(node, typeId);
      hangArrayPattern(hang, node, typeId);
      return typeId;
    case 'RestElement':
      hang.hangNode(node, typeId);
      return hangPattern(hang, node.argument, typeId);
    default:
      return null;
  }
}
