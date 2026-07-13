# Nxts Binder 与 Checker 设计交接

- 交接日期：2026-07-29
- 目标读者：继续讨论并定稿 Binder、Checker 规范的 AI
- 当前工作重点：用户实现 Parser；接手 AI 继续 Binder 与 Checker 设计

## 当前现状

Parser 相关设计讨论已经完成，具备开始编码的条件。用户正在开始实现 `@nxts/parser`，接手 AI 不需要重新讨论或主动修改 Parser。

当前实现状态：

| 包                      | 状态                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `packages/nxts-parser`  | `src/index.ts` 仍为占位代码，用户准备开始实现               |
| `packages/nxts-checker` | `src/index.ts` 仍为占位代码，Binder 与 Checker 规范尚未补齐 |
| `packages/nxts-ir`      | 已有包骨架，IR 规范部分定稿，不是当前讨论重点               |

Parser 的详细一致性测试规范被明确拆为独立专项，状态为待讨论，但不阻塞 Parser 主体实现。质量目录已经规划：

- `docs/quality/1-parserConformance.md`
- `docs/quality/2-semanticConformance.md`

如果 Parser 实现暴露规范矛盾，应记录源码示例、Babel AST 和冲突文档位置，再讨论是否修正规范。不得为了降低实现成本自行改变已定稿语言行为。

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

同一规则只能有一个权威来源。接手 AI 在更新文档前应先阅读 `AGENTS.md` 和以下索引：

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

## Parser 已定稿契约

以下 Parser 规范已经定稿：

- `docs/compiler/frontend/1-frontendPipeline.md`
- `docs/compiler/frontend/2-babelAstContract.md`
- `docs/compiler/frontend/3-sourceAndDiagnostics.md`
- `docs/language/syntax/1-syntaxSubset.md`

Checker 必须消费这些既有契约：

### Babel AST 与 NodeId

- 使用 Babel 8.0.4 AST，不复制为第二套 Nxts AST。
- Parser、Validator、Binder 和 Checker 不得原地替换、删除、重排或扩展 Babel Node。
- Parser 通过固定 `VISITOR_KEYS` 前序遍历，为结构有效的节点分配每文件局部连续 NodeId。
- AST 节点、NodeId、SourceSpan、tokens 和 comments 由 Parser 结果提供。
- 绑定、类型、常量、控制流和副作用事实必须存储在 NodeId 侧表。
- SourceVersion 改变后不能继续复用旧 AST、NodeId 或语义侧表。

### 诊断边界

- 用户源码错误通过不可变结果返回结构化诊断，公开 API 不因预期用户错误抛异常。
- `NXT1xxx` 属于 Parser 与 Validator。
- `NXT2xxx` 属于 Binder、模块和名称解析。
- `NXT3xxx` 属于类型检查与类型关系。
- `NXT4xxx` 属于控制流、常量和副作用分析。
- 内部契约损坏可以进入异常通道，但 CLI 和 language service 必须在最外层捕获。
- 存在错误时可以保留部分 AST 和语义侧表，但不能生成可执行 Checked HIR。

### Parser 与 Checker 的能力边界

Parser 不按标识符文本识别标准内建能力。`eval`、`Function`、`Proxy`、`BigInt`、`String`、`Symbol` 和其他内建名称必须先由 Binder 解析符号身份，再由 Checker 决定是否合法。

以下语法可以由 Parser 接受，但当前需要 Binder 或 Checker 诊断：

| 语法                                 | 后续处理                                          |
| ------------------------------------ | ------------------------------------------------- |
| `import()`、顶层 `await`             | T55/T59 能力未形成闭环时产生能力诊断              |
| import attributes                    | T55 资源模块能力未形成闭环时产生能力诊断          |
| `satisfies`                          | Checker 产生不支持诊断                            |
| 普通 `as Type`                       | Checker 区分 `as const`、品牌候选与非法普通断言   |
| `new String(...)`、`new Symbol(...)` | Binder/Checker 按标准符号身份产生不可构造诊断     |
| 普通函数用于 `new`                   | Checker 根据静态类型产生不可构造诊断              |
| `call`、`apply`、`bind`              | Parser 保留成员访问，Checker 根据函数类型能力诊断 |
| `RegExpLiteral`、`debugger`          | 能力未定义时由后续阶段诊断                        |

Parser 已拒绝的语法不能再次进入正常 Binder/Checker 路径，例如 `var`、`any`、bigint 字面量、宽 `object` 类型、`==`、`!=`、运行时位运算、非空断言、JS `#private`、装饰器和 CommonJS 语法。

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

## Binder 架构决定

Binder 阶段必须存在，但不建立独立的 `@nxts/binder` npm 包。现有包职责已经确定为：

```text
@nxts/checker
  src/binder/
  src/types/
  src/flow/
  src/constants/
  src/effects/
```

Binder 是 `@nxts/checker` 内部独立阶段。它负责：

- 建立词法作用域和符号表。
- 为声明分配 SymbolId。
- 把标识符、类型引用和导入本地名称绑定到 SymbolId。
- 区分类型空间、值空间和其他必要名称空间。
- 处理遮蔽、重复声明、前向类型引用和递归声明。
- 形成重载声明组。
- 产生未声明名称、重复声明和非法绑定诊断。
- 为闭包分析记录引用外层声明的候选事实。

Binder 不负责：

- 类型兼容、推导和重载适用性。
- 模块路径解析、导出图和跨模块可见性规则。
- 闭包逃逸、别名副作用和调用后收窄失效。
- 对象布局、GC、ABI、LLVM 或后端优化。

建议的核心侧表形态是：

```text
NodeId   -> SymbolId
ScopeId  -> declarations/references
SymbolId -> declaration NodeId
```

具体结构、ID 生命周期和公开查询 API 尚未定稿，应在 T57 中确定。

## Checker 剩余能力

Checker 不是只缺少四篇前端文档。当前还有 12 项语言能力需要讨论，可能同时写入类型、语义、模块和前端目录。

| 能力                       | 状态     | 主要目标文档                                                                                         |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| T57 名称、作用域与声明绑定 | 待讨论   | `docs/compiler/frontend/4-nameBinding.md`                                                            |
| Checker 语义模型           | 部分定稿 | `docs/compiler/frontend/5-checkerSemanticModel.md`                                                   |
| 常量求值                   | 部分定稿 | `docs/compiler/frontend/6-constantEvaluation.md`                                                     |
| T58 闭包、捕获与副作用     | 待讨论   | `docs/language/semantics/15-closureSemantics.md`、`docs/compiler/frontend/7-effectAnalysis.md`       |
| T61 同步异常               | 待讨论   | `docs/language/semantics/16-exceptionSemantics.md`                                                   |
| T59 异步与 Promise         | 待讨论   | `docs/language/types/35-asyncTypes.md`、`docs/language/semantics/17-asyncSemantics.md`               |
| T60 迭代器与生成器         | 待讨论   | `docs/language/types/36-iteratorTypes.md`、`docs/language/semantics/18-iteratorSemantics.md`         |
| T50 运算符                 | 待讨论   | `docs/language/types/29-expressionTypes.md`、`docs/language/semantics/19-expressionSemantics.md`     |
| T51 成员与索引访问         | 待讨论   | `docs/language/types/30-accessTypes.md`、`docs/language/semantics/20-accessSemantics.md`             |
| T52 赋值、解构与展开       | 待讨论   | `docs/language/types/31-assignmentTypes.md`、`docs/language/semantics/21-assignmentSemantics.md`     |
| T53 调用与构造             | 待讨论   | `docs/language/types/32-callTypes.md`、`docs/language/semantics/22-callSemantics.md`                 |
| T54 语句检查               | 待讨论   | `docs/language/types/33-statementTypes.md`、`docs/language/semantics/23-statementSemantics.md`       |
| T55 模块边界               | 讨论中   | `docs/language/modules/1-moduleTypes.md`                                                             |
| T56 `this` 与 `super`      | 待讨论   | `docs/language/types/34-thisAndSuperTypes.md`、`docs/language/semantics/24-thisAndSuperSemantics.md` |

表中“12 项语言能力”指 T50 至 T61。Checker 语义模型与常量求值是实现契约，不是额外语言能力编号。

## 推荐讨论顺序

依赖顺序已经记录在 `docs/architecture/index.md`。继续讨论时采用：

```text
T57 名称绑定
  -> Checker 核心语义模型
  -> T58 闭包与副作用
  -> T61 同步异常
  -> T59 异步与 Promise
  -> T60 迭代器与生成器
  -> T50 至 T56 表达式、语句和模块入口
  -> 常量求值收口
  -> Binder/Checker 一致性测试
```

T61 必须先于 T59，因为异步函数需要定义同步异常如何转为 Promise rejection。T60 的异步迭代部分依赖 T59。

如果目标只是先实现同步基础 Checker，可以让尚未形成闭环的异常、异步、生成器等语法返回明确能力诊断。但完整 Checker 必须最终覆盖 T50 至 T61，不能让未检查节点进入 HIR。

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
- TypeId、SymbolId、ScopeId 的数据结构和生命周期。
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

T57 只负责导入声明在当前文件中的本地符号绑定。模块解析、导出图、重新导出和跨模块可见性归 T55。

## T57 下一步讨论清单

接手 AI 应从 `docs/compiler/frontend/4-nameBinding.md` 开始，并逐项与用户确认：

| 主题       | 必须确定的问题                                                        |
| ---------- | --------------------------------------------------------------------- |
| 身份       | ScopeId、SymbolId 是否每程序或每文件分配，如何与 NodeId 关联          |
| 作用域种类 | 模块、函数、参数、代码块、类、类型参数、catch 和标签作用域            |
| 名称空间   | 值空间、类型空间、标签空间以及类和枚举的双空间身份                    |
| 声明时序   | 函数声明、类、接口、类型别名、`const`、`let` 和重载签名何时进入作用域 |
| TDZ        | `const`、`let`、class 和模块 live binding 的读取边界                  |
| 遮蔽       | 哪些内外层同名合法，哪些产生诊断或提示                                |
| 重复声明   | 不支持 TypeScript 声明合并时的统一诊断和重载例外                      |
| 递归       | 类型前向引用、互相递归、递归函数和类自引用的预声明方式                |
| 泛型       | 类型参数作用域、约束、默认值和遮蔽                                    |
| 类         | 实例侧、静态侧、成员名、构造器、`this` 与 `super` 的绑定入口          |
| 模块       | import 本地绑定、type-only 绑定及与 T55 的职责边界                    |
| 标准环境   | 内建类型和值如何进入根环境，如何按符号身份识别 intrinsic              |
| 错误恢复   | 错误符号、未绑定引用、重复诊断抑制和无效声明隔离                      |
| 捕获候选   | Binder 提供哪些跨函数引用事实给 T58                                   |
| 性能       | 接近 O(AST 节点数)，使用紧凑 ID 和数组侧表，不在热路径构造文案        |

T57 不应提前决定类型兼容、闭包运行时表示、模块路径解析或 LLVM lowering。

## 协作与文档要求

- 每次从真实仓库、索引和已定稿文档核对事实，不凭记忆重述规则。
- 有明显方案取舍时，向用户说明性能、使用负担、TS/JS 兼容性和实现复杂度。
- 用户熟悉 JavaScript/TypeScript，但不了解 LLVM；涉及 LLVM 时增加一个简短解释点。
- 一次讨论一个明确问题，获得结论后继续下一项。
- 整份规范定稿后写入对应文件并更新同级 `index.md`。
- 文档正文只保留规范、原因、影响和待确认项，不记录对话或协作过程。
- 不在每次文档修改后运行格式化；用户会统一处理格式。
- 修改后执行结构检查、链接或引用核对，并明确说明未验证项。
- Parser 代码由用户当前实现，除非用户明确要求，否则接手 AI 不修改 `packages/nxts-parser`。

## 接手后的第一步

1. 阅读根目录 `AGENTS.md`。
2. 阅读 `docs/architecture/index.md`。
3. 阅读四份已定稿 Parser 规范。
4. 阅读 `docs/language/types/index.md` 和 `docs/compiler/frontend/5-checkerSemanticModel.md`。
5. 不重新讨论 Parser，直接开始 T57。
6. T57 的第一个建议议题是 ScopeId、SymbolId 的分配范围及名称空间模型。
