import type { Hang } from '../hang';

export function checkAliases(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'TSTypeAliasDeclaration') {
      continue;
    }
    const symbolId = hang.symbolIn(node.id, 'type');
    if (symbolId == null) {
      continue;
    }
    hang.typeOfTypeSymbol(symbolId);
  }
}
