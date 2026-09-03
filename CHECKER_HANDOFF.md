# Checker 接手

- 最后更新：2026-09-03
- 目标读者：按已定稿模型实现 `@nxts/checker` 的人
- 权威不在本文。Binder 看 [`docs/compiler/frontend/4-nameBinding.md`](docs/compiler/frontend/4-nameBinding.md)，Checker 看 [`docs/compiler/frontend/5-checkerSemanticModel.md`](docs/compiler/frontend/5-checkerSemanticModel.md)。语言规则看 [`docs/language/types/index.md`](docs/language/types/index.md)。

## 现状

| 包 / 文档                 | 状态                                                                  |
| ------------------------- | --------------------------------------------------------------------- |
| `@nxts/parser`            | 已实现。`parseFile`                                                   |
| `@nxts/binder`            | 已实现。`bindFile`、`bindProgram`、`ExportResolver`。T57 规范已定稿   |
| `@nxts/checker`           | 语义模型已定稿。包内目录与 `checkProgram` 空壳已在，检查逻辑未实现    |
| `6-constantEvaluation.md` | 部分定稿。求值/折叠分层已写入第 5 篇；位数、深度、步数预算仍归第 6 篇 |
| `7-effectAnalysis.md`     | 文档待建立（T58）                                                     |

不要重议 ScopeId / SymbolId 按文件分配、名称空间，或 checker 是否提供 `checkFile`。单文件检查 = 边为空的单模块 `checkProgram`。

## 实现入口

公开面只有 `checkProgram(BindProgramResult)`。消费 `files`、`links`、`file.resolved`、`builtinId`。不重走 `export *`，不按标识符文本认 intrinsic，不解析路径，不构建 HIR。

空壳与职责见 [`packages/nxts-checker/README.md`](packages/nxts-checker/README.md)。`checkProgram` 已按第 5 篇交出空侧表；检查逻辑未实现。

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
4. `packages/nxts-binder/src/types.ts`、`bindProgram.ts`
5. `packages/nxts-checker/README.md`，从 `core/` 与 `checkProgram` 填实现
