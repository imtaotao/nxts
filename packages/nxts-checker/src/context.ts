import type { AtomKind, TypeId, TypeRecord } from './types';

export class CheckContext {
  readonly types: TypeRecord[] = [];
  private readonly byKey = new Map<string, TypeId>();

  intern(key: string, kind: AtomKind) {
    const existing = this.byKey.get(key) ?? null;
    if (existing != null) {
      return existing;
    }
    const id = this.types.length;
    this.types.push({ id, kind });
    this.byKey.set(key, id);
    return id;
  }
}
