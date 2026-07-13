# 子类型与赋值兼容

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-26
- 文档顺序：3

## 目标

定义 Nxts 中子类型、赋值兼容、隐式转换、显式转换和表示转换的公共边界，为 checker 在赋值、参数传递、返回值检查、上下文类型和联合类型规则中提供统一判断依据。

类型相等与规范化见 [`2-typeIdentity.md`](./2-typeIdentity.md)，对象形状与 `readonly` 规则见 [`15-objectTypes.md`](./15-objectTypes.md)，接口契约见 [`17-interfaces.md`](./17-interfaces.md)，字典视图见 [`18-dictionaryTypes.md`](./18-dictionaryTypes.md)，类型别名与品牌见 [`16-typeAliases.md`](./16-typeAliases.md)，类型断言和表示转换边界见 [`28-typeConversions.md`](./28-typeConversions.md)。

## 核心原则

Nxts 的普通子类型兼容只接受同一个运行时值的安全静态视图转换。赋值兼容还可以包含由类型能力明确规定的有界表示构造，例如接口打包和联合注入；这类构造必须在 Typed IR 中可见，且不能引入隐藏堆分配、对象复制、运行时类型检查或可能失败的操作。

```text
源码值
  -> checker 证明可作为目标类型使用
  -> 无操作视图：Typed IR 不生成转换节点
  -> 有界表示构造：Typed IR 生成 InterfacePack / DictionaryPack / UnionInject 等节点
  -> runtime 保留原值身份，不执行隐式对象重建或动态检查
```

需要改变表示、重建对象、损失精度、丢弃字段、检查运行时类型或可能失败的行为，不属于赋值兼容，应使用显式转换、显式对象构造或运行时收窄表达。

## 术语

| 术语       | 含义                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| 类型相等   | 源类型与目标类型规范化后表示同一语义类型。                              |
| 子类型关系 | 源类型的值可以零成本、安全地作为目标类型的值使用。                      |
| 赋值兼容   | checker 在赋值、传参、返回值和上下文类型位置接受源类型。                |
| 隐式转换   | 赋值兼容中由 checker 自动接受的无操作视图或已明确规定的有界表示构造。   |
| 显式转换   | 源码中明确写出的转换、构造或收窄操作，可能生成运行时代码。              |
| 表示转换   | 改变运行时表示的转换，例如数值宽度转换、对象形状重建或运行时 tag 检查。 |

类型相等是子类型关系的基础情况。子类型关系可以比类型相等更宽，但必须保持零运行时成本。赋值兼容由类型相等、零成本子类型关系，以及接口、联合等规范明确允许的无失败有界表示构造组成。

## 赋值兼容位置

以下位置使用同一套赋值兼容规则：

- 变量声明和赋值。
- 函数参数传递。
- 函数返回值检查。
- 对象、数组、元组等复合字面量的上下文类型检查。
- 条件表达式、联合类型构造和分支合并中需要判断公共目标类型的位置。

不同位置不得各自引入额外的宽松规则。对象字面量、变量、函数参数和返回值使用同一套兼容判断，不采用 TypeScript 针对新鲜对象字面量的额外属性检查特例。

## 零成本兼容规则

当前允许的零成本赋值兼容包括：

| 规则                  | 方向                               | 说明                                                      |
| --------------------- | ---------------------------------- | --------------------------------------------------------- |
| 类型相等              | `T -> T`                           | 规范化后为同一语义类型。                                  |
| 类型别名展开          | `Alias<T> -> T`                    | 普通类型别名透明，不创建新语义身份。                      |
| 品牌到底层类型        | `Brand<T, Tag> -> T`               | 只丢弃静态品牌身份，运行时表示不变。                      |
| 字面量到基础类型      | `"a" -> string`、`true -> boolean` | 字面量类型保留更窄的静态信息，运行时表示不变。            |
| symbol 单例到基础类型 | `typeof token -> symbol`           | 只丢弃声明级静态身份，运行时 `SymbolId` 不变。            |
| 精确对象形状兼容      | `PointA -> PointB`                 | 对象形状、属性类型和权限满足对象规则。                    |
| 可变到只读视图        | `Mutable -> Readonly`              | 只减少写权限，不冻结对象，不复制对象。                    |
| 派生类到基类          | `Derived -> Base`                  | 仅由静态 `extends` 建立，具体布局和动态派发由类规范定义。 |
| `never` 到任意类型    | `never -> T`                       | 不可达表达式没有运行时值。                                |
| 联合类型上位规则      | `S -> A \| B` 等                   | 由本规范的联合兼容规则组合得到。                          |

其他类型能力可以增加新的赋值兼容关系。新增零成本子类型关系必须保持运行时表示不变；新增有界表示构造必须同时满足无失败、无隐藏堆分配、无对象复制、无运行时类型检查，并在对应能力规范和 Typed IR 中明确记录。

## 不属于隐式兼容的情况

以下行为必须显式表达，不能通过赋值兼容自动发生：

| 场景               | 原因                               | 示例                           |
| ------------------ | ---------------------------------- | ------------------------------ |
| 数值表示转换       | 可能改变宽度、精度、舍入或溢出行为 | `number -> i32`                |
| 对象形状裁剪       | 需要丢弃字段或重建目标对象形状     | `{ x, y, label } -> { x, y }`  |
| 精确对象形状扩展   | 需要新增固定字段或提供默认值       | `{ x } -> { x, y }`            |
| 只读到可变         | 会增加源类型未提供的写权限         | `Readonly -> Mutable`          |
| 基类到派生类       | 需要运行时类型检查                 | `Animal -> Dog`                |
| 联合类型运行时收窄 | 需要证明当前成员                   | `string \| number -> string`   |
| 接口到精确对象     | 不能从多态视图恢复唯一具体形状     | `PointContract -> PointObject` |
| 动态值打包         | 需要写入类型标记并可能装箱         | `T -> unknown`                 |
| 任意内存重解释     | 破坏类型和 ABI 安全                | `ptr -> object`                |

这些操作应分别使用显式数值转换 API、目标对象构造、动态值打包、运行时收窄、`instanceof` 或未来独立的 `unsafe` 能力表达。

## 对象兼容

普通对象采用精确结构兼容。没有显式继承关系时，源类型和目标类型必须具有相同的属性集合；属性声明顺序不影响兼容。

```ts
type PointA = {
  x: i32;
  y: i32;
};

type PointB = {
  y: i32;
  x: i32;
};

const a: PointA = { x: 1, y: 2 };
const b: PointB = a; // 合法：规范化后的对象形状兼容
```

额外属性不会被自动丢弃：

```ts
type LabeledPoint = {
  x: i32;
  y: i32;
  label: string;
};

const labeled: LabeledPoint = {
  x: 1,
  y: 2,
  label: "A",
};

const point: PointA = labeled; // 编译错误：对象形状不同
```

需要得到目标形状时，程序必须显式构造新对象：

```ts
const point: PointA = {
  x: labeled.x,
  y: labeled.y,
};
```

## 接口兼容

接口是结构化多态契约，不沿用精确对象的“属性集合必须相同”规则。具体对象或类只要满足目标接口的全部成员、类型和权限要求，就可以赋给该接口；额外成员保留在底层对象中，不被裁剪或复制。

```ts
interface PointView {
  x: i32;
  y: i32;
}

const view: PointView = labeled; // 合法：保留 labeled 对象及其 label 字段
```

该转换生成 `InterfacePack(dataRef, witnessRef)`。见证表由编译器静态生成，转换不得扫描成员、分配堆对象、复制字段或失败。接口到上位接口可以生成 `InterfaceRepack`；已知见证时允许优化为寄存器组合或完全消除。

接口不能隐式转换为精确对象。接口之间的结构满足关系、可选属性存储、方法派发和标量限制由 T29 定义。

## 字典兼容

匿名精确对象和目标为精确对象的类型别名，在成员满足索引值与权限约束时可以进入字典位置。该转换生成 `DictionaryPack(dataRef, witnessRef)`，保留原对象身份，不扫描、复制或裁剪字段，也不在转换时分配扩展表：

```ts
type User = {
  name: string;
};

const user: User = { name: "Tom" };
const dict: { [key: string]: string } = user;

dict === user; // true
```

接口和类只有显式声明对应索引签名时才能形成字典视图；普通接口或类不能仅凭有限成员结构自动满足索引签名。该限制保持 TypeScript strict 的源码兼容边界，也避免为未声明动态能力的类引入开放布局。

字典不能隐式转换为精确对象。可写字典值类型保持不变；可写字典可以零复制形成对应只读视图，反向转换被拒绝。缺失读取、数组只读数值视图、对象扩展表和完整字典兼容规则由 T30 定义。

## `readonly` 单向兼容

`readonly` 是浅层、编译期写权限限制。可变对象可以零成本转换为对应只读视图：

```ts
type MutablePoint = {
  x: i32;
  y: i32;
};

type ReadonlyPoint = {
  readonly x: i32;
  readonly y: i32;
};

const mutable: MutablePoint = { x: 1, y: 2 };
const view: ReadonlyPoint = mutable; // 合法
```

该兼容不复制对象，也不冻结对象。通过其他可变引用写入的变化仍可通过只读视图观察到。

只读视图不能赋给可变目标，类型断言也不能获得源类型未提供的写权限：

```ts
const writable: MutablePoint = view; // 编译错误
const asserted = view as MutablePoint; // 编译错误
```

## 类继承兼容

- 小节结论：已定

类实例类型采用名义身份。只有静态 `extends` 建立派生类到基类的兼容关系：

```ts
class Animal {}
class Dog extends Animal {}

const dog = new Dog();
const animal: Animal = dog; // 合法
```

字段结构相同的两个无继承关系类不兼容。基类到派生类不属于赋值兼容，必须通过运行时收窄规则证明：

```ts
const requireDog = (animal: Animal) => {
  const dog: Dog = animal; // 编译错误
};
```

类字段布局、虚方法表、`super`、`instanceof` 和跨模块 ABI 由类类型与类型 ABI 规范定义。

类到接口的结构实现由 T29 定义；类字段布局、基类子对象、方法覆盖、构造函数和类动态派发由 T36 定义，`this` 类型与 `super` 接收者由 T56 定义。

## 字面量兼容

字面量类型可以赋给对应的基础类型或对应能力明确允许的上位类型：

```ts
const status: "ready" = "ready";
const text: string = status; // 合法
```

字面量类型与基础类型不相等；兼容方向只从更窄的字面量类型指向更宽的基础类型。基础类型不能隐式赋给字面量类型，除非 checker 已经通过常量推导或控制流分析证明其值满足目标字面量类型。

```ts
const requireReady = (text: string) => {
  const status: "ready" = text; // 编译错误
};
```

数字字面量与 `number`、原生数值类型之间的默认类型、上下文推导和越界诊断由字面量类型和数值类型规范定义。

`unique symbol` 使用相同的单向规则：具体 `typeof token` 可以零成本赋给 `symbol`，宽 `symbol` 不能隐式赋给具体 token 类型。严格身份比较也不能从宽 `symbol` 恢复已经丢弃的声明身份；checker 只对有限 `unique symbol` 联合排除已判断成员，不能通过 `as` 或整数转换伪造身份。

## 品牌类型兼容

T28 的 `Brand<T, Tag>` 是 `T` 的静态下位类型。品牌值可以零成本赋给底层类型；底层类型不能隐式获得品牌：

```ts
type UserId = Brand<i64, "UserId">;
type OrderId = Brand<i64, "OrderId">;

const checkBrand = (userId: UserId, raw: i64) => {
  const value: i64 = userId; // 合法：丢弃静态品牌
  const restored: UserId = raw; // 编译错误：底层类型不能隐式获得品牌
  const orderId: OrderId = userId; // 编译错误：标签不同
};
```

相同底层类型和相同规范标签的品牌按 T02 视为类型相等。不同品牌之间不建立直接兼容；显式转换必须先回到底层类型，再按 T28、T43 的规则建立目标品牌。以上关系不生成 Typed IR 转换节点。

## 数值类型兼容

- 小节结论：已定

`number` 与 `f64` 是不同语义类型，不相等，也不互相隐式兼容。`number` 承诺 JavaScript Number 语义，`f64` 是 Nxts 原生浮点类型；即使二者在某个后端都可能使用相同底层表示，checker 也不能根据运行时或 LLVM 表示反推语言类型关系。

```ts
const requireNative = (value: number) => {
  const native: f64 = value; // 编译错误：需要显式数值转换
};
```

`number -> f64`、`f64 -> number`、`number -> i32` 和不同原生数值类型之间的转换均不属于赋值兼容。数值转换必须通过数值类型规范定义的显式 API 表达，并明确舍入、越界、`NaN`、无穷值和失败模型。

## 空值兼容

- 小节结论：已定

Nxts 采用严格空值兼容。`null` 只兼容 `null` 或包含 `null` 的联合类型；`undefined` 只兼容 `undefined` 或包含 `undefined` 的联合类型。

```ts
const checkNullish = (text: string, missing: undefined) => {
  const a: string | undefined = missing; // 合法
  const b: string = missing; // 编译错误
  const c: string | null = text; // 合法
};
```

`T | undefined` 与可选属性 `value?: T` 不是同一语义。前者表示属性或变量的值可以为 `undefined`；后者还包含对象属性是否存在的可观察状态，具体规则由对象类型规范定义。

`void` 与 `undefined` 不相等，也不互相赋值兼容。`void` 返回位置允许 `return undefined;` 是返回语句的专用规则，不构成普通类型兼容关系。

## 联合类型兼容

- 小节结论：已定

联合类型兼容只定义公共上位规则，联合构造、归一化、运行时布局和 tag 策略由联合类型规范定义。

```text
S -> A | B
```

当 `S` 兼容 `A` 或兼容 `B` 时成立。

```text
A | B -> T
```

当 `A` 和 `B` 都兼容 `T` 时成立。

```text
A | B -> C | D
```

当源联合的每个成员都能兼容目标联合中的至少一个成员时成立。

联合兼容规则不能引入运行时收窄。将 `A | B` 当作 `A` 使用，必须通过控制流分析、判别字段、`typeof`、`instanceof` 或其他已定义的运行时检查证明。

如果某个表面联合兼容需要运行时包装、tag 初始化、payload 重排或 ABI 适配，该关系不能作为 `AssignableNoOp` 处理。联合类型规范可以在不破坏本规范公共上位规则的前提下，为具体联合表示定义显式 IR 节点或收紧可作为零成本赋值兼容的范围。

## 容器只读视图兼容

- 小节结论：已定

T03 不为所有容器声明统一兼容关系。数组和元组已经分别在 T34、T35 确定可变到只读的零成本视图转换；用户泛型容器仍由对应规范定义。

容器能力如果要增加 `MutableContainer<T> -> ReadonlyContainer<T>` 之类的兼容关系，必须同时证明以下条件：

- 转换不复制容器、不重新分配存储、不改变元素布局。
- 只读视图不能获得源类型未提供的写权限。
- 元素类型方差规则保持静态安全。
- 长度、索引越界、别名写入和逃逸行为不会破坏可观察语义。
- 跨模块 ABI 能够稳定表达源容器和目标只读视图的关系。

数组具体规则为：`T[] -> readonly T[]` 零成本允许，可变数组保持不变，反向获得写权限被拒绝；只读数组的元素协变还必须是无操作且机器布局相同。元组同样允许 mutable 到相同布局 readonly 的零成本视图，可写位置保持不变，readonly 位置只允许同布局逐位置协变；同构元组仅能零成本形成 readonly 数组视图。完整规则见 [`21-arrayTypes.md`](./21-arrayTypes.md) 和 [`22-tupleTypes.md`](./22-tupleTypes.md)。其他容器在对应能力规范确定前，checker 不得根据名称相似或 TypeScript 标准库习惯自动接受只读视图兼容。

## 函数类型兼容

- 小节结论：已定

函数类型采用严格兼容原则，不复制 TypeScript 为历史兼容保留的参数双变宽松规则。

函数返回值按协变检查：源函数返回值必须兼容目标函数返回值。函数参数按逆变检查：目标函数可能传入的参数，源函数必须都能安全接受。

```text
source: (SourceParam) -> SourceReturn
target: (TargetParam) -> TargetReturn

source 兼容 target 当且仅当：
  TargetParam -> SourceParam
  SourceReturn -> TargetReturn
```

返回协变还必须满足无隐藏动态成本的函数 ABI。相同表示直接复用调用入口；只需要本规范允许的 `InterfacePack`、`InterfaceRepack`、`UnionInject` 或 `UnionRepack` 时，可以由 T32 选择无失败、有界且不分配的静态类型化入口。需要装箱、堆分配、对象复制或运行时检查的返回转换不构成函数兼容。普通 `never` 表达式可以兼容任意目标值类型，但已有 `(...P) => never` 函数值只直接兼容返回 `never` 或 `void` 且参数关系满足上述规则的目标函数；转换到需要返回值载荷的函数类型必须显式包装。`void` 的上下文回调和 `never` 的完整规则分别由 T15、T16 定义。

可选参数、默认参数、rest 参数、重载、方法参数和 `this` 参数的完整规则由函数类型规范定义，但不得引入会破坏静态安全或隐藏运行时成本的宽松兼容。

## 编译器职责

checker 在判断赋值兼容时应记录兼容类别，供诊断、测试和后续 IR 阶段使用：

```text
AssignableNoOp
├─ EqualType
├─ AliasExpansion
├─ BrandToBase
├─ LiteralToBase
├─ ExactObjectShape
├─ MutableToReadonlyView
├─ DerivedToBase
├─ NeverToTarget
└─ UnionSupertype

AssignableRepresentation
├─ InterfacePack
├─ InterfaceRepack
├─ UnionInject
├─ UnionRepack
└─ FunctionEntrySelect
```

`AssignableNoOp` 不生成 Typed IR 转换节点。`AssignableRepresentation` 只包含规范明确允许的无失败、有界且不分配的隐式表示构造。`FunctionEntrySelect` 只选择或按需生成 T32 定义的精确静态调用入口，不能创建新函数身份、动态实参数组或通用分派器。其他需要运行时代码的行为不得伪装为赋值兼容，必须以显式 `RepresentationConvert`、`ObjectConstruct` 或 `CheckedNarrow` 等节点进入 Typed IR。

诊断应说明拒绝原因和可用写法。例如对象形状不同应提示显式构造目标对象，而不是建议使用 `as` 绕过检查。

## 与 TypeScript 的兼容性

- 小节结论：已定

Nxts 是 TypeScript 的严格静态子集：所有被 Nxts 接受的源码都必须保持 TypeScript 语法可解析；在工具链提供 Nxts 内建类型声明后，也必须通过 TypeScript 类型检查。`i32`、`f64` 等 Nxts 原生类型由 Nxts 编译器内建识别；TypeScript 侧声明只属于开发者体验和外部工具适配，不决定本规范的类型语义或运行时行为。

性能仍然是第一目标。Nxts 可以比 TypeScript 更严格，拒绝 TypeScript 接受但无法静态高效编译的写法。赋值兼容不等同于 TypeScript 的 assignability；TypeScript 侧声明只保证源码可被 TypeScript 接受，不决定 Nxts 的类型身份、运行时表示、转换成本或 ABI。

被 Nxts 接受的 TypeScript/JavaScript 能力必须保持其可观察语义；如果某项 TypeScript 写法依赖宽结构赋值、动态 shape、隐藏复制、运行时检查或宽泛断言才能成立，Nxts 应在编译期拒绝，或要求程序使用显式构造、显式转换、运行时收窄或专门的动态容器类型表达。

这与 Rust 和 Go 的静态结构体模型更接近：字段更多的结构体不能隐式赋给字段更少的结构体；需要目标形状时，程序显式构造目标值。Nxts 保持 TypeScript 源码合法性，但对象兼容和转换成本采用更严格的静态编译边界。

当前已确定的差异包括：

| 场景           | TypeScript 倾向                  | Nxts 当前规则                                        |
| -------------- | -------------------------------- | ---------------------------------------------------- |
| 对象额外属性   | 变量形式通常可宽结构赋值         | 普通对象精确形状检查                                 |
| 对象字面量特例 | 新鲜对象字面量有额外属性检查     | 不区分新鲜对象和变量                                 |
| 对象裁剪       | 可将多字段对象作为少字段结构使用 | 必须显式构造目标对象形状                             |
| 接口结构赋值   | 结构满足即可，运行时类型擦除     | 结构满足即可，形成接口视图                           |
| `as` 断言      | 可表达较宽泛的静态断言           | 普通断言拒绝；只保留 `as const` 和零成本品牌建立     |
| 品牌类型       | 通常以幻象属性交叉表达           | 只接受标准零成本品牌规则                             |
| 数值类型       | `number` 是主要数值类型          | 原生数值类型需要显式转换规则                         |
| 动态对象能力   | 可通过 JS 运行时模型表达         | 直接成员操作不改变 shape；T30 字典视图显式承载动态键 |
| 方法参数方差   | 方法保留历史双变兼容             | T32 对普通函数与方法统一使用严格逆变                 |
| 函数动态调用   | 提供 `call`、`apply`、`bind`     | T32 使用直接调用、箭头函数和静态 rest / spread       |

对象裁剪是 Nxts 与 TypeScript 的关键差异：

```ts
type User = {
  id: i32;
  name: string;
  email: string;
};

type UserSummary = {
  id: i32;
  name: string;
};

const rejectProjection = (user: User) => {
  const summary: UserSummary = user; // 编译错误：对象形状不同
};
```

如果 `summary` 仍引用原对象，`Object.keys(summary)` 等反射操作仍能观察到 `email`，静态类型和运行时可观察行为会分裂。如果隐式创建新对象，则赋值产生隐藏分配和复制，违反零成本兼容原则。因此 Nxts 不提供隐式对象裁剪。

需要目标形状时，程序必须显式构造：

```ts
const summarize = (user: User) => {
  const summary: UserSummary = {
    id: user.id,
    name: user.name,
  };
  return summary;
};
```

编译器可以在不改变引用身份、反射结果和可观察行为的前提下优化该构造，但源码层面必须明确表达对象重建。

Nxts 不支持 `satisfies`。parser 可以保留该 TypeScript 语法以产生准确诊断，但 checker 必须拒绝整个表达式，不能借其建立赋值兼容、保留字面量类型或绕过对象精确形状、`readonly` 写权限、数值显式转换和运行时收窄规则。无效表达式不得进入 Typed IR。

后续讨论 TypeScript 差异时，应以本规范的零隐藏分配原则和有界表示构造边界为基线，逐项决定某项能力是直接支持、编译期拒绝，还是要求显式写法。

## 下游规范事项

本规范的公共兼容边界已经确定。以下内容由对应能力规范继续细化，但不得突破 T03 的零成本子类型和有界表示构造边界：

| 能力                 | 下游规范职责                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| 数组、元组和泛型容器 | 定义容器只读视图、元素方差、长度和存储布局规则。                          |
| 联合类型             | 定义联合归一化、成员去重、tag 表示、payload 布局和 ABI。                  |
| 类型别名与品牌       | 定义品牌身份、明确建立方式、标准库声明和运行时擦除。                      |
| 接口                 | 定义结构契约、见证表、接口打包、可选属性存储和接口间转换。                |
| 字典                 | 定义索引签名、对象字典视图、缺失读取、动态扩展和权限约束。                |
| 函数                 | 定义精确参数数量、严格方差、接收者和无隐藏动态成本的类型化调用入口。      |
| 类类型               | 定义字段布局、接口实现、方法覆盖、动态派发、`instanceof` 和跨模块类 ABI。 |
