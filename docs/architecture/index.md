# 总体架构与设计路线图

- 文档状态：讨论中
- 实现状态：未实现
- 最后更新：2026-09-02

## 目标

定义 Nxts 语言、类型系统、编译器和 runtime 的完整设计范围，并将每项能力路由到明确的领域文档。

本路线图只记录能力范围、规范状态和交付条件，不重复具体规则。未列入支持范围的 TypeScript 能力必须在对应边界文档中明确标记为不支持，不能因缺少记录而被默认接受。

## 架构专项

- [内建能力边界](./1-builtinCapabilities.md)

## 语义选择优先级

性能目标是所有语义选择的首要约束。最终目标是常见静态路径达到等价 Go 程序的性能级别；第一版可以接受核心吞吐约为等价 Go 实现的 50%，但不能引入阻止后续达到最终目标的统一装箱、动态字段查找、通用调用分派或强制堆分配。

在满足该约束的前提下，语言行为按以下顺序确定：

| 场景                                       | 选择原则                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Nxts 接受已有 JavaScript / TypeScript 能力 | 优先保持 JavaScript 的可观察行为。                                                                |
| JavaScript 行为无法满足性能目标            | 不以相同能力名称静默改变语义；应拒绝该能力，或要求程序显式选择原生类型、原生 API 或其他静态能力。 |
| Nxts 新增且 JavaScript 没有对应语义的能力  | 优先采用 Rust 中成熟、确定、静态且无隐藏成本的语义。                                              |
| Rust 规则与 Nxts 已定语义或性能目标冲突    | 从 Nxts 的类型一致性、可预测行为和零隐藏成本原则重新确定，不机械复制 Rust。                       |

该优先级用于选择语义参考，不改变 Nxts 的 TypeScript 风格源码边界，也不意味着自动支持 JavaScript、TypeScript 或 Rust 的全部能力。

表中的 JavaScript 行为统一指 ECMAScript 严格模式。所有 Nxts 源码都按严格模式检查和执行，不依赖文件属于 script 还是 module，也不要求通过 `"use strict"` 指令启用。仅在非严格模式存在的隐式全局变量、静默赋值或删除失败、普通函数 `this` 替换、重复参数以及参数与 `arguments` 别名均不属于兼容范围。严格模式下能够静态确定的运行时错误可以提升为编译错误；无法静态确定时必须由对应能力明确失败行为。

Nxts 的源码接受范围是 TypeScript 的严格静态子集：除仅用于产生明确诊断的无效输入外，通过 Nxts 编译的源码必须能被 TypeScript 解析；在工具链提供 Nxts 内建类型声明后，也必须通过 TypeScript 类型检查。Nxts 可以拒绝 TypeScript 接受的程序，但不能通过新增非 TypeScript 语法或更宽松的类型规则扩大接受范围。该约束不承诺原生数值、内存布局、溢出和显式动态值等 Nxts 能力与 JavaScript 具有相同运行时表示；其可观察行为仍按上表确定。

语言规范优先定义最终稳定语义，不能仅为降低首版实现成本引入计划废弃的临时类型规则。实现可以按依赖和工程成本分阶段交付；尚未实现的最终能力必须明确标记状态，并保持 AST、checker、Typed IR 和 ABI 的扩展边界。若最终语义本身与性能目标或可维护性冲突，应直接收紧正式支持范围，而不是先采用不兼容的过渡语义。

## 文档编号

- 每个叶子目录独立使用 `<顺序>-<能力名称>.md` 命名，并从 `1` 开始连续编号。
- 文件编号只表示当前目录的阅读顺序，不是跨目录身份，也不等同于 T01–T61 能力编号。
- T01–T61 是跨目录稳定的能力 ID；文件移动或目录内重排不得改变能力 ID。
- 各领域的 `index.md` 是目录入口，不占用规范编号。
- 尚未建立的规范只在目标目录内预留编号；不同目录可以具有相同文件编号。

## 文档职责与唯一来源

同一条规则只能有一个权威文档。跨领域文档可以记录依赖和验收约束，但必须链接到权威来源，不能复制形成第二套定义。

| 领域                      | 唯一负责                                                                 | 不负责                                              |
| ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| `language/syntax`         | 源码语法、Babel AST 接受范围和语法拒绝边界                               | 名称绑定、类型关系、机器布局                        |
| `language/types`          | 类型身份、推导、兼容、转换、收窄和类型级计算                             | 对象头、tag 编码、字段偏移、GC 算法、调用 ABI       |
| `language/semantics`      | 核心值、运算符、表达式、语句和语言机制的用户可观察行为                   | 机器布局、runtime 数据结构、标准 API 专属契约       |
| `language/modules`        | 模块解析、导入导出图、可见性、初始化依赖和模块语义                       | 词法名称绑定、值布局和链接 ABI                      |
| `compiler/frontend`       | AST 验证、名称绑定、checker 数据结构、控制流分析和诊断实现               | 重新定义语言接受范围和类型结果                      |
| `compiler/ir`             | Checked HIR、Layout IR、阶段间节点和必须保留的语义事实                   | 新增语言语义、重新选择规范布局                      |
| `compiler/representation` | 语义类型到机器布局、tag、niche、对象头、接口视图和 `LayoutRecord` 的映射 | GC 回收算法、跨模块版本策略、公开 API               |
| `compiler/optimizer`      | 保持语义的优化、逃逸分析、专门化、lowering 策略和成本约束                | 改变程序接受结果、错误顺序或规范 ABI                |
| `compiler/backend`        | 目标相关指令选择、代码生成、目标文件和调试信息                           | 重新解释 Checked HIR 或语言类型关系                 |
| `compiler/abi`            | 调用约定、跨模块类型与符号元数据、版本兼容和链接拒绝                     | 源码类型兼容和 runtime 对象算法                     |
| `runtime/memory`          | 底层分配入口、内存上限、OOM 和原生资源生命周期                           | 语言对象身份、类型关系和 GC 扫描布局                |
| `runtime/gc`              | GC 描述符编码、根、扫描、屏障、安全点、回收和内部弱引用                  | 语言类型关系、对象字段布局                          |
| `runtime/objects`         | 字符串、容器、字典、类、接口和动态值所需的 runtime 算法                  | 静态类型规则、独立机器布局、函数值机制、GC 扫描算法 |
| `runtime/values`          | symbol、函数值、闭包与生成器等非普通对象值的 runtime 机制                | 静态函数兼容、物理字段布局和异常传播                |
| `runtime/exceptions`      | 错误对象、同步抛出、捕获、栈展开和异常 runtime ABI                       | Promise rejection 和静态控制流类型                  |
| `runtime/async`           | Promise 状态、任务调度、异步执行和异步失败传播                           | 同步异常语义和普通函数调用规则                      |
| `stdlib`                  | 公开模块、内建声明、标准 API 的签名与专属行为、intrinsic 和性能 API      | 核心类型身份、机器布局和 runtime 私有接口           |
| `interop`                 | FFI、宿主能力、外部内存、所有权、编码和资源边界                          | 普通语言对象布局和模块内私有 ABI                    |
| `toolchain`               | CLI、构建、缓存、诊断呈现、性能建议和开发工具                            | 改变语言语义或优化正确性                            |
| `quality`                 | 跨阶段一致性测试、性能基准和验收矩阵                                     | 产生新的语言或实现语义                              |

语言规范可以要求零隐藏分配、身份稳定、错误行为或特定复杂度，但物理布局以 `compiler/representation` 为唯一来源，GC 机制以 `runtime/gc` 为唯一来源，跨模块 ABI 以 `compiler/abi` 为唯一来源，标准 API 的存在性、签名和专属行为以 `stdlib` 为唯一来源。语言文档中的运行时章节只约束核心值和语言构造的可观察行为与成本；其中涉及具体字段、tag、描述符、调用约定或标准 API 方法契约的内容必须服从对应领域规范。

## 状态说明

| 状态       | 含义                                         |
| ---------- | -------------------------------------------- |
| 待讨论     | 尚未形成完整语言结论                         |
| 讨论中     | 已有部分结论，仍存在会影响实现的待确认项     |
| 已定稿     | 语法、类型规则、运行时行为和诊断边界均已确定 |
| 当前不支持 | 已明确在当前语言版本中拒绝                   |
| 文档待建立 | 已纳入设计范围，详细设计文档尚未创建         |

## 完整能力清单

### 类型系统基础

| 编号 | 能力             | 必须确定的内容                                      | 规范状态 | 详细设计                                                               |
| ---- | ---------------- | --------------------------------------------------- | -------- | ---------------------------------------------------------------------- |
| T01  | 类型分类与术语   | 值语义、构造方式、运行时表示和公共术语的边界        | 已定稿   | [`1-typeClassification.md`](../language/types/1-typeClassification.md) |
| T02  | 类型相等与规范化 | 别名展开、结构归一化、递归类型身份和 canonical type | 已定稿   | [`2-typeIdentity.md`](../language/types/2-typeIdentity.md)             |
| T03  | 子类型与赋值兼容 | 子类型、赋值兼容、隐式转换和表示兼容之间的关系      | 已定稿   | [`3-typeCompatibility.md`](../language/types/3-typeCompatibility.md)   |
| T04  | 类型格           | `never`、空值、基础类型和复合类型的上下界关系       | 已定稿   | [`4-typeLattice.md`](../language/types/4-typeLattice.md)               |
| T05  | 类型推导         | 变量、表达式、返回值和上下文类型的通用推导规则      | 已定稿   | [`5-typeInference.md`](../language/types/5-typeInference.md)           |
| T06  | 控制流类型分析   | 可达性、赋值状态、收窄、分支合并和穷尽性            | 已定稿   | [`6-typeNarrowing.md`](../language/types/6-typeNarrowing.md)           |

### 基础值与数值类型

| 编号 | 能力                  | 必须确定的内容                                 | 规范状态 | 详细设计                                                                                                                                                                             |
| ---- | --------------------- | ---------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T07  | `boolean`             | 条件 truthiness、逻辑运算符、比较结果和 ABI    | 已定稿   | [`7-basicTypes.md`](../language/types/7-basicTypes.md)、[`10-booleanSemantics.md`](../language/semantics/10-booleanSemantics.md)                                                     |
| T08  | `number`              | JavaScript Number 语义、支持的运算和优化边界   | 已定稿   | [`8-nativeNumericTypes.md`](../language/types/8-nativeNumericTypes.md)、[`1-numericSemantics.md`](../language/semantics/1-numericSemantics.md)                                       |
| T09  | 原生整数              | 宽度、运算、提升、溢出、除法和 checked 操作    | 已定稿   | [`8-nativeNumericTypes.md`](../language/types/8-nativeNumericTypes.md)、[`1-numericSemantics.md`](../language/semantics/1-numericSemantics.md)                                       |
| T10  | 原生浮点数            | `f32`、`f64`、`number` 的关系、舍入和优化边界  | 已定稿   | [`8-nativeNumericTypes.md`](../language/types/8-nativeNumericTypes.md)、[`1-numericSemantics.md`](../language/semantics/1-numericSemantics.md)                                       |
| T11  | 平台整数              | `usize`、`isize` 的目标宽度、序列化和 ABI      | 已定稿   | [`8-nativeNumericTypes.md`](../language/types/8-nativeNumericTypes.md)、[`1-typeAbi.md`](../compiler/abi/1-typeAbi.md)                                                               |
| T12  | 数值转换              | 显式 API、越界、舍入、失败模型和 IR            | 已定稿   | [`8-nativeNumericTypes.md`](../language/types/8-nativeNumericTypes.md)、[`5-numeric.md`](../stdlib/5-numeric.md)、[`28-typeConversions.md`](../language/types/28-typeConversions.md) |
| T13  | `string`              | 字面量、索引、比较、拼接、编码、长度和错误边界 | 已定稿   | [`9-stringTypes.md`](../language/types/9-stringTypes.md)、[`2-stringSemantics.md`](../language/semantics/2-stringSemantics.md)                                                       |
| T14  | `null` 与 `undefined` | 缺失值、赋值、比较、收窄和运行时行为           | 已定稿   | [`10-nullAndUndefined.md`](../language/types/10-nullAndUndefined.md)、[`3-nullishSemantics.md`](../language/semantics/3-nullishSemantics.md)                                         |

### 特殊类型与字面量

| 编号 | 能力               | 必须确定的内容                                         | 规范状态 | 详细设计                                                                                                                                                           |
| ---- | ------------------ | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T15  | `void`             | 合法位置、函数兼容、泛型使用和调用 ABI                 | 已定稿   | [`11-specialTypes.md`](../language/types/11-specialTypes.md)、[`11-specialValueSemantics.md`](../language/semantics/11-specialValueSemantics.md)                   |
| T16  | `never`            | 底类型、可构造性、不可达控制流、归一化和推导           | 已定稿   | [`11-specialTypes.md`](../language/types/11-specialTypes.md)、[`1-irContracts.md`](../compiler/ir/1-irContracts.md)                                                |
| T17  | `any` 与 `unknown` | `any` 拒绝、`unknown` 显式转换、合法操作和动态表示边界 | 已定稿   | [`11-specialTypes.md`](../language/types/11-specialTypes.md)、[`7-dynamic.md`](../stdlib/7-dynamic.md)                                                             |
| T18  | `symbol`           | 唯一身份、推导、合法操作、运行时表示和协议扩展边界     | 已定稿   | [`11-specialTypes.md`](../language/types/11-specialTypes.md)、[`8-symbol.md`](../stdlib/8-symbol.md)、[`1-symbolRuntime.md`](../runtime/values/1-symbolRuntime.md) |
| T19  | `bigint`           | 拒绝范围、原生整数替代、编译器内部边界和未来扩展       | 已定稿   | [`11-specialTypes.md`](../language/types/11-specialTypes.md)、[`1-syntaxSubset.md`](../language/syntax/1-syntaxSubset.md)                                          |
| T20  | 字面量类型         | 身份、保留、widening、负数、联合归一化和优化边界       | 已定稿   | [`12-literalTypes.md`](../language/types/12-literalTypes.md)                                                                                                       |

### 类型组合与收窄

| 编号 | 能力       | 必须确定的内容                                        | 规范状态 | 详细设计                                                                                                                                              |
| ---- | ---------- | ----------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| T21  | 联合类型   | 构造、归一化、接口吸收、赋值和运行时布局              | 已定稿   | [`13-unionTypes.md`](../language/types/13-unionTypes.md)、[`1-typeRepresentation.md`](../compiler/representation/1-typeRepresentation.md)             |
| T22  | 交叉类型   | 对象合并、接口组合、冲突约束和规范化                  | 已定稿   | [`14-intersectionTypes.md`](../language/types/14-intersectionTypes.md)、[`1-irContracts.md`](../compiler/ir/1-irContracts.md)                         |
| T23  | 空值联合   | `T \| null`、`T \| undefined` 的优化表示和 ABI        | 已定稿   | [`10-nullAndUndefined.md`](../language/types/10-nullAndUndefined.md)、[`1-typeRepresentation.md`](../compiler/representation/1-typeRepresentation.md) |
| T24  | 运行时收窄 | `typeof`、相等判断、判别字段、`instanceof` 和类型谓词 | 已定稿   | [`6-typeNarrowing.md`](../language/types/6-typeNarrowing.md)                                                                                          |
| T25  | 穷尽检查   | `switch`、联合成员覆盖和 `never` 检查                 | 已定稿   | [`6-typeNarrowing.md`](../language/types/6-typeNarrowing.md)                                                                                          |

### 对象与声明类型

| 编号 | 能力           | 必须确定的内容                                | 规范状态 | 详细设计                                                                                                                                                                                                            |
| ---- | -------------- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T26  | 对象类型       | 精确形状、初始化、可选属性、兼容、反射和布局  | 已定稿   | [`15-objectTypes.md`](../language/types/15-objectTypes.md)、[`4-objectSemantics.md`](../language/semantics/4-objectSemantics.md)                                                                                    |
| T27  | `readonly`     | 浅层写权限、别名可见性和复合类型统一规则      | 已定稿   | [`15-objectTypes.md`](../language/types/15-objectTypes.md)、[`4-objectSemantics.md`](../language/semantics/4-objectSemantics.md)                                                                                    |
| T28  | 类型别名       | 展开、目标类别、泛型、递归、品牌和导出        | 已定稿   | [`16-typeAliases.md`](../language/types/16-typeAliases.md)                                                                                                                                                          |
| T29  | 接口           | 结构契约、继承、实现、witness、反射和接口 ABI | 已定稿   | [`17-interfaces.md`](../language/types/17-interfaces.md)、[`12-interfaceSemantics.md`](../language/semantics/12-interfaceSemantics.md)、[`7-interfaceRuntime.md`](../runtime/objects/7-interfaceRuntime.md)         |
| T30  | 索引签名与字典 | 索引签名、动态键、对象字典视图、枚举和布局    | 已定稿   | [`18-dictionaryTypes.md`](../language/types/18-dictionaryTypes.md)、[`5-dictionarySemantics.md`](../language/semantics/5-dictionarySemantics.md)                                                                    |
| T31  | 递归类型       | 合法递归、无限展开检测、布局和 GC 描述        | 已定稿   | [`19-recursiveTypes.md`](../language/types/19-recursiveTypes.md)、[`1-typeRepresentation.md`](../compiler/representation/1-typeRepresentation.md)、[`1-gcTypeDescriptors.md`](../runtime/gc/1-gcTypeDescriptors.md) |

### 可调用与集合类型

| 编号 | 能力     | 必须确定的内容                                         | 规范状态 | 详细设计                                                                                                                                                                                                                        |
| ---- | -------- | ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T32  | 函数类型 | 参数、返回值、可选参数、rest、接口方法与调用签名和 ABI | 已定稿   | [`20-functionTypes.md`](../language/types/20-functionTypes.md)、[`13-functionSemantics.md`](../language/semantics/13-functionSemantics.md)、[`2-functionRuntime.md`](../runtime/values/2-functionRuntime.md)                    |
| T33  | 函数重载 | 是否支持、重载解析、实现签名和导出 ABI                 | 已定稿   | [`20-functionTypes.md`](../language/types/20-functionTypes.md)、[`1-typeAbi.md`](../compiler/abi/1-typeAbi.md)                                                                                                                  |
| T34  | 数组类型 | 元素类型、可变性、长度、索引越界、布局和 GC            | 已定稿   | [`21-arrayTypes.md`](../language/types/21-arrayTypes.md)、[`6-arraySemantics.md`](../language/semantics/6-arraySemantics.md)、[`2-arrayRuntime.md`](../runtime/objects/2-arrayRuntime.md)、[`2-array.md`](../stdlib/2-array.md) |
| T35  | 元组类型 | 固定长度、可选元素、索引、数组兼容和布局               | 已定稿   | [`22-tupleTypes.md`](../language/types/22-tupleTypes.md)、[`14-tupleSemantics.md`](../language/semantics/14-tupleSemantics.md)                                                                                                  |

### 类、泛型与类型级能力

| 编号 | 能力        | 必须确定的内容                                            | 规范状态 | 详细设计                                                                                                                                                                                  |
| ---- | ----------- | --------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T36  | 类类型      | 实例与静态侧、构造、单继承、`implements`、witness 和身份  | 已定稿   | [`23-classTypes.md`](../language/types/23-classTypes.md)、[`7-classSemantics.md`](../language/semantics/7-classSemantics.md)、[`5-classRuntime.md`](../runtime/objects/5-classRuntime.md) |
| T37  | 泛型        | 参数、约束、结果位置、推导、实例化和代码生成策略          | 已定稿   | [`24-generics.md`](../language/types/24-generics.md)                                                                                                                                      |
| T38  | 方差        | 函数、容器、只读视图和用户泛型的兼容规则                  | 已定稿   | [`24-generics.md`](../language/types/24-generics.md)                                                                                                                                      |
| T39  | 枚举        | 普通与常量枚举、封闭值域、标量表示、收窄和静态命名空间    | 已定稿   | [`25-enumTypes.md`](../language/types/25-enumTypes.md)、[`8-enumSemantics.md`](../language/semantics/8-enumSemantics.md)、[`6-enum.md`](../stdlib/6-enum.md)                              |
| T40  | 类型运算符  | `keyof`、类型查询、索引访问和 `as const` 的支持边界       | 已定稿   | [`26-typeOperators.md`](../language/types/26-typeOperators.md)                                                                                                                            |
| T41  | 高级类型    | `ReturnType`、条件类型、`infer`、映射类型和模板字符串类型 | 已定稿   | [`27-advancedTypes.md`](../language/types/27-advancedTypes.md)                                                                                                                            |
| T42  | `satisfies` | 不支持边界、拒绝诊断以及不进入 Typed IR 的约束            | 已定稿   | [`26-typeOperators.md`](../language/types/26-typeOperators.md)                                                                                                                            |

### 转换、运行时与 ABI

| 编号 | 能力           | 必须确定的内容                                                   | 规范状态 | 详细设计                                                                                                                                                                                   |
| ---- | -------------- | ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T43  | 类型断言       | `as const` 分流、品牌断言、普通 `as` 与双重断言拒绝边界          | 已定稿   | [`28-typeConversions.md`](../language/types/28-typeConversions.md)                                                                                                                         |
| T44  | 表示转换       | 数值转换、对象重建、运行时检查、成本和失败行为                   | 已定稿   | [`28-typeConversions.md`](../language/types/28-typeConversions.md)、[`9-conversionSemantics.md`](../language/semantics/9-conversionSemantics.md)、[`7-dynamic.md`](../stdlib/7-dynamic.md) |
| T45  | 类型运行时表示 | 值布局、接口视图、witness、tag、扩展记录、对齐和平台差异         | 已定稿   | [`1-typeRepresentation.md`](../compiler/representation/1-typeRepresentation.md)                                                                                                            |
| T46  | GC 类型描述    | 引用字段、接口底层引用、扩展记录、联合 payload 和递归扫描        | 待讨论   | [`1-gcTypeDescriptors.md`](../runtime/gc/1-gcTypeDescriptors.md)                                                                                                                           |
| T47  | 跨模块 ABI     | 类型身份、接口契约指纹、witness ABI、布局与泛型版本兼容          | 待讨论   | [`1-typeAbi.md`](../compiler/abi/1-typeAbi.md)                                                                                                                                             |
| T48  | 原生内存与 FFI | 外部/共享/零复制内存、所有权、生命周期、对齐、编码和宿主能力绑定 | 待讨论   | [`1-ffiTypes.md`](../interop/1-ffiTypes.md)                                                                                                                                                |
| T49  | 标准库类型边界 | 标准模块、内建泛型、intrinsic 身份、优化 API 和宿主能力          | 讨论中   | [`1-standardLibraryTypes.md`](../stdlib/1-standardLibraryTypes.md)                                                                                                                         |

`std/array`、`std/numeric` 等路径和公开名称在 T49 最终确定。编译器按解析后的导入符号身份识别 intrinsic，不按同名函数猜测，也不为静态标准库调用引入动态模块查找。性能建议属于独立工具链诊断；类型规范只提供可证明的语义与成本事实，未启用性能采样时不得增加运行时插桩。

### 表达式、语句与模块类型规则

| 编号 | 能力               | 必须确定的内容                                               | 规范状态 | 详细设计                                                                                                     |
| ---- | ------------------ | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| T50  | 运算符类型规则     | 一元、二元、比较、逻辑、空值合并、条件表达式和结果类型       | 待讨论   | `../language/types/29-expressionTypes.md`、`../language/semantics/19-expressionSemantics.md`，文档待建立     |
| T51  | 成员访问与索引访问 | 直接字段、接口 witness、动态 key、数组索引、可选链和失败边界 | 待讨论   | `../language/types/30-accessTypes.md`、`../language/semantics/20-accessSemantics.md`，文档待建立             |
| T52  | 赋值、解构与展开   | 左值、接口可选写入、解构、rest、spread 和临时值成本          | 待讨论   | `../language/types/31-assignmentTypes.md`、`../language/semantics/21-assignmentSemantics.md`，文档待建立     |
| T53  | 调用与构造         | 函数与接口方法调用、`new`、接收者、重载入口和调用诊断        | 待讨论   | `../language/types/32-callTypes.md`、`../language/semantics/22-callSemantics.md`，文档待建立                 |
| T54  | 语句类型检查       | 条件、循环、接口 `for...in`、`return`、块作用域和控制流入口  | 待讨论   | `../language/types/33-statementTypes.md`、`../language/semantics/23-statementSemantics.md`，文档待建立       |
| T55  | 模块类型边界       | 模块解析、`import`、`export`、导出图、跨模块可见性和诊断     | 讨论中   | [`1-moduleTypes.md`](../language/modules/1-moduleTypes.md)                                                   |
| T56  | `this` 与 `super`  | 接收者类型、静态侧、实例侧、基类访问、初始化顺序和调用 ABI   | 待讨论   | `../language/types/34-thisAndSuperTypes.md`、`../language/semantics/24-thisAndSuperSemantics.md`，文档待建立 |

### 名称绑定与跨语句语言机制

| 编号 | 能力                   | 必须确定的内容                                                                                | 规范状态 | 详细设计                                                                                                                                        |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| T57  | 名称、作用域与声明绑定 | 符号表、类型/值空间、词法作用域、遮蔽、重复声明、类型引用、导入链接和导出名展开               | 已定稿   | [`4-nameBinding.md`](../compiler/frontend/4-nameBinding.md)                                                                                     |
| T58  | 闭包、捕获与副作用模型 | 捕获、逃逸、对象/接口别名写入、扩展记录、调用副作用和收窄失效                                 | 待讨论   | `../language/semantics/15-closureSemantics.md`、`../compiler/frontend/7-effectAnalysis.md`、`../runtime/values/4-closureRuntime.md`，文档待建立 |
| T59  | 异步函数与 Promise     | `async`、返回值包装、`await` 检查与解包、Promise fulfillment/rejection、顶层 await 和异步模块 | 待讨论   | `../language/types/35-asyncTypes.md`、`../language/semantics/17-asyncSemantics.md`、`../runtime/async/1-promiseRuntime.md`，文档待建立          |
| T60  | 迭代器与生成器         | `Iterable`、`Iterator`、`for...of`、`yield`、`yield*` 和异步迭代                              | 待讨论   | `../language/types/36-iteratorTypes.md`、`../language/semantics/18-iteratorSemantics.md`、`../runtime/values/5-generatorRuntime.md`，文档待建立 |
| T61  | 异常与错误流           | 同步 `throw`、`try`、`catch`、`finally`、catch 变量、栈展开和异常 ABI                         | 待讨论   | `../language/semantics/16-exceptionSemantics.md`、`../runtime/exceptions/1-exceptionRuntime.md`，文档待建立                                     |

## 讨论顺序

讨论按依赖关系分为以下阶段：

| 阶段            | 范围               | 完成条件                                                                   |
| --------------- | ------------------ | -------------------------------------------------------------------------- |
| 0. 名称绑定     | T57                | 绑定规则已写入 [`4-nameBinding.md`](../compiler/frontend/4-nameBinding.md) |
| 1. 类型系统骨架 | T01–T06            | checker 的类型模型、关系和推导术语确定                                     |
| 2. 基础值与数值 | T07–T14            | 基础运算、边界行为和直接运行时表示确定                                     |
| 3. 特殊与字面量 | T15–T20            | 特殊类型在类型格、推导和控制流中的行为确定                                 |
| 4. 类型组合     | T21–T25            | 联合、空值和收窄规则以及布局确定                                           |
| 5. 复合类型     | T26–T35            | 常用对象、声明、函数和集合类型确定                                         |
| 6. 类与泛型     | T36–T42            | 复用、抽象和类型级计算边界确定                                             |
| 7. 转换与 ABI   | T43–T49            | 所有类型具有确定的转换成本和运行时契约                                     |
| 8. 跨语句机制   | T58、T61、T59、T60 | 闭包、异常、异步和迭代的类型与运行时边界确定                               |
| 9. 表达式与模块 | T50–T56            | 表达式、语句、调用和模块边界的类型入口确定                                 |

阶段内默认按编号讨论；存在显式依赖时，应先完成依赖项，不能通过局部特例绕过公共类型规则。

T59 与 T61 的边界为：T59 定义 Promise fulfillment/rejection、异步返回、异步失败传播以及同步异常如何转为 Promise rejection；T61 定义同步 `throw`、栈展开、`try` / `catch` / `finally` 和异常 ABI。T59 涉及同步异常来源时引用 T61，不重复定义同步异常控制流。

## 单项定稿标准

每项能力必须同时满足以下条件才能标记为“已定稿”：

| 方面       | 交付要求                                              |
| ---------- | ----------------------------------------------------- |
| 语言边界   | 明确支持与拒绝的语法和使用位置                        |
| 静态语义   | 明确类型相等、推导、兼容、转换和收窄规则              |
| 运行时语义 | 明确值行为、错误行为和可观察结果                      |
| 编译器职责 | 明确 parser、checker、Typed IR 和 lowering 的处理阶段 |
| 性能与 ABI | 明确布局、分配、运行时检查、GC 和跨模块边界           |
| 诊断与测试 | 提供接受、拒绝、边界和跨阶段测试用例                  |

## 设计交付条件

整个语言与编译器设计满足以下条件后，才进入完整实施状态：

- T01–T61 均具有明确规范状态和主要语义来源；涉及公共规则时明确引用上位规范。
- 所有“待确认项”已经形成结论，或明确记录为当前不支持。
- 类型名称、术语、状态和相对链接在全部文档中一致。
- 每个运算符都有操作数类型、结果类型、边界行为和 IR 规则。
- 每种隐式或显式转换都有成本、失败行为和运行时表示规则。
- parser、checker、Typed IR、运行时和 ABI 的职责没有空白或重叠。
- 规范示例已经形成可执行的接受、拒绝和边界测试清单。
