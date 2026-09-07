import { isNil } from 'aidly';
import type { CheckContext } from '../context';
import type {
  DeclId,
  DisplayMember,
  DisplayShape,
  TypeDisplay,
  TypeId,
  TypeRecord,
} from '../types';
import type { TypeTable } from './typeTable';

const primaryOf = (shape: DisplayShape) => {
  switch (shape.kind) {
    case 'atom':
      return shape.atom;
    case 'unknown':
      return 'unknown';
    case 'literal':
      if (shape.value.kind === 'string') {
        return JSON.stringify(shape.value.value);
      }
      return String(shape.value.value);
    case 'uniqueSymbol':
      return shape.name ?? 'unique symbol';
    case 'object':
      return '{...}';
    case 'interface':
      return shape.name ?? 'interface';
    case 'dictionary':
      return '{[k]: V}';
    case 'array':
      return 'T[]';
    case 'tuple':
      return '[...]';
    case 'function':
      return 'function';
    case 'construct':
      return 'construct';
    case 'union':
      return 'union';
    case 'intersection':
      return 'intersection';
    case 'brand':
      return 'Brand';
    case 'class':
      return shape.name ?? 'class';
    case 'classCtor':
      return isNil(shape.name) ? 'typeof class' : `typeof ${shape.name}`;
    case 'generic':
      return shape.name ?? 'generic';
    case 'enum':
      return shape.name ?? 'enum';
    case 'enumNamespace':
      return isNil(shape.name) ? 'typeof enum' : `typeof ${shape.name}`;
    case 'enumMember':
      return String(shape.value.value);
    case 'typeParam':
      return shape.name ?? 'T';
    case 'this':
      return 'this';
    case 'cycle':
      return '...';
  }
};

export class Display {
  readonly table: TypeTable;
  readonly context: CheckContext | null;

  constructor(table: TypeTable, context?: CheckContext | null) {
    this.table = table;
    this.context = context ?? null;
  }

  of(typeId: TypeId) {
    const canonical = this.shapeOf(typeId, new Set());
    const primary = primaryOf(canonical);
    return {
      primary,
      path: [primary],
      canonical,
    } satisfies TypeDisplay;
  }

  private nameOf(decl: DeclId) {
    if (isNil(this.context) || decl.fileId < 0) {
      return null;
    }
    const hang =
      this.context.hangs.find((item) => {
        return item.file.snapshot.fileId === decl.fileId;
      }) ?? null;
    if (isNil(hang)) {
      return null;
    }
    return hang.file.symbols[decl.symbolId]?.name ?? null;
  }

  private shapeOf(typeId: TypeId, seen: Set<TypeId>): DisplayShape {
    if (seen.has(typeId)) {
      return { kind: 'cycle' };
    }
    const record = this.table.types[typeId] ?? null;
    if (isNil(record)) {
      return { kind: 'unknown' };
    }
    const next = new Set(seen);
    next.add(typeId);
    return this.canonicalOf(record, next);
  }

  private shapesOf(ids: readonly TypeId[], seen: Set<TypeId>) {
    return ids.map((id) => this.shapeOf(id, seen));
  }

  private membersOf(
    props: readonly {
      key: string;
      type: TypeId;
      optional: boolean;
      readonly: boolean;
      role: DisplayMember['role'];
    }[],
    seen: Set<TypeId>,
  ) {
    return props.map((prop) => ({
      key: prop.key,
      type: this.shapeOf(prop.type, seen),
      optional: prop.optional,
      readonly: prop.readonly,
      role: prop.role,
    }));
  }

  private canonicalOf(record: TypeRecord, seen: Set<TypeId>): DisplayShape {
    switch (record.kind) {
      case 'atom':
        return { kind: 'atom', atom: record.atom };
      case 'unknown':
        return { kind: 'unknown' };
      case 'literal':
        return {
          kind: 'literal',
          base: this.shapeOf(record.base, seen),
          value: record.value,
        };
      case 'uniqueSymbol':
        return { kind: 'uniqueSymbol', name: this.nameOf(record.decl) };
      case 'object':
        return {
          kind: 'object',
          props: this.membersOf(record.props, seen),
          calls: this.shapesOf(record.calls, seen),
          constructs: this.shapesOf(record.constructs, seen),
        };
      case 'interface':
        return {
          kind: 'interface',
          name: null,
          props: this.membersOf(record.props, seen),
          calls: this.shapesOf(record.calls, seen),
          constructs: this.shapesOf(record.constructs, seen),
          args: this.shapesOf(record.args, seen),
        };
      case 'dictionary':
        return {
          kind: 'dictionary',
          key: this.shapeOf(record.key, seen),
          value: this.shapeOf(record.value, seen),
          readonly: record.readonly,
          props: this.membersOf(record.props, seen),
          numeric: isNil(record.numeric)
            ? null
            : {
                key: this.shapeOf(record.numeric.key, seen),
                value: this.shapeOf(record.numeric.value, seen),
                readonly: record.numeric.readonly,
              },
        };
      case 'array':
        return {
          kind: 'array',
          element: this.shapeOf(record.element, seen),
          readonly: record.readonly,
        };
      case 'tuple':
        return {
          kind: 'tuple',
          elements: record.elements.map((element) => ({
            type: this.shapeOf(element.type, seen),
            optional: element.optional,
            rest: element.rest,
          })),
          readonly: record.readonly,
        };
      case 'function':
      case 'construct':
        return {
          kind: record.kind,
          signatures: record.signatures.map((signature) => ({
            receiver: isNil(signature.receiver)
              ? null
              : this.shapeOf(signature.receiver, seen),
            params: signature.params.map((param) => ({
              type: this.shapeOf(param.type, seen),
              optional: param.optional,
              rest: param.rest,
            })),
            returnType: this.shapeOf(signature.returnType, seen),
          })),
        };
      case 'union':
      case 'intersection':
        return {
          kind: record.kind,
          members: this.shapesOf(record.members, seen),
        };
      case 'brand':
        return {
          kind: 'brand',
          base: this.shapeOf(record.base, seen),
          tag: this.shapeOf(record.tag, seen),
        };
      case 'class':
      case 'classCtor':
      case 'generic':
        return { kind: record.kind, name: this.nameOf(record.decl) };
      case 'enum':
        return { kind: 'enum', name: this.nameOf(record.decl) };
      case 'enumNamespace': {
        const enumRecord = this.table.types[record.enum] ?? null;
        return {
          kind: 'enumNamespace',
          name:
            enumRecord?.kind === 'enum' ? this.nameOf(enumRecord.decl) : null,
        };
      }
      case 'enumMember':
        return {
          kind: 'enumMember',
          enum: this.shapeOf(record.enum, seen),
          value: record.value,
        };
      case 'typeParam':
        return { kind: 'typeParam', name: this.nameOf(record.decl) };
      case 'this':
        return {
          kind: 'this',
          classType: this.shapeOf(record.classType, seen),
        };
    }
  }
}
