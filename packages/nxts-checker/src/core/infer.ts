import { isNil } from 'aidly';
import type { Identifier, Node } from '@babel/types';
import type { Hang } from '../hang';
import type { TypeId } from '../types';
import { literalValueOf } from '../hang/resolve/literal';

const symbolCallOf = (node: Node) => {
  if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
    return false;
  }
  if (node.callee.name !== 'Symbol') {
    return false;
  }
  if (node.arguments.length === 0) {
    return true;
  }
  if (node.arguments.length !== 1) {
    return false;
  }
  const arg = node.arguments[0];
  return arg.type === 'StringLiteral' || arg.type === 'NumericLiteral';
};

// 缺注解标识符初值。只收直接字面量、已挂钩标识符、`Symbol()`。
// `const n = 1`
// `let s = "a"`
// `const x = Symbol()`
export class Infer {
  readonly hang: Hang;

  constructor(hang: Hang) {
    this.hang = hang;
  }

  simpleInits() {
    for (const node of this.hang.file.nodes) {
      if (node.type !== 'VariableDeclaration') {
        continue;
      }
      if (node.kind !== 'const' && node.kind !== 'let') {
        continue;
      }
      for (const declarator of node.declarations) {
        if (declarator.id.type !== 'Identifier' || isNil(declarator.init)) {
          continue;
        }
        if (!isNil(declarator.id.typeAnnotation)) {
          continue;
        }
        const symbolId = this.hang.symbolIn(declarator.id, 'value');
        if (isNil(symbolId) || !isNil(this.hang.symbolTypes[symbolId])) {
          continue;
        }
        const keepLiteral = node.kind === 'const';
        const raw = this.rawTypeOf(declarator.init, declarator.id, keepLiteral);
        if (isNil(raw)) {
          continue;
        }
        const binding = symbolCallOf(declarator.init)
          ? raw
          : this.bindingTypeOf(raw, keepLiteral);
        this.hang.hangPattern(declarator.id, binding);
        this.hang.hangNode(declarator.init, raw);
      }
    }
  }

  private rawTypeOf(node: Node, binding: Identifier, keepLiteral: boolean) {
    if (symbolCallOf(node)) {
      if (keepLiteral) {
        return this.uniqueOf(binding);
      }
      return this.hang.context.table.atom('symbol');
    }
    if (node.type === 'Identifier') {
      const symbolId = this.hang.symbolIn(node, 'value');
      if (isNil(symbolId)) {
        return null;
      }
      return this.hang.symbolTypes[symbolId] ?? null;
    }
    return this.literalTypeOf(node);
  }

  private literalTypeOf(node: Node) {
    const parsed = literalValueOf(node);
    if (isNil(parsed)) {
      return null;
    }
    return this.hang.context.table.intern({
      kind: 'literal',
      base: this.hang.context.table.atom(parsed.base),
      value: parsed.value,
    });
  }

  private uniqueOf(node: Identifier) {
    const symbolId = this.hang.symbolIn(node, 'value');
    if (isNil(symbolId)) {
      return null;
    }
    return this.hang.context.table.intern({
      kind: 'uniqueSymbol',
      decl: { fileId: this.hang.file.snapshot.fileId, symbolId },
    });
  }

  private bindingTypeOf(typeId: TypeId, keepLiteral: boolean) {
    const record = this.hang.context.table.types[typeId] ?? null;
    if (isNil(record)) {
      return typeId;
    }
    if (record.kind === 'uniqueSymbol') {
      return this.hang.context.table.atom('symbol');
    }
    if (record.kind === 'literal' && !keepLiteral) {
      return record.base;
    }
    return typeId;
  }
}
