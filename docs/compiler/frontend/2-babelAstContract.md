# Babel AST 契约

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：2

## 目标与边界

本规范定义 `@nxts/parser` 如何调用 Babel Parser、哪些 Babel AST 与源码位置可以进入后续阶段，以及 NodeId、节点遍历和 AST 稳定性的前端契约。

前端阶段顺序由[前端流水线](./1-frontendPipeline.md)定义，Nxts 接受或拒绝的语法由[语法子集](../../language/syntax/1-syntaxSubset.md)定义。本规范不根据 Babel 能否解析来扩大语言范围，也不定义名称绑定或类型结果。

## 依赖基线

当前工具链使用：

| 依赖            | 基线版本 | 用途                                     |
| --------------- | -------- | ---------------------------------------- |
| `@babel/parser` | `8.0.4`  | 将完整源码解析为 `ParseResult<File>`。   |
| `@babel/types`  | `8.0.4`  | 提供 Babel `Node`、`File` 和访问键类型。 |

Babel Parser 与 Babel Types 必须使用兼容版本。解析器版本、影响 AST 形状的选项和 Nxts 语法规范版本共同构成前端缓存身份；升级 Babel 后必须重新运行前端一致性测试，不能直接复用旧 AST 缓存。

## 输入与根节点

- 正式输入是已经解码为 JavaScript UTF-16 字符串的完整 `.ntx` 或 `.ts` 源文件。
- 编译入口调用 `parse(source, options)` 并要求根节点为 Babel `File`，不使用 `parseExpression` 代替完整文件解析。
- 所有文件按 ES Module 和严格模式解析，不根据源码内容猜测 `script`、CommonJS 或 module。
- 编译器不接受调用方提供的任意第三方 AST 作为可信编译输入；工具必须通过 Nxts Parser 使用同一配置解析源码。
- 文件身份、源码解码、内容版本和行映射由规划文档 `3-sourceAndDiagnostics.md` 定义。

## 固定解析模式

以下配置由 Nxts 工具链控制，不能改变语言接受范围：

| 配置                                       | 方案                           | 原因                                           |
| ------------------------------------------ | ------------------------------ | ---------------------------------------------- |
| `sourceType`                               | `"module"`                     | 所有 Nxts 文件都是 ES Module。                 |
| `strictMode`                               | `true`                         | 与 Nxts 的 JavaScript strict 兼容目标一致。    |
| `plugins`                                  | TypeScript，不启用 Flow 或 JSX | `.ntx`、`.ts` 使用 TypeScript 语法且拒绝 TSX。 |
| TypeScript `dts`                           | `false`                        | 普通源码不启用声明文件解析模式。               |
| TypeScript `disallowAmbiguousJSXLike`      | `false`                        | 按 `.ts` 而不是 `.mts` 规则解析歧义语法。      |
| `errorRecovery`                            | `true`                         | 支持无效子树隔离和多诊断恢复。                 |
| `locations`                                | `true`                         | 为诊断和源码映射保留节点位置。                 |
| `ranges`                                   | `true`                         | 保留节点半开区间，供诊断和工具直接消费。       |
| `tokens`                                   | `true`                         | 保留完整 token 流，避免后续工具重新分词。      |
| `attachComment`                            | `true`                         | 保留注释总表及节点注释关联。                   |
| `createParenthesizedExpressions`           | `true`                         | 使用显式括号节点保留分组层级。                 |
| `createImportExpressions`                  | `true`                         | 使用独立 `ImportExpression` 节点。             |
| `allowImportExportEverywhere`              | `false`                        | import/export 只允许模块顶层。                 |
| `allowAwaitOutsideFunction`                | `false`                        | 不扩大 `await` 的语法位置。                    |
| `allowReturnOutsideFunction`               | `false`                        | 保持函数与模块控制流边界。                     |
| `allowNewTargetOutsideFunction`            | `false`                        | 不扩大 JavaScript 语法位置。                   |
| `allowSuperOutsideMethod`                  | `false`                        | `super` 位置由类语法和 T56 约束。              |
| `allowYieldOutsideFunction`                | `false`                        | `yield` 只允许生成器语法位置。                 |
| `annexB`                                   | `false`                        | 不接受 strict module 之外的 Annex B 扩展。     |
| `allowUndeclaredExports`                   | `true`                         | 导出名称是否存在由 Binder 统一诊断。           |
| `sourceFilename`                           | 规范文件标识                   | 关联诊断、缓存和源码映射。                     |
| `startIndex` / `startLine` / `startColumn` | `0` / `1` / `0`                | 所有源码单元使用统一位置基准。                 |

顶层 `await`、动态 `import()`、装饰器或其他 Babel 可解析语法仍由 Nxts 语法验证器决定接受或拒绝。Parser 选项不能替代语言能力检查。

### 配置封装

Parser 公开 API 不接受 Babel `plugins`、`sourceType`、严格模式、恢复模式或 AST 形状选项。调用方只能传入 Nxts 定义的源码、文件身份和诊断相关参数。

新增语言能力需要同时更新 Nxts 语法规范、固定 Parser 配置和一致性测试，不能由项目自行启用 Babel plugin。Parser 配置身份由工具链生成并参与缓存键，调用方不能伪造。

## AST 保留原则

- Babel AST 是前端唯一源码结构，不复制为另一套 Nxts AST。
- 保留 Babel 产生的完整 token 流、注释总表、节点注释关联、源码范围和位置信息。
- 每一层源码括号保留为独立 `ParenthesizedExpression`，checker 通过统一辅助入口读取去括号后的语义表达式。
- Parser、Validator 和 Checker 不得原地替换、删除或重排 Babel 节点。
- 语法拒绝、名称绑定、类型、常量值和控制流结果全部存储在 NodeId 侧表。
- Checked HIR 可以规范化表达式和控制流，但不能反向修改 Babel AST。
- Babel `extra` 中没有进入本规范的字段不构成稳定语义契约；需要原始文本时优先按源码范围读取。

生产编译不要求递归冻结整棵 AST。包边界通过只读类型和代码约束禁止修改，测试或开发构建可以使用结构摘要检查意外变更。

## 源码位置契约

所有分配 NodeId 的 Babel 节点必须具有可信的起止偏移和位置：

| 信息          | 契约                                                    |
| ------------- | ------------------------------------------------------- |
| `start`/`end` | 相对于当前源码字符串的 UTF-16 半开区间 `[start, end)`。 |
| `range`       | 与 `start`、`end` 一致的半开区间二元数组。              |
| `loc.start`   | 1-based 行号、0-based 列号和对应源码索引。              |
| `loc.end`     | 节点结束位置，不包含 `end` 指向的 code unit。           |
| 文件名        | 来自规范文件身份，不直接信任用户传入的显示路径。        |

缺少位置、范围越界、父节点不包含子节点或节点跨越其他文件属于 AST 契约错误。恢复节点无法提供可信范围时不分配正常 NodeId，并按诊断规范隔离。

## NodeId 分配

NodeId 覆盖进入 Validator、Binder 或 Checker 的所有 Babel `Node`，不覆盖 comment、token、源码位置对象或 Parser error。

所有结构有效的 Babel Node 都必须分配 NodeId，包括 `File`、`Program`、声明、语句、表达式、标识符、字面量、TypeScript 类型节点、括号节点以及可恢复但被 Nxts 拒绝的节点。

使用确定性的源码前序遍历分配每文件局部连续整数：

1. 从 `File` 根节点开始。
2. 按 Babel 版本锁定的访问键顺序遍历直接子节点。
3. 先分配父节点，再按源码结构顺序分配子节点。
4. 不通过对象属性枚举顺序发现子节点。
5. 不为同一节点对象重复分配 NodeId。

访问键必须来自当前锁定的 Babel Types 版本。遇到没有访问键的未知 Node 类型时产生 AST 契约错误，不能通过枚举对象属性猜测其子节点。

前端维护从 NodeId 到 Babel Node 的紧凑表，以及从 Babel Node 对象到 NodeId 的反向查询。跨文件身份使用 `(FileId, NodeId)`；跨版本复用规则见前端流水线。

## Parser 错误

`ParseResult<File>.errors` 中的 Babel 错误必须转换为 Nxts 诊断，不把 Babel 错误对象直接作为公开 API。Babel 抛出且无法返回可信 `File` 时，该文件解析失败。

Parser 错误位置、错误码映射、重复诊断合并和恢复预算由 `3-sourceAndDiagnostics.md` 定义。语法验证器不得重复报告已经由同一 Parser 错误完整覆盖的问题。

## 输出契约

成功形成可恢复 AST 时，Parser 阶段至少输出：

- 规范文件身份与源码版本。
- Babel `File` 和锁定的 Parser 配置身份。
- NodeId 正向表与反向查询。
- 完整 token 流、注释总表和节点注释关联。
- Parser 错误和 AST 契约错误转换后的诊断。
- 无效源码范围与无法进入语义分析的节点集合。

输出不包含 SymbolId、TypeId、模块导出图、运行时布局或 Checked HIR。

## 性能约束

- 完整文件只调用一次 Babel `parse`。
- NodeId 分配与 AST 契约检查合并为一次遍历。
- token、comment 和位置元数据只保留 Babel 产生的一份，不建立重复副本。
- Checked HIR 构建完成且调用方未请求分析结果后，编译器可以释放整份源码 AST 及其元数据引用。
- 不通过 JSON 克隆或序列化 Babel AST。
- 侧表按每文件局部连续 NodeId 优先使用紧凑索引结构。

## 版本升级

Babel Parser 和 Babel Types 锁定精确兼容版本，不允许按 semver 范围自动升级。升级必须显式执行：

1. 同时升级 `@babel/parser` 与 `@babel/types`。
2. 运行 AST 快照、语法接受矩阵、错误恢复和 NodeId 一致性测试。
3. 人工检查节点形状、访问键、源码位置和诊断差异。
4. 更新 Parser 配置身份与 AST 契约版本。
5. 使旧 AST、NodeId、绑定、类型和 Checked HIR 缓存全部失效。

一致性测试通过是升级的必要条件，不代表可以跳过差异审查。Babel 的任何版本变化都不能在用户未重新编译时改变已有产物。
