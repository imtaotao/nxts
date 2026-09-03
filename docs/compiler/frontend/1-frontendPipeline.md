# 前端流水线

- 规范状态：已定稿
- 实现状态：部分实现
- 最后更新：2026-09-03
- 文档顺序：1

## 目标与边界

本规范定义源码从 Babel 解析结果进入语法验证、名称绑定、类型检查、控制流分析和 Checked HIR 之前的阶段顺序、输入输出与职责边界。

语言接受范围由 [`language/syntax`](../../language/syntax/index.md) 和 [`language/types`](../../language/types/index.md) 定义；本规范只确定如何执行这些规则，不新增或放宽语言能力。Babel AST 节点契约、诊断恢复和名称绑定分别由 [`2-babelAstContract.md`](./2-babelAstContract.md)、[`3-sourceAndDiagnostics.md`](./3-sourceAndDiagnostics.md) 和 [`4-nameBinding.md`](./4-nameBinding.md) 定义。

## 核心约束

- 使用 `@babel/parser` 产生的 JavaScript / TypeScript AST，不为源码语法重新定义一套 Nxts AST。
- 原始 AST 在前端阶段保持结构稳定；NodeId、绑定、类型、常量值和控制流事实存储在独立侧表中。
- 单文件解析与语法验证不得依赖其他模块；名称绑定和类型检查可以在程序模块图上运行。
- 存在编译错误时可以保留诊断和部分语义侧表，但不能生成可执行的 Checked HIR。
- 类型、收窄、可达性和已提交常量由 checker 一次推完。后续阶段只读侧表，不得再推断类型或猜测缺失类型。
- 前端不得确定物理布局、GC 描述、调用 ABI、LLVM 类型或目标相关指令。

## 实现进度

| 阶段                                       | 当前方案                                                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 源码快照、Babel 解析、NodeId、语法验证     | `@nxts/parser` 的 `createSnapshot`、`parseFile`                                                         |
| 单文件名称绑定                             | `@nxts/binder` 的 `bindFile`                                                                            |
| 跨文件导出名解析与 import 链接             | `@nxts/binder` 的 `bindProgram`；`ModuleEdge` 由调用方提供                                              |
| 磁盘路径、`fileId`、模块依赖图、初始化顺序 | `fileId` 和相对路径边由调用方提供。playground 已有临时解析；`@nxts/compiler` 的模块图和初始化顺序未实现 |
| 类型检查、常量、控制流                     | `@nxts/checker`，未实现                                                                                 |
| Checked HIR                                | `@nxts/ir` / compiler，未实现                                                                           |

## 流水线方案

```text
源码与文件身份
  ↓
Babel 解析
  ↓
AST 契约检查与 NodeId 分配
  ↓
Nxts 语法子集验证
  ↓
host 模块边 + 名称绑定
  ↓
类型检查、常量求值与控制流分析
  ↓
完整语义侧表
  ↓
Checked HIR 构建与验证
```

前三个 AST 阶段按文件独立执行，对应 `parseFile`。`bindFile` 只看一份已验证 AST，不解析路径。`bindProgram` 在调用方提供的 `{ fromFileId, specifier, toFileId }` 边上做导出名展开和 import 链接。类型检查按程序执行，避免把导入符号、导出可见性或跨文件循环依赖伪装成单文件规则。

## 阶段职责

| 阶段                   | 输入                                     | 输出                                                  | 不负责                       |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| 源码接入               | 路径、源码文本、编译选项                 | 具有稳定文件身份的源码快照                            | 解析语法、推导类型           |
| Babel 解析             | 源码快照                                 | Babel `File` AST、解析诊断                            | Nxts 能力取舍、名称解析      |
| AST 契约与 NodeId      | Babel AST                                | 可被后续阶段稳定引用的节点、`invalidNodes` 和源码范围 | 改写语言语义、建立符号       |
| 语法子集验证           | 带 NodeId 的 Babel AST                   | 支持、限制或拒绝结果以及语法诊断                      | 查询变量类型、识别 intrinsic |
| 模块边                 | 各文件 AST 中的 specifier 与路径解析     | `ModuleEdge[]`                                        | 词法绑定、类型检查           |
| 单文件名称绑定         | 已验证 AST、可选 `BindEnv`               | 作用域、符号、`imports` / `exports`；`resolved` 为空  | 路径解析、跨文件链接         |
| 程序名称绑定           | 各文件绑定结果、模块边、同一份 `BindEnv` | `links`、填好的 `file.resolved`、再导出诊断           | 类型兼容、值布局、路径解析   |
| 类型与控制流分析       | AST、绑定结果、语言类型规范              | TypeId、常量、收窄、调用和其他语义事实                | 机器布局、优化决策           |
| Checked HIR 构建与验证 | 无错误的 AST 和完整语义侧表              | 不再依赖 Babel 节点语义推断的 Checked HIR             | 补做名称绑定、猜测缺失类型   |

## 包职责

| 包               | 前端职责                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| `@nxts/parser`   | 调用 Babel、验证 AST 输入契约、分配 NodeId、执行 Nxts 语法子集验证。                                  |
| `@nxts/binder`   | 建立作用域与符号，解析声明与引用，展开导出名并链接 import。不检查类型，不分析控制流，不解析磁盘路径。 |
| `@nxts/checker`  | 消费绑定侧表，执行类型检查、常量求值、控制流和副作用分析，输出完整语义侧表。                          |
| `@nxts/ir`       | 定义 Checked HIR 数据结构、构建约束和验证器，不依赖 Babel AST 节点形状。                              |
| `@nxts/compiler` | 组织文件与模块、调度各阶段、汇总诊断，并在检查成功后根据 AST 与语义侧表构建 Checked HIR。             |

依赖必须保持单向：parser 不依赖 binder、checker、IR、优化器或后端；binder 不依赖 checker、IR、优化器或后端；checker 依赖 binder，不依赖优化器、后端、LLVM 或 runtime。标准库 intrinsic 必须在名称绑定后按 `builtinId` 识别；parser 不能按源码名称识别，binder 不判定 intrinsic 语义。`BindEnv` 名单由 T49 / 标准库 / host 传入，binder 不定白名单。

名称绑定由 `@nxts/binder` 完成，不属于 checker。Checked HIR 构建不属于 checker。该阶段由 `@nxts/compiler` 调度，消费无编译错误的 Babel AST 和完整语义侧表，并使用 `@nxts/ir` 提供的数据结构与验证器。类型分析 API 因此不需要构建 HIR，也不依赖后端编译流程。

## AST 与语义侧表

后续阶段通过 NodeId 关联同一 Babel 节点。至少需要以下独立事实类别：

| 事实类别             | 产生阶段                                  | 主要使用方                 |
| -------------------- | ----------------------------------------- | -------------------------- |
| 源码范围             | Parser                                    | 所有诊断与调试信息         |
| 声明与引用绑定       | Binder                                    | Checker                    |
| 导出名与 import 链接 | Binder                                    | Checker                    |
| 类型与常量           | Checker                                   | 控制流、Checked HIR        |
| 收窄与可达性         | 控制流分析                                | Checker、Checked HIR       |
| 内建能力身份         | Binder 记录 `builtinId`，Checker 解释语义 | Checked HIR、后续 lowering |

不得把 TypeId、SymbolId、运行时布局或 lowering 标记写入 Babel 节点的自定义属性。绑定侧表由名称绑定规范定义；类型与控制流侧表由 checker 语义模型定义。

当前 binder 侧表：

```text
NodeId   -> SymbolId[]    // 一节点可占多个名称空间
ScopeId  -> ScopeRecord
SymbolId -> SymbolRecord  // 含 declNodeId、builtinId
```

ScopeId 与 SymbolId 按文件分配。跨文件引用使用 `ModuleLink`（`exportSymbolId` 在 `import *` / `export * as` 时为 `null`），或 `file.resolved` 的 `found` / `namespace` / `ambiguous`。不合并全局 SymbolId。

### NodeId 生命周期

NodeId 是 Babel AST 节点在前端侧表中的内部索引，不属于源码语法、语言类型或运行时身份。

- 每个源码文件版本独立分配 NodeId；跨文件引用使用 `(FileId, NodeId)`。
- 同一份 AST 在一次编译与分析期间保持 NodeId 不变。
- 文件内容变化并重新解析后可以重新分配 NodeId，不保证跨版本数值相同。
- NodeId 不使用源码偏移量，也不替代 SymbolId、TypeId 或模块身份。
- 增量编译需要复用旧分析结果时，通过文件版本、内容哈希和独立节点映射完成，不能假设新旧 NodeId 相同。

具体整数宽度、分配顺序、Babel 节点覆盖范围和侧表索引结构由 Babel AST 契约定义。

## 错误与产物边界

| 状态                     | 后续处理                                                   |
| ------------------------ | ---------------------------------------------------------- |
| 无法形成可信 AST         | 停止该文件的语法验证，保留解析诊断。                       |
| AST 可恢复但存在语法错误 | 验证不受影响节点并继续收集诊断，不生成该程序的可执行 HIR。 |
| 名称或类型错误           | 保留可证明的绑定和类型侧表用于后续诊断，不生成可执行 HIR。 |
| 无编译错误               | 构建并验证 Checked HIR，之后才允许进入表示规划和优化阶段。 |
| 前端内部契约损坏         | 作为编译器实现错误处理，不能伪装成普通用户类型错误。       |

### 无效子树隔离

Babel 能形成可恢复 AST 时，前端按无效子树隔离错误：

- Parser 或语法验证器把不可信节点放入 `invalidNodes`，不把整个文件自动判为不可分析。
- Binder 跳过无效子树：不声明符号、不解析内部引用、不收录对应 export；继续处理同级及后续可信节点。
- 无效声明不能建立可被正常代码引用的有效符号。后续引用按未解析处理。内部错误符号待确认。
- 无效表达式可以产生内部 `ErrorType` 以维持遍历和抑制重复诊断；`ErrorType` 不是 Nxts 语言类型，不能参与正常兼容结论、导出或进入 Checked HIR。`ErrorType` 由 checker 产生，待确认。
- 语法错误破坏作用域、声明边界或模块结构且无法确定恢复边界时，停止对应作用域或文件的后续语义分析。

无论其他节点能否继续分析，只要程序存在编译错误，就不能构建可执行 Checked HIR。

诊断排序、错误节点表示、最大恢复数量和编译器 API 返回结构由源码与诊断规范统一定义。

## 公开入口

解析和绑定同时提供单文件入口和程序入口。类型检查只有 `checkProgram`，不能维护两套检查逻辑。

| 入口         | 当前方案                                                                        |
| ------------ | ------------------------------------------------------------------------------- |
| 单文件解析   | `@nxts/parser` 的 `parseFile`：AST 契约、语法验证、诊断。                       |
| 单文件绑定   | `@nxts/binder` 的 `bindFile`：词法绑定和文件内 import / export 表。不解析依赖。 |
| 程序绑定     | `@nxts/binder` 的 `bindProgram`：在给定边上链接 import、展开 `resolved`。       |
| 完整程序检查 | `@nxts/checker` 的 `checkProgram`：消费 `BindProgramResult`。未实现。           |
| 单文件检查   | 不单独提供入口。一个文件且模块边为空时即单模块程序，复用 `checkProgram`。       |

单文件存在导入时必须通过程序入口传入模块边，不能假设外部符号存在或忽略未解析模块。语义查询基于一次检查产生的不可变结果，按 NodeId 提供类型、符号、常量、控制流事实和诊断，不依赖进程级可变全局状态。

具体 API 名称、参数、取消机制和结果数据结构分别由 Babel AST 契约、源码与诊断规范、名称绑定规范及 checker 语义模型定义。已落地的绑定 API 见 `@nxts/binder` 的 `BindFileResult` / `BindProgramResult`。检查入口见 `@nxts/checker` 的 `checkProgram`。

## 性能约束

- 同一源码单元在一次完整编译中只解析一次。
- 进程内阶段之间传递结构化对象和侧表，不通过 JSON 序列化 AST。
- 语法验证、绑定和类型分析以接近 AST 与类型图规模的线性路径为目标；需要超线性处理的规则必须具有预算和缓存。
- `file.resolved` 在 `bindProgram` 时物化导出名，避免 checker 每次查询重走 `export *`。
- 前端便利不能向 Checked HIR 注入统一装箱、动态名称查找或运行时类型回退。
- 尚未实现的语言能力必须在验证或检查阶段明确拒绝，不能原样穿透到后端。
