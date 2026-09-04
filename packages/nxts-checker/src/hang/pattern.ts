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

const hangArrayPattern = (
  hang: Hang,
  node: Extract<Node, { type: 'ArrayPattern' }>,
  typeId: TypeId,
) => {
  const elements = tupleOf(hang, typeId);
  if (isNil(elements)) {
    // TODO: 数组模式对 array 的元素类型。继续：T34 已定，图鉴已有 element，按元素类型挂每个槽即可。
    return;
  }
  for (const [index, element] of node.elements.entries()) {
    if (isNil(element)) {
      continue;
    }
    if (element.type === 'RestElement') {
      // TODO: 数组 rest 要吃掉剩余 tuple 槽。继续：T35 已定，可先做固定元组剩余槽；泛型/variadic 等 T37。
      continue;
    }
    const slot = elements[index] ?? null;
    if (isNil(slot) || slot.rest) {
      continue;
    }
    hangPattern(hang, element, slot.type);
  }
};

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
      if (!isNil(annotated)) {
        return hangPattern(hang, node.argument, typeId);
      }
      // TODO: 无注解 rest 绑定的是剩余集合，不是当前 expected。继续：元组剩余见 T35；对象剩余等 T52。
      return null;
    default:
      return null;
  }
}
