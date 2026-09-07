import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from './index';
import type { ObjectMember, TypeId } from '../types';

const hiddenOf = (node: Node) => {
  if (!('accessibility' in node)) {
    return false;
  }
  return node.accessibility === 'private' || node.accessibility === 'protected';
};

const fieldOf = (
  hang: Hang,
  member: Node,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (
    member.type !== 'ClassProperty' &&
    member.type !== 'ClassAccessorProperty'
  ) {
    return null;
  }
  if (member.static === true || hiddenOf(member)) {
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

const heritageOf = (
  hang: Hang,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  if (isNil(node.superClass) || node.superClass.type !== 'Identifier') {
    return null;
  }
  const symbolId = hang.symbolIn(node.superClass, 'type');
  if (isNil(symbolId)) {
    return null;
  }
  const typeArgs = node.superTypeArguments ?? null;
  if (!isNil(typeArgs) && typeArgs.type === 'TSTypeParameterInstantiation') {
    const args: TypeId[] = [];
    for (const arg of typeArgs.params) {
      const typeId = hang.resolveAtomType(arg, subst);
      if (isNil(typeId)) {
        return null;
      }
      args.push(typeId);
    }
    return hang.instantiate(symbolId, args);
  }
  return subst?.get(symbolId) ?? hang.typeOfTypeSymbol(symbolId);
};

// 类实例字段侧表
// `class Point { x: number; y: number }`
// `class Child extends Parent { n: i32 }`
export function recordClassBody(
  hang: Hang,
  typeId: TypeId,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (hang.context.classBodies.has(typeId)) {
    return;
  }
  hang.context.classBodies.set(typeId, { extends: null, props: [] });
  const own: ObjectMember[] = [];
  for (const member of node.body.body) {
    const field = fieldOf(hang, member, subst);
    if (!isNil(field)) {
      own.push(field);
    }
  }
  const parent = heritageOf(hang, node, subst);
  const inherited = isNil(parent)
    ? []
    : (hang.context.classBodies.get(parent)?.props ?? []);
  const byKey = new Map(inherited.map((prop) => [prop.key, prop]));

  for (const prop of own) {
    byKey.set(prop.key, prop);
  }
  hang.context.classBodies.set(typeId, {
    extends: parent,
    props: [...byKey.values()],
  });
}
