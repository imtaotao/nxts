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

const superArgsOf = (
  hang: Hang,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  const typeArgs = node.superTypeArguments ?? null;
  if (isNil(typeArgs) || typeArgs.type !== 'TSTypeParameterInstantiation') {
    return [];
  }
  const args: TypeId[] = [];
  for (const arg of typeArgs.params) {
    const typeId = hang.resolveAtomType(arg, subst);
    if (isNil(typeId)) {
      return null;
    }
    args.push(typeId);
  }
  return args;
};

const superValueOf = (
  hang: Hang,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
) => {
  if (isNil(node.superClass) || node.superClass.type !== 'Identifier') {
    return null;
  }
  const valueId = hang.symbolIn(node.superClass, 'value');
  if (isNil(valueId)) {
    return null;
  }
  return hang.context.ctorOf(hang, valueId);
};

// binder 把 extends 绑在值空间。先读 classCtor，再收实例行。
const heritageOf = (
  hang: Hang,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
  subst?: ReadonlyMap<number, TypeId>,
) => {
  const args = superArgsOf(hang, node, subst);
  if (isNil(args)) {
    return null;
  }
  const resolved = superValueOf(hang, node);
  if (isNil(resolved)) {
    return null;
  }
  const hung = resolved.hang.symbolTypes[resolved.symbolId] ?? null;
  const record = hang.context.table.types[hung ?? -1] ?? null;
  if (record?.kind === 'classCtor' || record?.kind === 'class') {
    return hang.context.table.intern({
      kind: 'class',
      decl: record.decl,
      args,
    });
  }
  if (isNil(node.superClass)) {
    return null;
  }
  const typeId = hang.symbolIn(node.superClass, 'type');
  if (isNil(typeId)) {
    return null;
  }
  if (args.length > 0) {
    return hang.instantiate(typeId, args);
  }
  return subst?.get(typeId) ?? hang.typeOfTypeSymbol(typeId);
};

const heritagePending = (
  hang: Hang,
  node: Extract<Node, { type: 'ClassDeclaration' | 'ClassExpression' }>,
) => {
  const resolved = superValueOf(hang, node);
  if (isNil(resolved)) {
    return false;
  }
  return isNil(resolved.hang.symbolTypes[resolved.symbolId]);
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
  const bodies = hang.context.table.classBodies;
  const existing = bodies.get(typeId) ?? null;
  if (!isNil(existing?.extends)) {
    return;
  }
  if (!isNil(existing) && !heritagePending(hang, node)) {
    return;
  }
  bodies.set(typeId, { extends: null, props: [] });
  const own: ObjectMember[] = [];
  for (const member of node.body.body) {
    const field = fieldOf(hang, member, subst);
    if (!isNil(field)) {
      own.push(field);
    }
  }
  const parent = heritageOf(hang, node, subst);
  if (isNil(parent) && heritagePending(hang, node)) {
    bodies.delete(typeId);
    return;
  }
  const inherited = isNil(parent) ? [] : (bodies.get(parent)?.props ?? []);
  const byKey = new Map(inherited.map((prop) => [prop.key, prop]));

  for (const prop of own) {
    byKey.set(prop.key, prop);
  }
  bodies.set(typeId, {
    extends: parent,
    props: [...byKey.values()],
  });
}
