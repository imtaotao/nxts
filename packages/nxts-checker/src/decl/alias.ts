import { isNil } from 'aidly';
import type { Hang } from '../hang';

export function checkAliases(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSTypeAliasDeclaration') {
      continue;
    }
    const symbolId = hang.symbolIn(node.id, 'type');
    if (isNil(symbolId)) {
      continue;
    }
    hang.typeOfTypeSymbol(symbolId);
  }
}
