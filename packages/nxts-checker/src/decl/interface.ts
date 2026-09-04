import { isNil } from 'aidly';
import type { Hang } from '../hang';

export function checkInterfaces(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSInterfaceDeclaration') {
      continue;
    }
    const symbolId = hang.symbolIn(node.id, 'type');
    if (isNil(symbolId)) {
      continue;
    }
    hang.typeOfTypeSymbol(symbolId);
  }
}
