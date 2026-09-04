import type { BindProgramResult } from '@nxts/binder';
import type { Hang } from '../hang';

export function checkImports(program: BindProgramResult, hangs: Hang[]) {
  const indexOf = new Map(
    program.files.map((file, index) => [file.snapshot.fileId, index]),
  );
  let copied = 0;
  for (const link of program.links) {
    if (link.exportSymbolId == null) {
      continue;
    }
    const from = indexOf.get(link.fromFileId);
    const to = indexOf.get(link.toFileId);
    if (from == null || to == null) {
      continue;
    }
    const typeId = hangs[to]?.symbolTypes[link.exportSymbolId] ?? null;
    if (typeId == null) {
      continue;
    }
    const hang = hangs[from];
    if (hang == null || hang.symbolTypes[link.importSymbolId] != null) {
      continue;
    }
    hang.symbolTypes[link.importSymbolId] = typeId;
    const symbol = hang.file.symbols[link.importSymbolId];
    if (symbol?.declNodeId != null) {
      hang.nodeTypes[symbol.declNodeId] = typeId;
    }
    copied += 1;
  }
  return copied;
}
