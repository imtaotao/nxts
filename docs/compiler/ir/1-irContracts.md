# 阶段间 IR 契约

- 规范状态：部分定稿
- 文档顺序：1

## 目标与边界

本规范记录 Checked HIR、Layout IR 与后续阶段之间必须保留的语义事实。语言规范决定程序含义，表示规范决定规范布局；IR 只负责无损传递已经确定的结果，不能重新推导或修改语言规则。

## 字面量与常量事实

Checked HIR 同时记录字面量的基础语义类型和可选规范常量事实。常量事实可供分支、穷尽、字符串池和专门化使用，但不是独立值布局，也不能在 widening 后反向修改公开静态类型。

Layout IR 只使用基础类型的规范布局，不创建字面量 tag、包装、GC 描述或调用槽位。负零、NaN、无穷、UTF-16 code unit 和原生数值宽度等可观察位语义必须保留。

## 数组

Checked HIR 必须显式保留：

- 数组分配与新身份。
- 已解析的元素语义类型。
- 可变或只读能力。
- 长度读取、截断和清空。
- 索引读写及其已证明边界事实。
- 数组联合和联合元素类型。
- 复制、spread、解构 rest 和结果身份。
- 可能产生 `RangeError`、`TypeError` 或分配失败的边界。

Layout IR 必须显式关联：

- 数组对象与元素 `LayoutRecord`。
- 元素大小、对齐、状态平面和 GC 形状。
- 数组联合的外层 tag 或规范判别。
- 批量复制和批量写屏障所需的布局信息。

后续阶段不得重新猜测元素类型、引入动态 elements-kind、把只读权限写入物理数组对象，或仅为实现数组方法而改变可观察身份。

## 字符串

Checked HIR 必须区分：

```text
StringLiteral
StringLength
StringIndex
StringCompare
StringConcat
StringFormatValue
```

`StringConcat` 保存按源码顺序求值的扁平片段、每个片段的静态格式化入口和 checked 前缀长度失败边。lowering 不能改写为 JavaScript `ToPrimitive`、动态类型分派、参数数组或逐段中间字符串。

字符串索引返回普通 `string | undefined` 结果，不分配联合包装。比较节点按 UTF-16 code unit 语义执行且不能分配转码字符串。全常量操作可以在进入 Checked HIR 前折叠，但必须保持错误与副作用边界。

## 元组

Checked HIR 必须显式记录固定、optional 或 rest 形状、合法长度、位置类型、readonly 权限和递归类型身份，并区分：

```text
TupleCreate
TupleRead
TupleWrite
TupleDynamicRead
TupleDynamicWrite
TupleCopy
TupleArrayView
TupleMaterialize
```

固定字面量索引在 Layout IR 中使用常量位置或连续元素偏移；动态异构索引只生成实际可能位置分支并构造规范联合。已证明边界的读取可以消除检查，动态越界写入仍必须保留原子失败语义。

spread、rest 解构和 tuple rest 参数必须记录新身份或待物化事实。只有优化器证明身份、别名和逃逸不可观察时才能消除复制或对象；readonly 数组视图不能复制或创建适配器。

## 数值

Checked HIR 必须保留：

- `number`、固定整数、原生浮点和平台整数的语义类型身份。
- 整数宽度与符号性。
- 浮点目标精度和严格 IEEE 语义。
- 普通、checked 和 saturating 运算类别。
- 整数除零与 `MIN / -1` 失败边。
- 普通与精确数值转换类别。
- 精确转换的目标值与成功标记。

Layout IR 按 T45 关联规范标量布局。后续阶段不能因同宽表示合并 `number` 与 `f64`、`usize` 与固定整数，也不能自行猜测截断、扩展、舍入、饱和或失败语义。

## 布尔与条件

Checked HIR 必须区分：

- 规范 `boolean` 值。
- 比较和逻辑非产生的布尔结果。
- 对其他支持值执行的 `TruthinessTest`。
- `&&`、`||` 与条件表达式的短路控制流和选中值。
- 控制流分析已经建立的 truthiness 收窄事实。

Layout IR 使用 T45 的规范布尔布局。寄存器中的条件可以使用后端高效形式，但进入内存或调用 ABI 前必须恢复规范值。后续阶段不能把返回操作数的逻辑表达式改写为只返回布尔值。

## 空值与缺失值

Checked HIR 必须显式保留：

- `null` 与 `undefined` 的不同语义成员身份。
- `UnionInject`、必要的 `UnionRepack` 和控制流收窄事实。
- 空值严格比较、`typeof` 空值检查及其已知常量结果。
- `??`、可选链和默认值的单次求值、短路边与结果类型。
- 可选属性的“缺失”和“存在且值为 `undefined`”状态差异。

Layout IR 必须关联规范空值编码、联合状态、有效 payload 与 GC 形状。引用联合的同布局注入可以降低为零条指令，标量空值联合必须内联状态且不得装箱。

后续阶段不能用 LLVM `undef` 或 poison 表示 Nxts `undefined`，也不能因位模式相同而合并不同静态类型中的 `null` 与 `undefined` 身份。

## `void`、`never`、`unknown` 与 `symbol`

Checked HIR 必须分别保留：

| 能力             | 必需事实                                               |
| ---------------- | ------------------------------------------------------ |
| 一元 `void`      | 操作数求值、结果丢弃和规范 `undefined` 结果。          |
| `void` 返回      | 静态返回类型和无结果载荷。                             |
| `undefined` 返回 | 可使用单例值类型，即使 ABI 最终省略载荷。              |
| `never`          | 静态结果类型、无正常后继和独立异常完成边。             |
| `unknown`        | 动态标签操作、空值检查、严格比较和已验证 payload。     |
| `symbol`         | 标量身份、精确 unique 声明身份和普通 symbol widening。 |

没有正常完成路径的表达式不产生 SSA 值或占位载荷。合并点只接收可正常到达分支的值；调用准确返回 `never` 的函数后没有正常后继。若函数值已被兼容为 `(...P) => void`，调用点必须保守保留正常后继。

后端可以为已证明的同步 `never` 入口使用 no-return 属性和终止指令，但必须保留可能的异常展开边。静态返回类型为普通 `T` 的内部不返回实现仍保留 `T` 的物理签名。

LLVM 的 `undef` 不表示 Nxts `undefined`；后端也不能为 `never` 发明零尺寸占位值。

## 枚举

Checked HIR 必须显式保留：

- 枚举名义 `TypeId`、底层类别和精确成员类型。
- 成员规范值、重复值别名与规范诊断名称。
- 已完成常量求值的成员读取。
- widening、收窄、穷尽覆盖和重叠值候选集合。
- 枚举到底层类型的无操作转换。
- 受信检查转换和按需成员遍历节点。

Layout IR 必须关联底层标量、空值或一般联合布局。普通枚举值不得增加描述符、有效性位、运行时对象或隐藏调用参数。

后续阶段不能根据相同机器表示合并 checker 中不同枚举的名义身份，也不能为同表示重叠联合伪造可观察的来源 tag。

## 转换与动态检查

Checked HIR 必须使用明确转换类别：

```text
NoOp
├─ AliasExpand
├─ BrandEstablish
├─ ExactShapeView
└─ MutableToReadonly

ImplicitPack
├─ InterfacePack
├─ InterfaceRepack
├─ UnionInject
└─ UnionRepack

RepresentationConvert
├─ NumericConvert
├─ NumericChecked(value, success)
└─ DynamicPack(value, dynamicDescriptor)

ObjectConstruct
└─ CreateExactObject

CheckedNarrow
├─ BuiltinNarrow
├─ InstanceOf
└─ CheckedTypeTest(value, targetDescriptor, success, payloadOrWitness)
```

`NoOp` 不生成代码；`ImplicitPack` 必须无失败、有界且不隐式堆分配。`DynamicPack` 和 `CheckedTypeTest` 必须保留显式成本、目标描述、成功载荷和异常边，不能提前降为普通函数名或只剩布尔结果。

Layout IR 为每个节点关联具体 `RepresentationRelation`、布局、GC 形状和 ABI 分类。后续阶段不能根据表面 `as` 语法重新猜测转换，也不能把需要复制、检查或分配的操作折叠成无操作。

## 联合类型

Checked HIR 必须显式保留：

- 规范成员集合与语义联合 `TypeId`。
- `UnionInject`、`UnionRepack` 和真正的无操作转换。
- tag 或现有判别检查及其控制流成员集合。
- 未收窄公共属性读取、安全属性写入、索引和调用的逐成员检查结果。
- 当前成员 payload 访问和可能的接口 pack/repack。

Layout IR 关联规范联合编码和各成员布局。不同成员属性偏移时可以按状态选择固定偏移；偏移相同且表示相同时应允许消除分支。大型 payload 的间接传递属于 ABI 分类，不能改成隐藏堆包装。

后续阶段不得为普通运算生成动态尝试式分派，也不得从重叠位模式恢复上游未承诺的成员来源。

## 交叉类型

Checked HIR 只接收交叉规范化后的具体类型，不定义 `IntersectionInject`、交叉 tag、动态对象合并或运行时交叉检查。

品牌特例在语义类型层保留品牌身份，值表示使用底层类型。对象交叉使用规范化后的单一精确对象类型；接口交叉使用规范组合契约；联合分配结果使用普通联合节点。

如果 Checked HIR、Layout IR 或后端仍看到未闭合的普通交叉，属于前端实现错误，不能退化为动态分派或通用盒。

## 接口

Checked HIR 必须使用明确接口操作：

```text
InterfacePack(data, witness)
InterfaceRepack(interfaceValue, targetWitness)
InterfaceGet(interfaceValue, memberSlot)
InterfaceSet(interfaceValue, memberSlot, value)
InterfaceCall(interfaceValue, methodSlot, args)
CheckedTypeTest(value, targetContract)
```

节点携带规范接口契约、具体来源类型、成员槽位、权限、可选状态和成功 payload。接口打包不能伪装成普通对象类型相等；可写缺失可选属性必须标记可能进入有限扩展路径。

Layout IR 关联接口二字布局、witness、底层对象 GC 引用和扩展记录描述。后续阶段不能重新执行结构成员扫描或根据接口名称动态匹配。

## 类

Checked HIR 必须显式保留：

- 类声明或类表达式求值及其名义身份。
- 实例侧、静态侧、构造签名和继承关系。
- 字段身份、初始化顺序、可选状态和确定赋值结果。
- 直接构造与动态构造。
- 直接调用、虚方法槽位、静态槽位和接口 witness 调用。
- `super` 的静态目标和 `new.target` 的实际类来源。
- 静态初始化函数、动态类身份和捕获环境需求。
- 构造或静态初始化的异常边。

Layout IR 必须关联类实例 `LayoutRecord`、类描述符、方法槽位、静态状态、接口 witness 和 GC 形状。

后续阶段不能重新解析覆盖关系、修改构造安全结论、用动态 shape 替代固定字段，或合并可观察的动态类身份。

## 精确对象

Checked HIR 必须显式保留：

- 规范对象形状和语义属性身份。
- 属性类型、可选性和写权限。
- 固定对象、有限对象联合或字典的分流结果。
- 对象分配与引用身份。
- 可选属性存在、删除和重新添加操作。
- `in`、枚举、对象展开和 `Object.*` 反射入口。
- 对象到接口或字典视图的无复制转换。

Layout IR 必须关联存储描述符、枚举描述符、存在位、固定字段布局、动态扩展定位和 GC 形状。

后续阶段不能重新猜测对象 shape、把不同固定布局直接重解释、为普通对象引入 shape transition，或因静态接口视图裁剪反射结果。

为未来显式代理能力预留的 IR 扩展只能体现在可扩展的成员操作与调用目标判别中。代理必须形成独立类型和明确分派；未使用代理的普通对象不能因此增加 tag、隐藏字段、动态属性表或运行时判断。

## 字典

Checked HIR 必须使用明确操作表达：

```text
DictionaryCreate
DictionaryPack
DictionaryRepack
DictionaryGet
DictionarySet
DictionaryDelete
DictionaryHasOwn
DictionaryHas
DictionaryIterate
```

每个节点携带规范键域、值类型、权限、固定 key 信息和存在性结果。存在检查与后续读取必须保留关联探测事实。

Layout IR 必须区分原生字典与对象字典视图，关联哈希表值布局、witness、动态扩展定位、枚举状态和 GC 描述。

后续阶段不能把缺失读取替换为原生零值、逐条复制完成隐式兼容，或让形成视图的操作分配哈希表。

## 递归类型

递归合法性、固定点兼容、推导和无限实例增长必须在产生 Checked HIR 前完成。Checked HIR 只保留具体对象、容器、函数、接口、空值和联合操作，不生成递归专用动态节点。

Layout IR 在引用边停止内联展开，并通过普通引用槽位、可空引用或联合 payload 引用目标布局。递归类型不能触发隐藏装箱、运行时深度计数、动态泛型表或结构扫描。

泛型代码生成以有限专门化需求图为输入。需求图出现无界新实例链时由 T37 诊断，不能通过擦除泛型、统一动态派发或 runtime 类型参数表继续 lowering。

## 函数与调用

Checked HIR 必须区分以下操作：

```text
DirectCall
IndirectCall
MethodCall
FunctionValueCreate
FunctionEntrySelect
DefaultParameterInit
RestArrayCreate
```

重载解析在生成 Checked HIR 前完成，调用节点只记录选中的单一规范签名和精确入口。方法调用显式携带接收者；直接方法调用不先创建绑定函数值。

参数数量或返回表示需要静态适配时，IR 记录规范源 ABI、目标 ABI 和允许的有限转换。适配只能忽略安全尾参、补入 `undefined`、构造 rest 数组、打包接口或执行有界联合注入/重打包；不能接收通用 `Value[]`、读取运行时实参数量或执行动态类型检查。

函数值创建必须保留稳定身份与环境来源。`name`、`length`、重载入口和优化后符号名不改变该身份。rest 数组、函数对象或适配入口被消除前，优化器必须证明身份、逃逸和副作用不可观察。

## 泛型

泛型声明配方可以作为模块级已检查元数据保留符号类型参数；可执行 Checked HIR、Layout IR 中的字段、参数、返回值、容器元素、联合成员和调用必须全部闭合。

IR 必须区分：

```text
GenericInstanceRequest
GenericDirectCall
PolymorphicFunctionValueCreate
PolymorphicEntrySelect
GenericWitnessEntrySelect
```

每个实例请求携带规范声明身份和规范实参键。普通调用直接引用闭合入口；一等多态值和动态接口泛型方法只记录链接期固定槽位需求。

类型参数、约束和方差不能作为运行时值进入 Layout IR。lowering 不得添加隐藏类型描述、运算字典、统一盒、运行时约束检查或动态专门化。

## 类型运算符

闭合 `keyof`、类型查询和索引访问类型必须在生成 Checked HIR 前替换为规范结果类型；`as const` 必须提交为普通字面量、readonly 和元组类型事实。可执行 IR 不包含类型运算节点。

值表达式原本存在的固定字段、有限键分派、字典索引、数组/元组边界或 spread 操作仍按其语言语义保留。类型运算本身不能生成键数组、运行时枚举、冻结、复制、类型描述符、初始化依赖或隐藏分支。

开放泛型模块配方可以保留符号运算，但每个闭合 `GenericInstanceRequest` 必须先求得具体结果，再进入可执行 IR。

## 高级类型

条件类型、`infer`、映射类型、模板字符串类型和标准类型工具只允许存在于前端类型图及开放泛型模块配方。可执行 Checked HIR 和 Layout IR 只能看到规范化后的普通类型。

高级类型来源不能添加运行时真假标记、类型参数字典、键映射表、模板正则验证、对象复制、统一装箱或字符串模式标签。最终结果若为联合、可选对象、元组或字典，只保留该最终类型自身需要的 IR 操作。

普通模板表达式、大小写值转换和 Promise/`await` 是独立值操作；只有源码实际调用对应能力时才进入 IR，不能因同名类型工具自动生成。

## 待纳入

函数、接口、联合、动态值、泛型和转换的阶段间契约在对应规范完成职责拆分时纳入本文件。
