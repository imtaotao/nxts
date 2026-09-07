import { isNil } from 'aidly';
import type { Node } from '@babel/types';
import { Display } from '../core/display';
import { assignable } from '../core/relation';
import type { Hang } from '../hang';
import { literalValueOf } from '../hang/resolve/literal';
import type { TypeId } from '../types';
import { SimpleInit } from './init';

// 有注解的标识符初值。解构、左值、spread 仍等 T52。
// `const n: i32 = 1`
// `const s: string = "a"`
// `const n: i32 = already`
export class AnnotatedInits {
  readonly hang: Hang;
  private readonly init: SimpleInit;
  private readonly display: Display;

  constructor(hang: Hang) {
    this.hang = hang;
    this.init = new SimpleInit(hang);
    this.display = new Display(hang.context.table, hang.context);
  }

  check() {
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
        if (this.hang.isError(declarator.init)) {
          continue;
        }
        const symbolId = this.hang.symbolIn(declarator.id, 'value');
        if (isNil(symbolId)) {
          continue;
        }
        const target = this.hang.symbolTypes[symbolId] ?? null;
        if (isNil(target)) {
          continue;
        }
        const source = this.init.type(declarator.init, target);
        if (isNil(source)) {
          const shown = this.shownLiteralOf(declarator.init);
          if (!isNil(shown)) {
            this.reject(declarator.init, shown, target);
          }
          continue;
        }
        if (!assignable(this.hang.context.table, source, target)) {
          this.reject(declarator.init, source, target);
          continue;
        }
        this.hang.hangNode(declarator.init, source);
      }
    }
  }

  private shownLiteralOf(node: Node) {
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

  private reject(node: Node, source: TypeId, target: TypeId) {
    this.hang.markError(node);
    this.hang.diagnose('checker.notAssignable', node, [
      this.display.of(source),
      this.display.of(target),
    ]);
  }
}
