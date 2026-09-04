import type { Hang } from '../hang';

export function checkVariables(hang: Hang) {
  for (const node of hang.file.nodes) {
    if (node.type !== 'VariableDeclaration') {
      continue;
    }
    if (node.kind !== 'const' && node.kind !== 'let') {
      continue;
    }
    for (const declarator of node.declarations) {
      hang.hangPattern(declarator.id);
    }
  }
}
