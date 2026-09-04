import type { Hang } from '../hang';

export function checkEnums(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSEnumDeclaration' || node.id == null) {
      continue;
    }
    const symbolId = hang.symbolIn(node.id, 'type');
    if (symbolId == null) {
      continue;
    }
    const enumType = hang.typeOfTypeSymbol(symbolId);
    if (enumType == null) {
      continue;
    }
    let next = 0;
    for (const member of node.body.members) {
      if (member.id.type !== 'Identifier' || member.initializer != null) {
        continue;
      }
      const memberId = hang.symbolIn(member.id, 'value');
      if (memberId == null) {
        next += 1;
        continue;
      }
      const typeId = hang.context.table.intern({
        kind: 'enumMember',
        enum: enumType,
        value: { kind: 'numeric', value: String(next) },
      });
      hang.symbolTypes[memberId] = typeId;
      hang.hangNode(member.id, typeId);
      next += 1;
    }
  }
}
