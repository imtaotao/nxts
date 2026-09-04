import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import type { Hang } from '../index';
import type { LiteralValue, TypeId } from '../../types';
import { finish } from './shared';

const numericRaw = (node: Extract<Node, { type: 'NumericLiteral' }>) => {
  const extra = node.extra;
  if (!isNil(extra) && typeof extra.raw === 'string') {
    return extra.raw;
  }
  return String(node.value);
};

const numericBase = (raw: string) => {
  if (raw.includes('.') || /e/i.test(raw)) {
    return 'f64' as const;
  }
  return 'i32' as const;
};

const numericText = (value: number) => {
  if (value === 0) {
    return '0';
  }
  return String(value);
};

const templateText = (node: Extract<Node, { type: 'TemplateLiteral' }>) => {
  if (node.expressions.length > 0) {
    return null;
  }
  return node.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
};

const literalValueOf = (node: Node) => {
  if (node.type === 'BooleanLiteral') {
    return {
      base: 'boolean' as const,
      value: { kind: 'boolean', value: node.value } satisfies LiteralValue,
    };
  }
  if (node.type === 'StringLiteral') {
    return {
      base: 'string' as const,
      value: { kind: 'string', value: node.value } satisfies LiteralValue,
    };
  }
  if (node.type === 'TemplateLiteral') {
    const text = templateText(node);
    if (isNil(text)) {
      return null;
    }
    return {
      base: 'string' as const,
      value: { kind: 'string', value: text } satisfies LiteralValue,
    };
  }
  if (node.type === 'NumericLiteral') {
    return {
      base: numericBase(numericRaw(node)),
      value: {
        kind: 'numeric',
        value: numericText(node.value),
      } satisfies LiteralValue,
    };
  }
  if (
    node.type !== 'UnaryExpression' ||
    node.argument.type !== 'NumericLiteral'
  ) {
    return null;
  }
  if (node.operator !== '-' && node.operator !== '+') {
    return null;
  }
  const signed =
    node.operator === '-' ? -node.argument.value : node.argument.value;
  return {
    base: numericBase(numericRaw(node.argument)),
    value: {
      kind: 'numeric',
      value: numericText(signed),
    } satisfies LiteralValue,
  };
};

export function resolveLiteral(
  hang: Hang,
  type: Node,
  subst?: ReadonlyMap<number, TypeId>,
) {
  if (type.type !== 'TSLiteralType') {
    return null;
  }
  const literal = literalValueOf(type.literal);
  if (isNil(literal)) {
    return null;
  }
  return finish(
    hang,
    type,
    hang.context.table.intern({
      kind: 'literal',
      base: hang.context.table.atom(literal.base),
      value: literal.value,
    }),
    subst,
  );
}
