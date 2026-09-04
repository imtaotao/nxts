# Checker 接手

- 最后更新：2026-09-04
- 当前提交：`69f8c32`
- 目标读者：按已定稿模型继续实现 `@nxts/checker` 的人
- 权威不在本文。Binder 看 [`docs/compiler/frontend/4-nameBinding.md`](docs/compiler/frontend/4-nameBinding.md)，Checker 看 [`docs/compiler/frontend/5-checkerSemanticModel.md`](docs/compiler/frontend/5-checkerSemanticModel.md)。语言规则看 [`docs/language/types/index.md`](docs/language/types/index.md)。类型身份看 [`docs/language/types/2-typeIdentity.md`](docs/language/types/2-typeIdentity.md)。

## 现状

| 包 / 文档                 | 状态                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `@nxts/parser`            | 已实现。`parseFile`                                                                                                              |
| `@nxts/binder`            | 已实现。`bindFile`、`bindProgram`、`ExportResolver`。T57 规范已定稿                                                              |
| `@nxts/checker`           | `checkProgram` 只 hang。有注解的声明和类型写法进入图鉴与挂钩表。`complete` 为 `false`。`check` / `flow` / `const` / `infer` 未接 |
| `6-constantEvaluation.md` | 部分定稿。求值/折叠分层已写入第 5 篇；位数、深度、步数预算仍归第 6 篇                                                            |
| `7-effectAnalysis.md`     | 文档待建立（T58）                                                                                                                |

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

`checkProgram` 先 `hangTypes`（type / interface / class / enum / 类型参数），再 `hangValues`（const / let / function）。`decl/` 扫声明；`hang/resolve/` 读类型写法；`hang/intern.ts` 收名义声明。`symbolTypes` 挂名字，`nodeTypes` 挂 AST 位置。`i32` 按 `builtinId` 认，不按标识符文本。

已能挂上的：原子、字面量、数组/元组/对象、联合/交叉、函数/构造、别名、名义类型、泛型默认实例化、对象/接口的 `keyof`、`T['x']` 固定字符串键、单索引 dictionary、有注解的解构、跨文件 import 抄 TypeId。

还空着的：`typeof`、条件/infer/mapped/模板、`this`、`x is T`、`import('x')`、unique symbol、双索引、数组 `keyof`、可选属性读出 `| undefined`。

测试：`pnpm --filter @nxts/checker test`。空环境时 `i32` 未绑定，格子只能空着。测试 / playground 可传演示 `BindEnv`（例如 `{ name: 'i32', space: 'type', builtinId: 'i32' }`），不锁标准名单。

## 下一步

`core/relation.ts` 的可赋值。现在只有 `left === right`（`TypeId` 身份）。初值检查、缺注解推导、收窄、常量先不做。

公开入口仍只有 `checkProgram`。

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
7. `packages/nxts-checker/README.md`，下一步填 `core/relation.ts`
