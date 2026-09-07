import { isNil } from 'aidly';
import type { BindFileResult } from '@nxts/binder';
import type { Identifier, Node } from '@babel/types';
import type { TypeId } from '../types';
import type { CheckContext } from '../context';
import { internBuiltin } from '../link/builtin';
import { hasTypeParams, unwrapType } from './ast';
import { aliasDeclOf, internNominal, internTypeParam } from './intern';
import { instantiateRef } from './instantiate';
import { hangPattern as applyPattern } from './pattern';
import { resolveByType } from './resolve';

// hang 只把能确定的类型写法和声明收成 TypeId。下面这些现在保持空：
//
// 要等推导 / 控制流
// - 无注解初值的 typeof、`const x = Symbol()` 的 unique symbol。继续：T05；hang 不猜初值。
// - 分支里的 typeof。继续：T06，等 flow/narrow。
//
// 要等文档 / 图鉴
// - typeof Enum 命名空间。继续：T40；不能把 enum 行冒充命名空间。
// - this、import('x')。继续：T56 / T55。
// - 对象 rest。继续：T52。
// - 数组 / 类方法进 keyof、Brand。继续：T49。
// - 字典再带调用 / 构造。继续：T29 / T32 先定图鉴怎么合。
//
// 类型运算边界
// - 开放模板（`user:${i32}`）。继续：T41 不新开 delay 节点。
// - x is T。继续：T06；谓词不进 types[]。
// - unique symbol 出现在非 const 注解。继续：T18 只允许 const / 以后的 static readonly。

export class Hang {
  readonly context: CheckContext;
  readonly file: BindFileResult;
  readonly symbolTypes: (TypeId | null)[];
  readonly nodeTypes: (TypeId | null)[];
  readonly resolving = new Set<number>();

  constructor(context: CheckContext, file: BindFileResult) {
    this.context = context;
    this.file = file;
    this.symbolTypes = file.symbols.map(() => null);
    this.nodeTypes = Array.from(
      { length: file.nodeToSymbols.length },
      () => null,
    );
  }

  nodeIdOf(node: object) {
    return (
      this.file.nodeIds.get(node as BindFileResult['nodes'][number]) ?? null
    );
  }

  symbolIn(node: object, space: 'value' | 'type') {
    const nodeId = this.nodeIdOf(node);
    if (isNil(nodeId)) {
      return null;
    }
    for (const id of this.file.nodeToSymbols[nodeId] ?? []) {
      if (this.file.symbols[id]?.space === space) {
        return id;
      }
    }
    return null;
  }

  hangNode(node: object, typeId: TypeId) {
    const nodeId = this.nodeIdOf(node);
    if (!isNil(nodeId)) {
      this.nodeTypes[nodeId] = typeId;
    }
  }

  // 类型空间名字
  // `type A = i32`
  // `interface Box`
  // `class Box`
  // `enum Kind`
  // `<T>`
  typeOfTypeSymbol(symbolId: number): TypeId | null {
    const cached = this.symbolTypes[symbolId] ?? null;
    if (!isNil(cached)) {
      return cached;
    }
    const symbol = this.file.symbols[symbolId] ?? null;
    if (isNil(symbol) || symbol.space !== 'type') {
      return null;
    }
    if (!isNil(symbol.builtinId)) {
      const typeId = internBuiltin(this.context.table, symbol.builtinId);
      if (!isNil(typeId)) {
        this.symbolTypes[symbolId] = typeId;
      }
      return typeId;
    }
    if (this.resolving.has(symbolId)) {
      return null;
    }

    const alias = aliasDeclOf(this, symbolId);
    if (!isNil(alias)) {
      if (hasTypeParams(alias)) {
        return null;
      }
      this.resolving.add(symbolId);
      const typeId = this.resolveAtomType(alias.typeAnnotation);
      this.resolving.delete(symbolId);
      if (isNil(typeId)) {
        return null;
      }
      this.symbolTypes[symbolId] = typeId;
      this.hangNode(alias.id, typeId);
      this.hangNode(alias.typeAnnotation, typeId);
      return typeId;
    }

    const nominal = internNominal(this, symbolId);
    if (!isNil(nominal)) {
      return nominal;
    }
    return internTypeParam(this, symbolId);
  }

  // 类型写法入口，按 AST type 分派
  // `i32[]`
  // `{ x: number }`
  // `Foo<i32>`
  resolveAtomType(
    node: Node,
    subst?: ReadonlyMap<number, TypeId>,
  ): TypeId | null {
    const type = unwrapType(node);
    return resolveByType[type.type]?.(this, type, subst) ?? null;
  }

  hangValueIdent(node: Identifier) {
    return applyPattern(this, node);
  }

  // 有注解的绑定
  // `const n: i32`
  // `function f(n: i32)`
  // `const [x, y]: [i32, string]`
  hangPattern(node: Node, expected?: TypeId) {
    return applyPattern(this, node, expected);
  }

  // 泛型实例
  // `Cell<i32>`
  // `Box<string>`
  // `Named<T>`
  instantiate(symbolId: number, args: TypeId[]) {
    return instantiateRef(this, symbolId, args);
  }
}
