# Nxts Binder 与 Checker 设计交接

- 交接日期：2026-09-02
- 目标读者：定稿 `4-nameBinding.md` 并开始 Checker 的 AI
- 当前工作重点：`@nxts/binder` 实现已落地；规范正文 `4-nameBinding.md` 仍待建立；`@nxts/checker` 未开始

## 当前现状

| 包                      | 状态                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| `packages/nxts-parser`  | 已实现。公开入口 `parseFile`，输出 AST、NodeId、`invalidNodes` 和诊断。 |
| `packages/nxts-binder`  | 已实现。公开入口 `bindFile`、`bindProgram`、`ExportResolver`。          |
| `packages/nxts-checker` | `src/index.ts` 仍为占位。                                               |
| `packages/nxts-ir`      | 包骨架存在，IR 规范部分定稿，不是当前讨论重点。                         |

Parser 一致性测试规范仍规划为独立专项，不阻塞后续阶段：

- `docs/quality/1-parserConformance.md`
- `docs/quality/2-semanticConformance.md`

如果实现暴露规范矛盾，应记录源码示例、Babel AST 和冲突文档位置，再讨论是否修正规范。不得为了降低实现成本自行改变已定稿语言行为。

`docs/compiler/frontend/1-frontendPipeline.md` 的实现状态标记仍写「未实现」，与 parser / binder 代码不一致，更新状态待确认。

## 项目目标与决策优先级

Nxts 是 TypeScript 风格的静态编译语言，目标是以静态类型和原生编译获得接近 Go 的性能。

| 场景            | 决策原则                                                                               |
| --------------- | -------------------------------------------------------------------------------------- |
| 性能目标        | 性能是第一优先级，最终目标是常见静态路径达到等价 Go 程序的性能级别                     |
| 首版性能        | 核心吞吐约为等价 Go 实现的 50% 可以接受，但架构不能阻止最终目标                        |
| 已有 JS/TS 能力 | 在不破坏性能和静态类型一致性的前提下，优先兼容 JavaScript 严格模式和 TypeScript strict |
| JS 行为影响性能 | 明确拒绝该能力，或要求用户选择显式的原生类型、转换或标准库 API                         |
| Nxts 新能力     | JavaScript 没有对应语义时优先参考 Rust 的确定、静态、无隐藏成本规则                    |
| 实现阶段        | 优先定义最终稳定方案，不采用以后必须推翻的临时类型规则                                 |

Nxts 源码接受范围是 TypeScript 的严格静态子集。Nxts 可以拒绝 TypeScript 接受的程序，但不能通过额外语法或更宽松类型规则扩大接受范围。工具链提供内建类型声明后，通过 Nxts 的程序也应能通过 TypeScript strict 类型检查。

禁止为了方便 Checker 或后端实现而引入：

- 统一装箱。
- 通用动态字段查找。
- 隐式运行时类型检查。
- 隐式对象裁剪。
- 隐式动态分派。
- 不可见的强制堆分配。
- 用 `any`、`unknown` 或部分类型掩盖分析失败。

## 文档职责

同一规则只能有一个权威来源。更新文档前应先阅读 `AGENTS.md` 和以下索引：

| 领域       | 权威内容                                     | 索引                               |
| ---------- | -------------------------------------------- | ---------------------------------- |
| 语法       | Babel AST 接受、限制和拒绝边界               | `docs/language/syntax/index.md`    |
| 类型       | 类型身份、推导、兼容、转换和收窄             | `docs/language/types/index.md`     |
| 语义       | 用户可观察的值、表达式和语句行为             | `docs/language/semantics/index.md` |
| 模块       | 模块解析、导入导出图和初始化                 | `docs/language/modules/index.md`   |
| 编译器前端 | Parser、Binder、Checker 的数据结构和阶段职责 | `docs/compiler/frontend/index.md`  |
| IR         | 阶段间必须保留的已检查事实                   | `docs/compiler/ir/index.md`        |
| 质量       | 跨阶段一致性测试和验收矩阵                   | `docs/quality/index.md`            |

`compiler/frontend` 只能定义如何实现语言规则，不能重新定义 `language/types` 或 `language/semantics` 已经确定的结果。

Binder 规范正文是 `docs/compiler/frontend/4-nameBinding.md`，当前文件不存在。实现以 `packages/nxts-binder/src` 为准，写规范时按代码收录，未决项标「待确认」。

## Parser 已定稿契约

以下 Parser 规范已经定稿：

- `docs/compiler/frontend/1-frontendPipeline.md`
- `docs/compiler/frontend/2-babelAstContract.md`
- `docs/compiler/frontend/3-sourceAndDiagnostics.md`
- `docs/language/syntax/1-syntaxSubset.md`

Checker 必须消费这些既有契约。

### Babel AST 与 NodeId

- 使用 Babel AST，不复制为第二套 Nxts AST。
- Parser、Validator、Binder 和 Checker 不得原地替换、删除、重排或扩展 Babel Node。
- Parser 通过固定 `VISITOR_KEYS` 前序遍历，为结构有效的节点分配每文件局部连续 NodeId。
- AST 节点、NodeId、SourceSpan、tokens 和 comments 由 Parser 结果提供。被拒绝的可恢复节点进入 `invalidNodes`。
- 绑定、类型、常量、控制流和副作用事实必须存储在 NodeId 侧表。
- SourceVersion 改变后不能继续复用旧 AST、NodeId 或语义侧表。

### 诊断边界

- 用户源码错误通过不可变结果返回结构化诊断，公开 API 不因预期用户错误抛异常。
- `NXT1xxx` 属于 Parser 与 Validator。
- `NXT2xxx` 属于 Binder、模块和名称解析。当前 binder 使用 `NXT2101`–`NXT2104`。
- `NXT3xxx` 属于类型检查与类型关系。
- `NXT4xxx` 属于控制流、常量和副作用分析。
- 内部契约损坏可以进入异常通道，但 CLI 和 language service 必须在最外层捕获。
- 存在错误时可以保留部分 AST 和语义侧表，但不能生成可执行 Checked HIR。

### Parser 与 Checker 的能力边界

Parser 不按标识符文本识别标准内建能力。`eval`、`Function`、`Proxy`、`BigInt`、`String`、`Symbol` 和其他内建名称必须先由 Binder 解析符号身份，再由 Checker 决定是否合法。

以下语法可以由 Parser 接受，但当前需要 Binder 或 Checker 诊断：

| 语法                                 | 后续处理                                            |
| ------------------------------------ | --------------------------------------------------- |
| `import()`、顶层 `await`             | T55/T59 能力未形成闭环时由 Checker 产生能力诊断     |
| import attributes                    | T55 资源模块能力未形成闭环时由 Checker 产生能力诊断 |
| `satisfies`                          | Checker 产生不支持诊断                              |
| 普通 `as Type`                       | Checker 区分 `as const`、品牌候选与非法普通断言     |
| `new String(...)`、`new Symbol(...)` | 按绑定后的标准符号身份产生不可构造诊断              |
| 普通函数用于 `new`                   | Checker 根据静态类型产生不可构造诊断                |
| `call`、`apply`、`bind`              | Parser 保留成员访问，Checker 根据函数类型能力诊断   |
| `RegExpLiteral`、`debugger`          | 能力未定义时由后续阶段诊断                          |

Parser 已拒绝的语法不能再次进入正常 Binder/Checker 路径。Binder 跳过 `invalidNodes` 子树：不为其声明符号、不解析内部引用、不收录对应 export。

## 类型系统现状

`docs/language/types/1-typeClassification.md` 至 `28-typeConversions.md` 共 28 份文档已经定稿，覆盖 T01 至 T44：

- 类型分类、身份、兼容、类型格、推导和控制流收窄。
- 基础类型、原生数值、字符串、空值、特殊类型和字面量。
- 联合、交叉、对象、接口、字典和递归类型。
- 函数、数组、元组、类、泛型、枚举和类型级计算。
- 类型断言与表示转换。

`docs/language/semantics/1-numericSemantics.md` 至 `14-tupleSemantics.md` 已经定稿，覆盖现有基础值和复合值的用户可观察行为。

Checker 必须直接实现这些规范，不能在 `compiler/frontend` 中复制一套简化规则。

需要特别保持的类型边界：

- 禁止语言类型 `any`、`bigint` 和宽 `object`。
- `unknown` 必须经过有效收窄或受信动态检查才能用于具体操作。
- 普通 `as Type`、双重断言和非空断言不受支持。
- 支持受限 `as const` 和不改变运行时表示的品牌建立。
- 类型级计算必须在编译期闭合，不能生成运行时类型分派。
- 进入可执行 Checked HIR 前必须得到具体可信类型。
- 复杂度预算耗尽必须产生确定诊断，不能删除类型成员或扩大为 `unknown`。

## Binder 当前方案

独立包 `@nxts/binder`。Checker 通过 `import` 消费其结果，不把 binder 做进 `@nxts/checker` 内部目录。

公开入口：

| 入口             | 输入                                                            | 输出                                                             |
| ---------------- | --------------------------------------------------------------- | ---------------------------------------------------------------- |
| `bindFile`       | `ParseFileResult`，可选 `BindEnv`                               | 单文件作用域、符号、`imports` / `exports`、诊断；`resolved` 为空 |
| `bindProgram`    | 各文件 parse 结果、host 提供的 `ModuleEdge[]`、同一份 `BindEnv` | 各文件绑定、`links`、填好的 `file.resolved`、程序级诊断          |
| `ExportResolver` | 各文件 `exports` 与 `edges`                                     | `fileIdOf`、`resolve`、`resolveAll`                              |

`BindEnv` 默认空。名单和 `builtinId` 编码由 T49 / 标准库 / host 传入，binder 不定白名单。

### 职责

Binder 负责：

- 词法作用域和符号表。ScopeId、SymbolId 按文件从 0 分配，不跨文件合并。
- 一节点多符号：`nodeToSymbols: SymbolId[]`，下标对齐 parser `nodes[]`。
- 名称空间：`value`、`type`、`label`。class / enum 双空间；函数、`const` / `let` 只在 value；interface / type alias 只在 type。
- 遮蔽、同空间重复声明、未解析名称。
- 函数、类、接口、类型别名提升；`const` / `let` 不提升。
- import 本地占坑；`import type` 进 type 空间。
- 文件出口表 `file.exports`（语法边，含 `export *`）。
- 导出名展开：`file.resolved` 物化 `ExportResolver.resolve`，供 checker 查表，不再每次走 `export *`。
- import 到出口的 `ModuleLink`；命名再导出缺失或歧义时诊断。
- 可选 `BindEnv`：先开 `global` 再开 `module`。环境符号 `declNodeId: null`，带 `builtinId`。checker 按 `builtinId` 认 intrinsic，不按 `declNodeId === null`，不按标识符文本。

Binder 不负责：

- 类型兼容、推导、重载适用性。
- 磁盘路径、`fileId` 分配、模块依赖图和初始化顺序（host / T55）。
- 副作用 `import './x'` 的本地行（无绑定）；依赖边由 host 扫 AST specifier。
- `typeof import()` / `import('./m').Foo` 的模块类型计算（无本地名；checker + `resolved`）。
- 类/对象成员的词法符号（成员不是作用域名，归 T51）。
- `this` / `super` 类型（T56）。
- 闭包逃逸、别名副作用和调用后收窄失效（T58）。
- 对象布局、GC、ABI、LLVM 或后端优化。

### 侧表

```text
NodeId     -> SymbolId[]     // nodeToSymbols
ScopeId    -> ScopeRecord    // parent / kind
SymbolId   -> SymbolRecord   // name, space, scopeId, declNodeId, builtinId
```

环境符号没有用户 AST 声明节点。引用位置记在使用处的 `nodeToSymbols[NodeId]`。

`file.exports` 与 `file.resolved` 不是同一张表：前者是本文件写出的出口边；后者是展开 `export *` 之后对外可见的名字。

### 诊断

| messageId                 | code    |
| ------------------------- | ------- |
| `binder.unresolved`       | NXT2101 |
| `binder.duplicate`        | NXT2102 |
| `binder.unresolvedExport` | NXT2103 |
| `binder.ambiguousExport`  | NXT2104 |

## Checker 剩余能力

Checker 不是只缺少四篇前端文档。当前还有 12 项语言能力需要讨论或实现，可能同时写入类型、语义、模块和前端目录。

| 能力                       | 状态                                      | 主要目标文档                                                                                         |
| -------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| T57 名称、作用域与声明绑定 | 实现已落地；`4-nameBinding.md` 文档待建立 | `docs/compiler/frontend/4-nameBinding.md`                                                            |
| Checker 语义模型           | 部分定稿                                  | `docs/compiler/frontend/5-checkerSemanticModel.md`                                                   |
| 常量求值                   | 部分定稿                                  | `docs/compiler/frontend/6-constantEvaluation.md`                                                     |
| T58 闭包、捕获与副作用     | 待讨论                                    | `docs/language/semantics/15-closureSemantics.md`、`docs/compiler/frontend/7-effectAnalysis.md`       |
| T61 同步异常               | 待讨论                                    | `docs/language/semantics/16-exceptionSemantics.md`                                                   |
| T59 异步与 Promise         | 待讨论                                    | `docs/language/types/35-asyncTypes.md`、`docs/language/semantics/17-asyncSemantics.md`               |
| T60 迭代器与生成器         | 待讨论                                    | `docs/language/types/36-iteratorTypes.md`、`docs/language/semantics/18-iteratorSemantics.md`         |
| T50 运算符                 | 待讨论                                    | `docs/language/types/29-expressionTypes.md`、`docs/language/semantics/19-expressionSemantics.md`     |
| T51 成员与索引访问         | 待讨论                                    | `docs/language/types/30-accessTypes.md`、`docs/language/semantics/20-accessSemantics.md`             |
| T52 赋值、解构与展开       | 待讨论                                    | `docs/language/types/31-assignmentTypes.md`、`docs/language/semantics/21-assignmentSemantics.md`     |
| T53 调用与构造             | 待讨论                                    | `docs/language/types/32-callTypes.md`、`docs/language/semantics/22-callSemantics.md`                 |
| T54 语句检查               | 待讨论                                    | `docs/language/types/33-statementTypes.md`、`docs/language/semantics/23-statementSemantics.md`       |
| T55 模块边界               | 讨论中                                    | `docs/language/modules/1-moduleTypes.md`                                                             |
| T56 `this` 与 `super`      | 待讨论                                    | `docs/language/types/34-thisAndSuperTypes.md`、`docs/language/semantics/24-thisAndSuperSemantics.md` |

表中“12 项语言能力”指 T50 至 T61。Checker 语义模型与常量求值是实现契约，不是额外语言能力编号。

`docs/architecture/index.md` 中 T57 仍标「待讨论」，与 binder 实现不一致，状态更新待确认。

## 推荐讨论顺序

```text
按 packages/nxts-binder 实现写 4-nameBinding.md
  -> Checker 核心语义模型（消费 bindProgram 结果）
  -> T58 闭包与副作用
  -> T61 同步异常
  -> T59 异步与 Promise
  -> T60 迭代器与生成器
  -> T50 至 T56 表达式、语句和模块入口
  -> 常量求值收口
  -> Binder/Checker 一致性测试
```

不要重新讨论 ScopeId / SymbolId 分配范围或名称空间模型。T61 必须先于 T59。T60 的异步迭代部分依赖 T59。

如果目标只是先实现同步基础 Checker，可以让尚未形成闭环的异常、异步、生成器等语法返回明确能力诊断。完整 Checker 必须最终覆盖 T50 至 T61，不能让未检查节点进入 HIR。

## 已有部分定稿内容

### `5-checkerSemanticModel.md`

已经确定：

- 使用驻留 TypeId、稳定规范键和关系缓存。
- 联合、交叉、接口、递归类型、元组和泛型实例图的有界算法。
- 官方编译器至少支持 65535 个简单平坦联合成员和简单键成员。
- 元组不设置 1024 等较小语言级成员上限。
- 重载实现体使用控制流活动重载集合验证返回路径。
- 泛型闭合实例按声明身份和规范实参驻留。
- 方差通过有限方向图和强连通分量求解。
- 类型级计算使用确定预算，耗尽时不能退化为动态类型。

仍需纳入：

- 规范类型节点定义。
- TypeId 数据结构；与 binder 已落地的每文件 SymbolId / ScopeId 如何对接。
- 类型关系与查询 API。
- NodeId 语义侧表。
- ErrorType、错误符号和分析不完整状态。
- Checker 公开结果与 Checked HIR 所需事实。

### `6-constantEvaluation.md`

已经确定：

- 编译器内部可以使用任意精度整数。
- 任意精度整数不能成为 Nxts 类型、运行时值或 HIR 值。
- 常量结果提交前必须验证目标数值类型范围。
- 支持与 runtime 语义一致的字符串常量折叠。
- 常量折叠不能跨越副作用或可能抛错的动态表达式。

仍需纳入：

- 枚举初始化器。
- 字面量算术。
- 字符串与模板常量。
- 跨模块常量引用。
- 求值步数、位数、深度、缓存和诊断预算。

## T55 模块现状

`docs/language/modules/1-moduleTypes.md` 当前处于讨论中，已确定：

- 仅支持 ES Module，不支持 CommonJS。
- 正式扩展名为 `.ntx`，开发者工具完善前兼容 `.ts` 输入。
- 当前只支持相对模块路径。
- 静态 import/export 和 type-only import/export 被支持。
- 导入是只读 live binding。
- `import()`、顶层 `await` 和 import attributes 由 Parser 接受，但相关运行时能力未闭合时由 Checker 产生能力诊断。

仍待确定：

- `.ts` 兼容输入的移除条件。
- 其他扩展名状态。
- import attributes 的资源加载语义。
- `import()` 与顶层 `await` 的最终语义。

职责边界（按当前实现）：

| 工作                                                      | 承担方                             |
| --------------------------------------------------------- | ---------------------------------- |
| 路径解析、`fileId`、`{ fromFileId, specifier, toFileId }` | host / compiler                    |
| 本文件 import / export 语法表                             | `bindFile`                         |
| 导出名解析、`export *` 展开、歧义                         | `ExportResolver` / `file.resolved` |
| import 到对方出口的链接                                   | `bindProgram` 的 `links`           |
| 模块初始化顺序、依赖图 DFS                                | T55 / compiler，尚未实现           |
| 跨模块类型                                                | checker                            |

旧结论「T57 只做本文件 import 占坑，导出图全部归 T55」与实现不一致。导出名解析在 binder；路径和初始化仍归 T55。

## T57 已确认与待确认

写 `4-nameBinding.md` 时按实现收录已确认项，不要重新表决。

### 已确认

| 主题         | 当前方案                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------- |
| 身份         | ScopeId、SymbolId 每文件分配；`nodeToSymbols[NodeId] = SymbolId[]`                       |
| 作用域       | `global`、`module`、`function`、`block`、`class`、`typeParams`、`catch`、`label`、`enum` |
| 名称空间     | `value` / `type` / `label`；class、enum 双空间                                           |
| 声明时序     | function / class / interface / type / enum 提升；`const` / `let` 不提升                  |
| 遮蔽         | 内层同名合法，引用取最近作用域；同空间同作用域重复为 `binder.duplicate`                  |
| 重复声明     | 不支持 TypeScript 声明合并                                                               |
| 递归 / 前向  | 提升使类型名和函数名可被后面或前面的引用绑到                                             |
| 泛型         | 类型参数在 `typeParams` 作用域，约束和默认值在该作用域内解析                             |
| 类           | 只绑类名（双空间）、方法体内的词法名和类型参数；成员名不是词法符号                       |
| 模块         | import 本地坑；跨文件用 `edges` + `resolve` / `links` / `resolved`                       |
| 标准环境入口 | `BindEnv` + `builtinId`；checker 按 `builtinId` 认 intrinsic                             |
| 错误隔离     | 跳过 `invalidNodes`，不为拒绝子树建符号                                                  |
| 性能         | 侧表为数组和下标 ID，诊断不在热路径拼用户文案                                            |

### 待确认

| 主题               | 内容                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------- |
| 标准环境名单       | 有哪些根符号、`builtinId` 编码；等 T49 / 标准库。`undefined` 规范要求走标准环境           |
| 错误符号           | 非法声明是否占位，以避免级联 `unresolved`                                                 |
| 捕获候选           | binder 是否另出跨函数自由变量表给 T58                                                     |
| TDZ                | `const` / `let` / class / live binding 的读取边界；属语义 / checker，不是再做一套词法查找 |
| 重载组             | binder 是否把同名函数声明收成组，或留给 checker                                           |
| `4-nameBinding.md` | 规范正文尚未创建                                                                          |

T57 规范不应决定类型兼容、闭包运行时表示、模块路径解析或 LLVM lowering。

## 协作与文档要求

- 每次从真实仓库、索引和已定稿文档核对事实，不凭记忆重述规则。
- 有明显方案取舍时，说明性能、使用负担、TS/JS 兼容性和实现复杂度。
- 用户熟悉 JavaScript/TypeScript，但不了解 LLVM；涉及 LLVM 时增加一个简短解释点。
- 一次讨论一个明确问题，获得结论后继续下一项。
- 整份规范定稿后写入对应文件并更新同级 `index.md`。
- 文档正文只保留规范、原因、影响和待确认项，不记录对话或协作过程。
- 不在每次文档修改后运行格式化；用户会统一处理格式。
- 修改后执行结构检查、链接或引用核对，并明确说明未验证项。
- 除非明确要求，不修改 `packages/nxts-parser` 或为对齐文档改动已通过测试的 binder 行为。

## 接手后的第一步

1. 阅读根目录 `AGENTS.md`。
2. 阅读 `docs/architecture/index.md` 和 `docs/compiler/frontend/index.md`。
3. 阅读 `packages/nxts-binder/src/types.ts`、`bindFile.ts`、`bindProgram.ts`、`exportResolver.ts`。
4. 按实现起草 `docs/compiler/frontend/4-nameBinding.md`，待确认项保持「待确认」。
5. 阅读 `docs/language/types/index.md` 和 `docs/compiler/frontend/5-checkerSemanticModel.md`。
6. 开始 Checker：消费 `bindProgram` 的 `files`、`links`、`file.resolved` 和 `builtinId`，不重新走 `export *`，不按标识符文本认 intrinsic。
