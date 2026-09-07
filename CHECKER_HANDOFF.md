# Checker 接手

- 最后更新：2026-09-07
- 目标读者：按已定稿模型继续实现 `@nxts/checker` 的人
- 权威不在本文。Binder 看 [`docs/compiler/frontend/4-nameBinding.md`](docs/compiler/frontend/4-nameBinding.md)，Checker 看 [`docs/compiler/frontend/5-checkerSemanticModel.md`](docs/compiler/frontend/5-checkerSemanticModel.md)。语言规则看 [`docs/language/types/index.md`](docs/language/types/index.md)。类型身份看 [`docs/language/types/2-typeIdentity.md`](docs/language/types/2-typeIdentity.md)。类型兼容看 [`docs/language/types/3-typeCompatibility.md`](docs/language/types/3-typeCompatibility.md)。

## 现状

| 包 / 文档                 | 状态                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nxts/parser`            | 已实现。`parseFile`                                                                                                                            |
| `@nxts/binder`            | 已实现。`bindFile`、`bindProgram`、`ExportResolver`。T57 规范已定稿                                                                            |
| `@nxts/checker`           | `checkProgram` 只 hang。`core/relation/` 已有 `assignable`，还没接到初值检查。`complete` 为 `false`。`check` / `flow` / `const` / `infer` 未接 |
| `6-constantEvaluation.md` | 部分定稿。求值/折叠分层已写入第 5 篇；位数、深度、步数预算仍归第 6 篇                                                                          |
| `7-effectAnalysis.md`     | 文档待建立（T58）                                                                                                                              |

不要重议 ScopeId / SymbolId 按文件分配、名称空间，或 checker 是否提供 `checkFile`。单文件检查 = 边为空的单模块 `checkProgram`。不要把 `TypeRecord` 再收成「只有原子」的过渡形状。不要把未确定的类型写法猜成一种接近的 `kind`。

## 已落地的图鉴与 hang

一次检查一份 `TypeTable`（挂在 `CheckContext.table`）。`types[]` 是去重后的规范类型集合，下标是 `TypeId`。别名不进表。`any` / `bigint` / `ErrorType` 不进公开表。

取号：

```ts
table.atom('i32');
table.intern({ kind: 'object', props: [...] });
```

`intern({ kind: 'atom', atom: 'i32' })` 与 `atom('i32')` 同一号。原子和 `unknown` 走专用槽；其它形状先 `canonicalize`，再哈希，撞了用 `equalShape` 比 `fields()` 摊平后的身份字段。钥匙只用于这次检查查找，不进运行时。

`TypeRecord = TypeShape & { id }`。`kind` 是类别（`atom` / `object` / `class` …），原子名在 `atom` 字段。名义声明用 `DeclId`（`fileId` + `symbolId`）。

`checkProgram` 在类型/值之间转不动点：`hangTypes`（type / interface / class / enum / 类型参数）和 `hangValues`（const / let / function）交替，直到 `symbolTypes` 不再增加。这样 `typeof` 能读到后置的值挂钩。`decl/` 扫声明；`hang/resolve/` 读类型写法；`hang/intern.ts` 收名义声明。`symbolTypes` 挂名字，`nodeTypes` 挂 AST 位置。`i32` 按 `builtinId` 认，不按标识符文本。

已能挂上的：原子、字面量、数组/元组/对象、联合/交叉、函数/构造、别名、名义类型、泛型默认实例化、对象/接口/数组/元组/联合/字典的 `keyof`、`T[K]`（键联合、可选 `| undefined`、数组/元组下标）、单/双索引 dictionary、`extends Named<T>` / 字典 heritage、条件/infer/mapped/闭合模板、有注解的数组解构与固定元组 rest、类实例字段侧表、跨文件 import 抄 TypeId、已挂钩值的 `typeof`（含属性链、`typeof Class`、`typeof Enum.Member`）、`const` 上的 `unique symbol` 注解。

还空着的：无注解初值的 `typeof` / `Symbol()` 推导、`typeof Enum` 命名空间、`this`、`x is T`、`import('x')`、开放模板（如 `` `user:${i32}` ``）、对象 rest、类方法进 `keyof`（等 T49）。

测试：`pnpm --filter @nxts/checker test`。空环境时 `i32` 未绑定，格子只能空着。测试 / playground 可传演示 `BindEnv`（例如 `{ name: 'i32', space: 'type', builtinId: 'i32' }`），不锁标准名单。

Playground：`pnpm dev:app`。页面只编辑源码；hang 结果在控制台三份 log（挂上的 symbols/nodes、`bind`、`check`）。Badge 只表示有没有诊断。`assignable` 还不会在这里跑。

## 已落地的 relation

`core/relation/`：`equal` / `assignable`，按 kind 分派。只给 `true` / `false`，不标 NoOp / Pack。

已能判：相等、`never`、字面量、`unique symbol`、品牌、联合/交叉、精确对象、对象→接口、接口互赋、`T[] → readonly T[]`、同构元组→只读数组、可选/rest 元组长度形状、对象/数组进字典、字典只读与 `NumberDict → StringDict`、单签名与重载函数（rest、`this` 接收者）。

已能判类→基类和类→接口。体在 `TypeTable.classBodies`，`assignable(table, source, target)` 自己读。还空着：只读元素协变（要等 NoOp / Pack）。TODO 都写了 `继续：` 条件。

## 下一步

把 `assignable` 接到 `const n: i32 = 1` 这类有注解初值。缺注解推导、收窄、常量、表达式/语句检查先不做。公开入口仍只有 `checkProgram`。

## 实现入口

公开面只有 `checkProgram(BindProgramResult)`。消费 `files`、`links`、`file.resolved`、`builtinId`。不重走 `export *`，不按标识符文本认 intrinsic，不解析路径，不构建 HIR。

目录与现状见 [`packages/nxts-checker/README.md`](packages/nxts-checker/README.md)。

## 仍待闭合（不阻塞底座）

| 项                           | 状态     | 文档                                             |
| ---------------------------- | -------- | ------------------------------------------------ |
| 常量求值预算                 | 部分定稿 | `docs/compiler/frontend/6-constantEvaluation.md` |
| T58 闭包与副作用             | 待讨论   | `docs/compiler/frontend/7-effectAnalysis.md`     |
| T61 同步异常                 | 待讨论   | 语言语义文档待建立                               |
| T59 异步                     | 待讨论   | 须在 T61 之后                                    |
| T60 迭代器 / 生成器          | 待讨论   | 异步迭代依赖 T59                                 |
| T50–T56 表达式、语句、`this` | 待讨论   | 语言类型/语义文档待建立                          |
| T55 路径与初始化顺序         | 讨论中   | host / compiler；checker 不解析路径              |
| T49 标准环境名单             | 讨论中   | `BindEnv` 由 host 传入，checker 只认 `builtinId` |

未闭环的异常、异步、生成器等语法应先出明确能力诊断，不能让未检查节点进入 HIR。

## 阅读顺序

1. `AGENTS.md`
2. `docs/compiler/frontend/4-nameBinding.md`
3. `docs/compiler/frontend/5-checkerSemanticModel.md`
4. `docs/language/types/2-typeIdentity.md`
5. `packages/nxts-binder/src/types.ts`、`bindProgram.ts`
6. `packages/nxts-checker/src/types.ts`、`core/typeTable.ts`、`hang/index.ts`
7. `packages/nxts-checker/README.md`、`core/relation/`
8. 下一步：`check/assign.ts` 用 `assignable` 查有注解初值
