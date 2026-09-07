import { isNil } from 'aidly';
import type { BindProgramResult } from '@nxts/binder';
import type { Hang } from './hang';
import { TypeTable } from './core/typeTable';
import type { ObjectMember, TypeId } from './types';

export type ClassBody = {
  extends: TypeId | null;
  props: readonly ObjectMember[];
};

export class CheckContext {
  hangs: Hang[] = [];
  program: BindProgramResult | null = null;
  readonly table = new TypeTable();
  readonly classBodies = new Map<TypeId, ClassBody>();
  private readonly builtinDecls = new Map<string, number>();

  builtinDecl(builtinId: string) {
    const existing = this.builtinDecls.get(builtinId);
    if (!isNil(existing)) {
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
          !isNil(item.exportSymbolId),
      );
      if (isNil(link?.exportSymbolId)) {
        return { hang, symbolId: id };
      }
      const next =
        this.hangs.find(
          (item) => item.file.snapshot.fileId === link.toFileId,
        ) ?? null;

      if (isNil(next)) {
        return { hang, symbolId: id };
      }
      hang = next;
      id = link.exportSymbolId;
    }
  }
}
