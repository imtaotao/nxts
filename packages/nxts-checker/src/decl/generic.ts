import { isNil } from 'aidly';
import type { Hang } from '../hang';

export function checkGenerics(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSTypeParameter') {
      continue;
    }
    const symbolId = hang.symbolIn(node.name, 'type');
    if (isNil(symbolId)) {
      continue;
    }
    hang.typeOfTypeSymbol(symbolId);
  }
}
