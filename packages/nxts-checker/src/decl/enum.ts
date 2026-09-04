import { isNil } from 'aidly';
import type { Hang } from '../hang';

export function checkEnums(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSEnumDeclaration' || isNil(node.id)) {
      continue;
    }
    const symbolId = hang.symbolIn(node.id, 'type');
    if (isNil(symbolId)) {
      continue;
    }
    const enumType = hang.typeOfTypeSymbol(symbolId);
    if (isNil(enumType)) {
      continue;
    }
    let next = 0;
    for (const member of node.body.members) {
      if (member.id.type !== 'Identifier' || !isNil(member.initializer)) {
        continue;
      }
      const memberId = hang.symbolIn(member.id, 'value');
      if (isNil(memberId)) {
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
