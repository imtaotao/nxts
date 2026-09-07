import { isNil } from 'aidly';
import type { Hang } from '../hang';
import { hangUniqueConst } from '../hang/pattern';

export function checkVariables(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'VariableDeclaration') {
      continue;
    }
    if (node.kind !== 'const' && node.kind !== 'let') {
      continue;
    }
    for (const declarator of node.declarations) {
      if (
        node.kind === 'const' &&
        declarator.id.type === 'Identifier' &&
        !isNil(hangUniqueConst(hang, declarator.id))
      ) {
        continue;
      }
      hang.hangPattern(declarator.id);
    }
  }
}
