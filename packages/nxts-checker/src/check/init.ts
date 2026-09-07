import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../hang';
import type { AtomKind, TypeId } from '../types';
import { atomOf, recordOf } from '../core/relation/shared';
import { literalValueOf } from '../hang/resolve/literal';

const integers = new Set<AtomKind>([
  'i8',
  'i16',
  'i32',
  'i64',
  'u8',
  'u16',
  'u32',
  'u64',
  'usize',
  'isize',
]);

const floats = new Set<AtomKind>(['f32', 'f64', 'number']);

const intRange: Partial<Record<AtomKind, { min: bigint; max: bigint }>> = {
  i8: { min: BigInt(-128), max: BigInt(127) },
  i16: { min: BigInt(-32768), max: BigInt(32767) },
  i32: { min: BigInt(-2147483648), max: BigInt(2147483647) },
  i64: {
    min: -BigInt('9223372036854775808'),
    max: BigInt('9223372036854775807'),
  },
  u8: { min: BigInt(0), max: BigInt(255) },
  u16: { min: BigInt(0), max: BigInt(65535) },
  u32: { min: BigInt(0), max: BigInt(4294967295) },
  u64: { min: BigInt(0), max: BigInt('18446744073709551615') },
};

const numericNodeOf = (node: Node) => {
  if (node.type === 'NumericLiteral') {
    return { literal: node, sign: BigInt(1) };
  }
  if (
    node.type !== 'UnaryExpression' ||
    node.argument.type !== 'NumericLiteral'
  ) {
    return null;
  }
  if (node.operator === '-') {
    return { literal: node.argument, sign: BigInt(-1) };
  }
  if (node.operator === '+') {
    return { literal: node.argument, sign: BigInt(1) };
  }
  return null;
};

const integerRawOf = (node: Extract<Node, { type: 'NumericLiteral' }>) => {
  const extra = node.extra;
  const raw =
    !isNil(extra) && typeof extra.raw === 'string'
      ? extra.raw
      : String(node.value);
  const text = raw.replaceAll('_', '');
  if (text.includes('.') || /e/i.test(text)) {
    return null;
  }
  try {
    return BigInt(text);
  } catch {
    return null;
  }
};

const fitsInteger = (atom: AtomKind, value: bigint) => {
  const range = intRange[atom] ?? null;
  if (isNil(range)) {
    return true;
  }
  return value >= range.min && value <= range.max;
};

const sameLiteral = (
  left: ReturnType<typeof literalValueOf>,
  right: {
    kind: 'boolean' | 'string' | 'numeric';
    value: unknown;
  },
) => {
  if (isNil(left)) {
    return false;
  }
  return (
    left.value.kind === right.kind &&
    String(left.value.value) === String(right.value)
  );
};

// 值位置上能直接收的初值。带目标时按 T08/T20 收字面量。
// `1`
// `"a"`
// `-1`
// `n`
export class SimpleInit {
  readonly hang: Hang;

  constructor(hang: Hang) {
    this.hang = hang;
  }

  type(node: Node, target: TypeId) {
    if (node.type === 'Identifier') {
      const symbolId = this.hang.symbolIn(node, 'value');
      if (isNil(symbolId)) {
        return null;
      }
      return this.hang.symbolTypes[symbolId] ?? null;
    }
    const parsed = literalValueOf(node);
    if (isNil(parsed)) {
      return null;
    }
    const base = this.adoptBase(node, target);
    if (isNil(base)) {
      return null;
    }
    const numeric = numericNodeOf(node);
    const integer = isNil(numeric) ? null : integerRawOf(numeric.literal);
    const value =
      parsed.value.kind === 'numeric' && !isNil(integer) && !isNil(numeric)
        ? {
            kind: 'numeric' as const,
            value: (integer * numeric.sign).toString(),
          }
        : parsed.value;
    return this.hang.context.table.intern({
      kind: 'literal',
      base,
      value,
    });
  }

  private adoptBase(node: Node, target: TypeId) {
    const parsed = literalValueOf(node);
    if (isNil(parsed)) {
      return null;
    }
    const record = recordOf(this.hang.context.table, target);
    if (record?.kind === 'literal') {
      return sameLiteral(parsed, record.value) ? record.base : null;
    }
    const atom = atomOf(this.hang.context.table, target);
    if (parsed.value.kind === 'boolean') {
      return atom === 'boolean'
        ? target
        : this.hang.context.table.atom(parsed.base);
    }
    if (parsed.value.kind === 'string') {
      return atom === 'string'
        ? target
        : this.hang.context.table.atom(parsed.base);
    }
    if (isNil(atom) || (!integers.has(atom) && !floats.has(atom))) {
      return this.hang.context.table.atom(parsed.base);
    }
    const numeric = numericNodeOf(node);
    if (isNil(numeric)) {
      return null;
    }
    const integer = integerRawOf(numeric.literal);
    if (integers.has(atom)) {
      if (isNil(integer)) {
        return null;
      }
      const value = integer * numeric.sign;
      if (atom !== 'usize' && atom !== 'isize' && !fitsInteger(atom, value)) {
        return null;
      }
      if (atom === 'usize' && value < BigInt(0)) {
        return null;
      }
      return target;
    }
    return target;
  }
}
