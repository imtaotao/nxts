import type { BindProgramResult } from '@nxts/binder';
import { TypeTable } from './core/typeTable';
import type { Hang } from './hang';

export class CheckContext {
  readonly table = new TypeTable();
  program: BindProgramResult | null = null;
  hangs: Hang[] = [];
  private readonly builtinDecls = new Map<string, number>();

  builtinDecl(builtinId: string) {
    const existing = this.builtinDecls.get(builtinId);
    if (existing != null) {
      return { fileId: -1, symbolId: existing };
    }
    const symbolId = this.builtinDecls.size;
    this.builtinDecls.set(builtinId, symbolId);
    return { fileId: -1, symbolId };
  }

  ctorOf(from: Hang, symbolId: number) {
    let hang = from;
    let id = symbolId;
    const seen = new Set<string>();
    for (;;) {
      const key = `${hang.file.snapshot.fileId}:${id}`;
      if (seen.has(key)) {
        return { hang, symbolId: id };
      }
      seen.add(key);
      const link = this.program?.links.find(
        (item) =>
          item.fromFileId === hang.file.snapshot.fileId &&
          item.importSymbolId === id &&
          item.exportSymbolId != null,
      );
      if (link?.exportSymbolId == null) {
        return { hang, symbolId: id };
      }
      const next =
        this.hangs.find(
          (item) => item.file.snapshot.fileId === link.toFileId,
        ) ?? null;
      if (next == null) {
        return { hang, symbolId: id };
      }
      hang = next;
      id = link.exportSymbolId;
    }
  }
}
