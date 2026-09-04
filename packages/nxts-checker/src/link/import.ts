import { isNil } from 'aidly';
import type { BindProgramResult } from '@nxts/binder';
import type { Hang } from '../hang';

export function checkImports(program: BindProgramResult, hangs: Hang[]) {
  const indexOf = new Map(
    program.files.map((file, index) => [file.snapshot.fileId, index]),
  );
  let copied = 0;
  for (const link of program.links) {
    if (isNil(link.exportSymbolId)) {
      continue;
    }
    const from = indexOf.get(link.fromFileId);
    const to = indexOf.get(link.toFileId);
    if (isNil(from) || isNil(to)) {
      continue;
    }
    const typeId = hangs[to]?.symbolTypes[link.exportSymbolId] ?? null;
    if (isNil(typeId)) {
      continue;
    }
    const hang = hangs[from];
    if (isNil(hang) || !isNil(hang.symbolTypes[link.importSymbolId])) {
      continue;
    }
    hang.symbolTypes[link.importSymbolId] = typeId;
    const symbol = hang.file.symbols[link.importSymbolId];
    if (!isNil(symbol?.declNodeId)) {
      hang.nodeTypes[symbol.declNodeId] = typeId;
    }
    copied += 1;
  }
  return copied;
}
