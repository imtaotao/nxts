import { isNil } from 'aidly';
import type { Hang } from '../hang';

export function checkClasses(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') {
      continue;
    }
    if (!isNil(node.id)) {
      const symbolId = hang.symbolIn(node.id, 'type');
      if (!isNil(symbolId)) {
        hang.typeOfTypeSymbol(symbolId);
      }
    }
    for (const member of node.body.body) {
      if (
        member.type !== 'ClassProperty' &&
        member.type !== 'ClassAccessorProperty'
      ) {
        continue;
      }
      if (isNil(member.typeAnnotation) || member.key.type !== 'Identifier') {
        continue;
      }
      const typeId = hang.resolveAtomType(member.typeAnnotation);
      if (isNil(typeId)) {
        continue;
      }
      hang.hangNode(member.key, typeId);
      hang.hangNode(member.typeAnnotation.typeAnnotation, typeId);
    }
  }
}
