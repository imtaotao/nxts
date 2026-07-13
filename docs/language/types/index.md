# 类型规范

本索引汇总类型分类、身份、推导、兼容、转换、收窄和类型级能力。值行为由语言语义目录单独定义，并从本索引交叉引用。

- 覆盖能力：T01–T44
- 规范状态：已定稿
- 完整能力状态：[总体架构与设计路线图](../../architecture/index.md)

## 职责边界

本目录只负责静态类型规则。各文档可以规定零隐藏分配、身份稳定和失败行为等约束，但不定义对象头、字段偏移、tag 编码、GC 扫描、跨模块调用约定或标准库方法集合。

| 内容                 | 权威来源                                                            |
| -------------------- | ------------------------------------------------------------------- |
| Checker 实现与预算   | [`compiler/frontend`](../../compiler/frontend/index.md)             |
| 阶段间类型事实与节点 | [`compiler/ir`](../../compiler/ir/index.md)                         |
| 机器布局与表示       | [`compiler/representation`](../../compiler/representation/index.md) |
| Runtime 对象服务     | [`runtime/objects`](../../runtime/objects/index.md)                 |
| Runtime 基础值机制   | [`runtime/values`](../../runtime/values/index.md)                   |
| GC 机制              | [`runtime/gc`](../../runtime/gc/index.md)                           |
| 跨模块 ABI           | [`compiler/abi`](../../compiler/abi/index.md)                       |
| 公开标准 API         | [`stdlib`](../../stdlib/index.md)                                   |

## 文档分组

| 分组                 | 能力范围 | 规范文档                                                                                                                                                                                                                                                                                       |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 类型系统基础         | T01–T06  | [`1-typeClassification.md`](./1-typeClassification.md)、[`2-typeIdentity.md`](./2-typeIdentity.md)、[`3-typeCompatibility.md`](./3-typeCompatibility.md)、[`4-typeLattice.md`](./4-typeLattice.md)、[`5-typeInference.md`](./5-typeInference.md)、[`6-typeNarrowing.md`](./6-typeNarrowing.md) |
| 基础值与字面量       | T07–T20  | [`7-basicTypes.md`](./7-basicTypes.md)、[`8-nativeNumericTypes.md`](./8-nativeNumericTypes.md)、[`9-stringTypes.md`](./9-stringTypes.md)、[`10-nullAndUndefined.md`](./10-nullAndUndefined.md)、[`11-specialTypes.md`](./11-specialTypes.md)、[`12-literalTypes.md`](./12-literalTypes.md)     |
| 类型组合与收窄       | T21–T25  | [`13-unionTypes.md`](./13-unionTypes.md)、[`14-intersectionTypes.md`](./14-intersectionTypes.md)、[`10-nullAndUndefined.md`](./10-nullAndUndefined.md)、[`6-typeNarrowing.md`](./6-typeNarrowing.md)                                                                                           |
| 对象与声明类型       | T26–T31  | [`15-objectTypes.md`](./15-objectTypes.md)、[`16-typeAliases.md`](./16-typeAliases.md)、[`17-interfaces.md`](./17-interfaces.md)、[`18-dictionaryTypes.md`](./18-dictionaryTypes.md)、[`19-recursiveTypes.md`](./19-recursiveTypes.md)                                                         |
| 可调用与集合类型     | T32–T35  | [`20-functionTypes.md`](./20-functionTypes.md)、[`21-arrayTypes.md`](./21-arrayTypes.md)、[`22-tupleTypes.md`](./22-tupleTypes.md)                                                                                                                                                             |
| 类、泛型与类型级能力 | T36–T42  | [`23-classTypes.md`](./23-classTypes.md)、[`24-generics.md`](./24-generics.md)、[`25-enumTypes.md`](./25-enumTypes.md)、[`26-typeOperators.md`](./26-typeOperators.md)、[`27-advancedTypes.md`](./27-advancedTypes.md)                                                                         |
| 类型断言与表示转换   | T43–T44  | [`28-typeConversions.md`](./28-typeConversions.md)                                                                                                                                                                                                                                             |

## 规划规范

| 顺序 | 静态能力                | 任务编号 | 规划文档                  |
| ---- | ----------------------- | -------- | ------------------------- |
| 29   | 运算符结果类型          | T50      | `29-expressionTypes.md`   |
| 30   | 成员与索引访问类型      | T51      | `30-accessTypes.md`       |
| 31   | 赋值、解构与展开类型    | T52      | `31-assignmentTypes.md`   |
| 32   | 调用与构造类型          | T53      | `32-callTypes.md`         |
| 33   | 语句类型入口            | T54      | `33-statementTypes.md`    |
| 34   | `this` 与 `super` 类型  | T56      | `34-thisAndSuperTypes.md` |
| 35   | 异步函数与 Promise 类型 | T59      | `35-asyncTypes.md`        |
| 36   | 迭代器与生成器类型      | T60      | `36-iteratorTypes.md`     |

对应求值顺序、身份和失败行为归 [`language/semantics`](../semantics/index.md)，名称绑定与副作用分析归 [`compiler/frontend`](../../compiler/frontend/index.md)。
