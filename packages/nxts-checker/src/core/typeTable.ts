import { isNil } from 'aidly';
import type {
  AtomKind,
  ClassBody,
  TypeId,
  TypeRecord,
  TypeShape,
} from '../types';
import { canonicalize, equalShape, hashShape } from './typeKey';

export class TypeTable {
  readonly types: TypeRecord[] = [];
  // 类实例体。和图鉴同寿，不参与驻留键。
  readonly classBodies = new Map<TypeId, ClassBody>();
  private unknownId: TypeId | null = null;
  private readonly atoms = new Map<AtomKind, TypeId>();
  private readonly byHash = new Map<number, TypeId[]>();

  atom(atom: AtomKind) {
    const existing = this.atoms.get(atom) ?? null;
    if (!isNil(existing)) {
      return existing;
    }
    const id = this.push({ kind: 'atom', atom });
    this.atoms.set(atom, id);
    return id;
  }

  intern(shape: TypeShape) {
    if (shape.kind === 'atom') {
      return this.atom(shape.atom);
    }
    if (shape.kind === 'unknown') {
      return this.internUnknown();
    }
    if (shape.kind === 'union') {
      const members = this.flattenUnion(shape.members);
      if (members.length === 0) {
        return this.atom('never');
      }
      if (members.length === 1) {
        const [only] = members;
        if (!isNil(only)) {
          return only;
        }
      }
      return this.insert({ kind: 'union', members });
    }
    if (shape.kind === 'intersection') {
      const members = this.flattenIntersection(shape.members);
      if (members.some((id) => this.isNever(id))) {
        return this.atom('never');
      }
      if (members.length === 0) {
        return this.atom('never');
      }
      if (members.length === 1) {
        const [only] = members;
        if (!isNil(only)) {
          return only;
        }
      }
      return this.insert({ kind: 'intersection', members });
    }
    return this.insert(shape);
  }

  private internUnknown() {
    if (!isNil(this.unknownId)) {
      return this.unknownId;
    }
    const id = this.push({ kind: 'unknown' });
    this.unknownId = id;
    return id;
  }

  private insert(shape: TypeShape) {
    const canonical = canonicalize(shape);
    const hash = hashShape(canonical);
    const bucket = this.byHash.get(hash) ?? null;
    if (!isNil(bucket)) {
      for (const id of bucket) {
        const record = this.types[id] ?? null;
        if (!isNil(record) && equalShape(record, canonical)) {
          return id;
        }
      }
    }
    const id = this.push(canonical);
    if (!isNil(bucket)) {
      bucket.push(id);
      return id;
    }
    this.byHash.set(hash, [id]);
    return id;
  }

  private push(shape: TypeShape) {
    const id = this.types.length;
    this.types.push({ id, ...shape });
    return id;
  }

  private flattenUnion(members: readonly TypeId[]) {
    const out: TypeId[] = [];
    const seen = new Set<TypeId>();
    const visit = (id: TypeId) => {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      const record = this.types[id] ?? null;
      if (record?.kind === 'union') {
        for (const member of record.members) {
          visit(member);
        }
        return;
      }
      if (record?.kind === 'atom' && record.atom === 'never') {
        return;
      }
      out.push(id);
    };
    for (const id of members) {
      visit(id);
    }
    out.sort((left, right) => left - right);
    return out;
  }

  private flattenIntersection(members: readonly TypeId[]) {
    const out: TypeId[] = [];
    const seen = new Set<TypeId>();
    const visit = (id: TypeId) => {
      if (seen.has(id)) {
        return;
      }
      seen.add(id);
      const record = this.types[id] ?? null;
      if (record?.kind === 'intersection') {
        for (const member of record.members) {
          visit(member);
        }
        return;
      }
      out.push(id);
    };
    for (const id of members) {
      visit(id);
    }
    out.sort((left, right) => left - right);
    return out;
  }

  private isNever(id: TypeId) {
    const record = this.types[id] ?? null;
    return record?.kind === 'atom' && record.atom === 'never';
  }
}
