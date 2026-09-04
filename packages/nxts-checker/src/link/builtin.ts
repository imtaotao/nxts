import type { TypeTable } from '../core/typeTable';

export function atomKindOf(builtinId: string) {
  switch (builtinId) {
    case 'boolean':
    case 'number':
    case 'string':
    case 'symbol':
    case 'null':
    case 'undefined':
    case 'i8':
    case 'i16':
    case 'i32':
    case 'i64':
    case 'u8':
    case 'u16':
    case 'u32':
    case 'u64':
    case 'f32':
    case 'f64':
    case 'usize':
    case 'isize':
    case 'void':
    case 'never':
      return builtinId;
    default:
      return null;
  }
}

export function internBuiltin(table: TypeTable, builtinId: string) {
  const atom = atomKindOf(builtinId);
  if (atom == null) {
    return null;
  }
  return table.atom(atom);
}

export function atomKindOfKeyword(type: string) {
  switch (type) {
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSStringKeyword':
      return 'string';
    case 'TSSymbolKeyword':
      return 'symbol';
    case 'TSNullKeyword':
      return 'null';
    case 'TSUndefinedKeyword':
      return 'undefined';
    case 'TSVoidKeyword':
      return 'void';
    case 'TSNeverKeyword':
      return 'never';
    default:
      return null;
  }
}
