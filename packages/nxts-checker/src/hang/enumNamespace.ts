import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { ObjectMember, TypeId } from '../types';
import type { Hang } from './index';

const memberKeyOf = (member: Extract<Node, { type: 'TSEnumMember' }>) => {
  const id = member.id;
  if (isNil(id)) {
    return null;
  }
  if (id.type === 'Identifier') {
    return id.name;
  }
  if (id.type === 'StringLiteral') {
    return id.value;
  }
  return null;
};

// `typeof Kind` 的编译期命名空间。不能把 enum 行冒充进去。
export class EnumNamespace {
  readonly hang: Hang;

  constructor(hang: Hang) {
    this.hang = hang;
  }

  of(enumType: TypeId) {
    const record = this.hang.context.table.types[enumType] ?? null;
    if (record?.kind !== 'enum') {
      return null;
    }
    const typeId = this.hang.context.table.intern({
      kind: 'enumNamespace',
      enum: enumType,
    });
    if (this.hang.context.table.enumNamespaces.has(typeId)) {
      return typeId;
    }
    const owner =
      this.hang.context.hangs.find((item) => {
        return item.file.snapshot.fileId === record.decl.fileId;
      }) ?? this.hang;
    const props: ObjectMember[] = [];
    for (const node of owner.file.nodes) {
      if (node.type !== 'TSEnumDeclaration' || isNil(node.id)) {
        continue;
      }
      if (owner.symbolIn(node.id, 'type') !== record.decl.symbolId) {
        continue;
      }
      for (const member of node.body.members) {
        const key = memberKeyOf(member);
        if (isNil(key)) {
          continue;
        }
        const memberId =
          !isNil(member.id) && member.id.type === 'Identifier'
            ? owner.symbolIn(member.id, 'value')
            : null;
        const memberType = isNil(memberId)
          ? null
          : (owner.symbolTypes[memberId] ?? null);
        if (isNil(memberType)) {
          continue;
        }
        props.push({
          key,
          type: memberType,
          optional: false,
          readonly: true,
          role: 'field',
        });
      }
    }
    this.hang.context.table.enumNamespaces.set(typeId, props);
    return typeId;
  }
}
