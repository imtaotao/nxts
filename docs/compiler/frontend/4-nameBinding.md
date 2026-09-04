# 名称绑定

- 任务编号：T57
- 规范状态：已定稿
- 实现状态：已实现
- 最后更新：2026-09-02
- 文档顺序：4

## 目标与边界

本规范定义 `@nxts/binder` 如何从已验证的 Babel AST 建立词法作用域、符号、声明与引用绑定，以及如何在调用方提供的模块边上展开导出名并链接 import。

语言接受范围由 [`language/syntax`](../../language/syntax/index.md) 定义。模块路径、`fileId`、依赖图和初始化顺序由 [`language/modules/1-moduleTypes.md`](../../language/modules/1-moduleTypes.md)（T55）定义。类型关系、收窄、`this` / `super`、成员访问和闭包副作用分别由类型规范、T56、T51 与 T58 定义。

本规范不新增或放宽语法，不检查类型，不解析磁盘路径。

## 核心约束

- 原始 AST 保持结构稳定；绑定事实只写 NodeId 侧表，不改写 Babel 节点。
- ScopeId 与 SymbolId 按文件从 `0` 连续分配，不跨文件合并。跨文件关系使用 `ModuleLink` 或 `file.resolved`。
- 一个 NodeId 可对应多个符号，按名称空间区分。
- 标准环境由调用方传入 `BindEnv`。Checker 按 `builtinId` 识别 intrinsic，不按标识符文本，不按 `declNodeId === null`。
- `file.resolved` 在 `bindProgram` 时物化。Checker 查表，不再次走 `export *`。
- `var`、显式 `declare` 和环境扩充由语法验证拒绝；binder 不为其建立有效符号。

## 公开入口

| 入口             | 输入                                             | 输出                                                             | 不负责                   |
| ---------------- | ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------ |
| `bindFile`       | `ParseFileResult`，可选 `BindEnv`                | 单文件作用域、符号、`imports` / `exports`、诊断；`resolved` 为空 | 路径解析、跨文件链接     |
| `bindProgram`    | 各文件解析结果、`ModuleEdge[]`、同一份 `BindEnv` | 各文件绑定、`links`、填好的 `file.resolved`、再导出诊断          | 类型兼容、模块初始化顺序 |
| `ExportResolver` | 各文件 `exports` 与模块边                        | `fileIdOf`、`resolve`、`resolveAll`                              | 词法声明、类型检查       |

`BindEnv` 默认 `{ symbols: [] }`。`bindProgram` 对每个文件调用同一份环境的 `bindFile`，再解析出口并写 `links`。

无 AST 的解析结果仍返回空侧表，不抛异常。

## 侧表与身份

```text
NodeId     -> SymbolId[]
ScopeId    -> ScopeRecord
SymbolId   -> SymbolRecord
```

| 记录            | 字段                                                  | 当前方案                                                                  |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `ScopeRecord`   | `id`、`kind`、`parent`                                | `parent` 为外层 ScopeId；模块根在无环境时为 `null`，有环境时指向 `global` |
| `SymbolRecord`  | `name`、`space`、`scopeId`、`declNodeId`、`builtinId` | 用户声明 `builtinId` 为 `null`；环境符号 `declNodeId` 为 `null`           |
| `nodeToSymbols` | `SymbolId[]`                                          | 下标对齐 parser `nodes[]`；无绑定为空数组                                 |
| `nodes`         | 与 parseFile 同一份节点                               | checker 走 AST，不重解析                                                  |
| `nodeIds`       | Node → NodeId                                         | 与 parseFile 同一份                                                       |

引用位置记在使用处 Identifier 的 `nodeToSymbols`。环境符号没有用户 AST 声明节点。

跨文件身份：

| 关系                      | 当前方案                                                   |
| ------------------------- | ---------------------------------------------------------- |
| 命名 / 默认导入           | `{ fromFileId, importSymbolId, toFileId, exportSymbolId }` |
| `import *`、`export * as` | 同上，`exportSymbolId` 为 `null`                           |
| 展开后的公开名            | `file.resolved` 的 `found` / `namespace` / `ambiguous`     |

## 名称空间

名称空间是 `value`、`type`、`label`。查找、重复和遮蔽都在同一空间内进行。

| 声明                                              | 空间                          |
| ------------------------------------------------- | ----------------------------- |
| `const` / `let`、函数、参数、catch 绑定、枚举成员 | `value`                       |
| 接口、类型别名、类型参数、映射类型键              | `type`                        |
| 类、枚举名                                        | `value` 与 `type`             |
| `import` / `import type`                          | `value` 或 `type`，见模块进口 |
| 标签语句                                          | `label`                       |

不支持 TypeScript 声明合并。类与枚举的双空间是同一声明节点上的两个符号，不是合并后的第三种空间。

## 作用域

| `ScopeKind`  | 打开时机                                                          |
| ------------ | ----------------------------------------------------------------- |
| `global`     | `BindEnv.symbols` 非空时，先于模块作用域                          |
| `module`     | 每个有 AST 的文件                                                 |
| `function`   | 函数声明、函数表达式、箭头函数、方法                              |
| `block`      | 块语句、`switch` 整体、`for` / `for-in` / `for-of` 的变量声明包装 |
| `class`      | 类声明与类表达式                                                  |
| `typeParams` | 类型参数列表；映射类型的键                                        |
| `infer`      | 条件类型的 `extends` 右侧与真分支                                 |
| `catch`      | 带绑定的 `catch`                                                  |
| `enum`       | 枚举体                                                            |
| `label`      | 类型预留；当前不打开独立标签作用域                                |

标签占用所在作用域的 `label` 空间。`switch` 的全部 `case` 共用一个 `block`。带初始化变量的 `for` 把头和循环体放进同一包装块。静态块在类（及类型参数）作用域内绑定，不另开函数作用域。

## 声明、提升与遮蔽

同一语句列表按以下顺序处理：

1. 提升 `import` 本地名。
2. 提升函数声明的 `value` 名。
3. 提升类型别名、接口、枚举的 `type` 名。
4. 提升类声明的 `value` 与 `type` 名。
5. 按源码顺序绑定各语句。
6. 解析无 `from` 的本地 `export { name }`。

| 场景               | 当前方案                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- |
| 函数声明           | 名称提升到所在作用域；函数体在新的 `function` 作用域绑定，不再次声明该名称             |
| 函数表达式         | 名称（若有）声明在函数作用域内                                                         |
| 类声明             | 双空间名称提升到所在作用域；类体在 `class` 作用域绑定                                  |
| 类表达式           | 双空间名称声明在类作用域内                                                             |
| 接口 / 类型别名    | `type` 名提升；体在类型参数作用域内解析                                                |
| 枚举               | `type` 名提升；走进声明时补 `value` 名，成员只在 `enum` 作用域                         |
| `const` / `let`    | 不提升；在声明点写入 `value` 空间                                                      |
| 类型参数           | 先全部声明，再解析约束和默认值，因此参数之间可以互相引用                               |
| `infer`            | 在 `infer` 作用域声明 type 名，只包住 `extends` 与真分支。同一条件里同名复用，不报重复 |
| 内层同名           | 合法遮蔽；引用取最近作用域                                                             |
| 同作用域同空间重复 | `binder.duplicate`；名称表保留首次声明。重复节点仍有独立符号记录，但不参与后续查找     |
| 环境同名重复       | 忽略后写项，不诊断                                                                     |

`const` / `let` 在声明点之前不可见，包括已提升函数体中的前向引用。暂时性死区的运行时读取由 checker / 语义检查，不另做一套词法查找。

类成员、对象成员和接口成员不是词法名称，不为方法名或字段名调用 `declare`。计算属性的键作为值表达式解析。`this`、`super` 不是 Identifier，不进入符号表。

## 引用解析

从当前作用域沿 `parent` 向外查找同一名称空间。命中则写入使用处 `nodeToSymbols`；否则 `binder.unresolved`。

| 位置                                   | 空间                              |
| -------------------------------------- | --------------------------------- |
| 普通 Identifier 表达式                 | `value`                           |
| `TSTypeReference` 与接口 / 类 heritage | `type`                            |
| `typeof` 类型查询                      | `value`                           |
| 限定名 `A.B`                           | 只解析最左 Identifier；右侧归 T51 |
| `break` / `continue` 标签              | `label`                           |

不解析的名称：

| 语法                                    | 当前方案                                                    |
| --------------------------------------- | ----------------------------------------------------------- |
| 副作用 `import './x'`                   | 无本地名，不写 `imports`                                    |
| `typeof import("...")` / `TSImportType` | 无本地名，不走进类型节点                                    |
| `infer` 推断名                          | 在条件类型的 `infer` 作用域建 type 符号；假分支与外层不可见 |
| 成员访问的非计算属性名                  | 不作为词法名                                                |

`typeof import()` 的模块类型由 checker 用说明符和目标文件的 `resolved` 计算。

## 标准环境

`BindEnv` 是 `{ name, space, builtinId }[]`。名单和 `builtinId` 编码由 T49 / 标准库 / host 传入，binder 不定白名单。

| 条件     | 当前方案                                       |
| -------- | ---------------------------------------------- |
| 环境为空 | 不打开 `global`；模块作用域 `parent` 为 `null` |
| 环境非空 | 先 `global` 再 `module`；环境符号进入 `global` |
| 本地同名 | 遮蔽环境符号；本地符号 `builtinId` 为 `null`   |

空环境时，源码中的 `Array`、`Partial` 等名称按未解析处理。`undefined` 是否进入环境由 T49 决定。

## 模块出口、展开与链接

调用方提供 `{ fromFileId, specifier, toFileId }`。边的 `specifier` 必须与 AST 中的模块说明符文本一致。binder 不解析 `.` / `..`、扩展名或磁盘路径。

### 出口边与展开表

`file.exports` 是本文件写出的语法边。`file.resolved` 是展开 `export *` 之后对外可见的名字。`bindFile` 的 `resolved` 为空；`bindProgram` 按边填好。`missing` 不写入 `resolved`。

| `FileExport` | 含义                                          |
| ------------ | --------------------------------------------- |
| `name`       | 对外名称；`export *` 为 `'*'`                 |
| `space`      | `value` 或 `type`                             |
| `symbolId`   | 本地声明符号；再导出或 `export *` 为 `null`   |
| `source`     | 再导出说明符；本地导出为 `null`               |
| `imported`   | 对方模块中的名称，或 `'*'`；本地导出为 `null` |

| 语法                               | 出口边                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `export const` / `export function` | 对应 `value` 名                                                                            |
| `export class` / `export enum`     | 同名 `value` 与 `type`                                                                     |
| `export type` / `export interface` | `type` 名                                                                                  |
| `export { name }`                  | 按 `exportKind` / specifier 写入单一空间，默认 `value`                                     |
| `export *`                         | `value` 与 `type` 各一条 `'*'`                                                             |
| `export type *`                    | 仅 `type` 的 `'*'`                                                                         |
| `export * as ns`                   | 名为 `ns` 的命名空间边，`imported` 为 `'*'`                                                |
| `export default` 函数              | `default` 的 `value`                                                                       |
| `export default` 类                | `default` 的 `value` 与 `type`                                                             |
| `export default` 接口              | `default` 的 `type`                                                                        |
| `export default` 表达式            | `default` 的 `value`；能绑到已有双空间名时同时写 `type`。匿名表达式的 `symbolId` 为 `null` |

### 导出名解析

`ExportResolver.resolve(fileId, name, space)`：

1. 先匹配同空间的显式导出，显式边遮蔽 `export *`。
2. `default` 不经 `export *` 传播。
3. 其余名称沿同空间的 `export *` 递归。
4. 走回已访问的 `(fileId, space, name)` 视为 `missing`。
5. 多条 `export *` 落到同一 `(fileId, symbolId)` 为 `found`；落到不同符号或不同命名空间为 `ambiguous`。
6. `export * as` 的显式名为 `{ kind: 'namespace', fileId: 目标 }`。

缺少模块边时，对应再导出为 `missing`。

### 进口与链接

| `FileImport` | 含义                                                                |
| ------------ | ------------------------------------------------------------------- |
| `local`      | 本地绑定名                                                          |
| `imported`   | 对方导出名；默认导入为 `'default'`；`import *` 为 `'*'`             |
| `space`      | `import type` / specifier `type` / `typeof` 为 `type`，否则 `value` |
| `source`     | 说明符文本                                                          |
| `symbolId`   | 本地占坑，不是对方文件的 SymbolId                                   |

`bindProgram` 为每条进口查边并 `resolve`：

| 结果                      | 链接                       |
| ------------------------- | -------------------------- |
| `found`                   | 写入 `exportSymbolId`      |
| `namespace` 或 `import *` | `exportSymbolId` 为 `null` |
| 无边、`missing`           | `binder.unresolvedExport`  |
| `ambiguous`               | `binder.ambiguousExport`   |

命名再导出使用同一套解析；`export *` 与 `export * as` 本身不按展开结果逐名诊断。同一说明符上同时存在 value / type 再导出边时，缺失或歧义只对 value 边报一次。

## 无效子树

Parser / Validator 放入 `invalidNodes` 的节点及其声明目标：

- 不提升、不声明、不解析内部引用。
- 不写入对应 `exports` / `imports`。
- 同级及后续可信节点继续绑定。

无效声明不能产生可被正常代码引用的有效符号，也不建立内部错误符号。后续引用按未解析处理。

## 诊断

诊断结构服从 [源码与诊断](./3-sourceAndDiagnostics.md)。Binder 使用 `NXT2xxx`，热路径不拼接用户文案。

| messageId                 | code    | 参数         | 时机                   |
| ------------------------- | ------- | ------------ | ---------------------- |
| `binder.unresolved`       | NXT2101 | 名称         | 词法查找失败           |
| `binder.duplicate`        | NXT2102 | 名称         | 同作用域同空间重复声明 |
| `binder.unresolvedExport` | NXT2103 | 名称、说明符 | 无边或导出名 `missing` |
| `binder.ambiguousExport`  | NXT2104 | 名称、说明符 | 导出名 `ambiguous`     |

`bindFile` 只产生前两类。后两类由 `bindProgram` 写入程序级 `diagnostics`，不并入各文件 `diagnostics`。

存在绑定错误时可以保留已证明的侧表供后续诊断，不能生成可执行 Checked HIR。

## 不负责

| 工作                                   | 承担方                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 路径解析、`fileId`、模块初始化顺序     | host / T55                                                                                                          |
| 标准环境根符号名单和 `builtinId` 编码  | T49 / 标准库 / host                                                                                                 |
| 类型兼容、推导、重载适用性             | checker。无函数体的 `TSDeclareFunction` 不建符号；同名函数实现按重复声明处理。`infer` 候选合并与条件求值由 T41 负责 |
| 暂时性死区读取                         | checker / 语义                                                                                                      |
| `this` / `super`                       | T56                                                                                                                 |
| 成员与索引访问                         | T51                                                                                                                 |
| 捕获表、逃逸、别名写入、调用后收窄失效 | T58。binder 不另出自由变量表                                                                                        |
| intrinsic 语义                         | checker 按 `builtinId` 解释                                                                                         |
| 对象布局、GC、ABI、LLVM                | 表示规划与后端                                                                                                      |
