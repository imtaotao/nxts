# 类型格

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-22
- 文档顺序：4

## 目标

定义 Nxts 类型系统中的上下界关系，以及 checker 在条件表达式、分支合并、联合构造、返回值推导和泛型约束等场景中如何计算公共类型。

子类型与赋值兼容见 [`3-typeCompatibility.md`](./3-typeCompatibility.md)，特殊类型见 [`11-specialTypes.md`](./11-specialTypes.md)，联合类型的完整构造和运行时表示见 [`13-unionTypes.md`](./13-unionTypes.md)。

## 核心原则

Nxts 类型格不提供宽松顶层类型作为默认逃生口。公共上界必须是当前语言能够表达、checker 能够验证、并且不会改变运行时语义的类型。

当多个类型无法通过类型相等、子类型或已定义的零成本兼容关系合并时，checker 使用联合类型表示公共上界；如果当前位置尚不能使用联合类型，则产生诊断，而不是退化为 `any`、`unknown` 或隐式动态值。

```text
T1 与 T2 合并
  -> 存在明确上位类型：使用该上位类型
  -> 否则可构造联合：使用 T1 | T2
  -> 否则：诊断
```

类型格计算不能隐式执行数值提升、对象裁剪、对象重建、装箱、运行时 tag 检查或动态类型擦除。

## 术语

| 术语         | 含义                                         |
| ------------ | -------------------------------------------- |
| 下界         | 能赋值给当前类型的更窄类型。                 |
| 上界         | 当前类型能赋值到的更宽类型。                 |
| 最小公共上界 | 多个类型共同可赋值到的最窄上位类型。         |
| 最大公共下界 | 多个类型共同包含的最宽下位类型。             |
| 底类型       | 没有正常运行时值、可作为所有类型下界的类型。 |
| 顶层类型     | 所有普通值都可赋值到的类型。                 |

T04 主要定义最小公共上界。最大公共下界主要服务于控制流收窄、交叉类型和泛型约束，由对应能力规范细化。

## `never`

- 小节结论：已定

`never` 是底类型，表示不会正常产生值。它可以作为任意类型的下界，并可赋值给任意目标类型。

```ts
function fail(message: string): never {
  throw new Error(message);
}

const value: string = fail("missing"); // 合法
```

联合类型归一化时，`never` 成员被消去：

```text
T | never  =>  T
never | never  =>  never
```

当所有待合并分支的静态结果类型均为 `never` 时，表达式类型合并结果为 `never`。控制流合并点没有正常可达前驱时，该路径没有正常完成状态；这不会把内部含有终止子表达式、但自身静态结果类型为普通 `T` 的外层表达式改写为 `never`。静态类型与完成状态的边界由 T16 定义。

## 顶层类型

- 小节结论：已定

当前语言版本不提供普通值的全局顶层类型。

`any` 永久不支持，不进入类型格。它会绕过静态类型检查并迫使值操作进入动态执行路径；显式与隐式 `any` 均为编译错误。

`unknown` 作为显式安全动态值能力设计，不作为零成本公共上界或推导兜底。普通值进入 `unknown` 需要显式表示转换；类型格不能为完成合并而自动插入动态标记、装箱、GC 动态扫描或跨模块 ABI 转换。

在 T03 的零成本子类型和赋值兼容关系中，普通 `T` 不是 `unknown` 的子类型；只有 `unknown -> unknown` 和不产生值的 `never -> unknown` 属于无转换兼容。`unknown` 与普通类型不能直接构造混合联合，也不能通过 `T | unknown => unknown` 规则隐式改变分支表示。需要统一动态结果时，每个普通分支必须先显式打包为 `unknown`。

因此，不同类型合并时不能退化为 `any` 或 `unknown`：

```ts
const value = flag ? "ready" : 1;
// 推导为 string | number，而不是 unknown 或 any
```

## `void`

- 小节结论：已定

`void` 不作为普通值类型参与类型格，不是 `undefined` 的别名，也不是任意返回值的上界。

`void` 只用于函数或异步操作的返回结果位置。条件表达式、变量、属性、参数和联合成员中需要表达缺失值时，应使用 `undefined` 或包含 `undefined` 的联合类型。

```ts
type Result = string | void; // 编译错误，使用 string | undefined
```

函数返回推导中，`void` 的规则由特殊类型与函数类型规范共同定义；T04 不将 `(): T` 到 `(): void` 视为类型格中的上界关系。

## 空值类型

- 小节结论：已定

`null` 与 `undefined` 是相互独立的原子类型，可以单独作为类型和值存在。

```ts
const empty: null = null;
const missing: undefined = undefined;
```

它们不会自动赋给其他普通类型，也不会作为其他普通类型的隐式下界或上界。需要让空值或缺失值与其他类型共存时，必须显式构造联合类型。

```text
lub(T, null)       => T | null
lub(T, undefined)  => T | undefined
lub(null, undefined) => null | undefined
```

`null` 和 `undefined` 不能隐式并入不包含对应成员的目标类型。空值收窄、`??`、可选链和相等判断由空值与控制流分析规范定义。

## 字面量类型

- 小节结论：已定

字面量类型是对应基础类型或原生标量类型的下位类型。

```text
StringLiteral("ready") <= string
BooleanLiteral(true) <= boolean
NumericLiteral(i32, 1) <= i32
NumericLiteral(f64, 1.0) <= f64
NumericLiteral(number, 1.0) <= number
UniqueSymbol(token) <= symbol
```

同一基础类型下的多个字面量合并时，优先保留为字面量联合；如果上下文要求基础类型，或推导规则需要 widening，则使用对应基础类型。

```ts
const a = flag ? "on" : "off";
// 无上下文时可推导为 "on" | "off"

const b: string = flag ? "on" : "off";
// 上下文类型为 string
```

数字字面量默认类型、负数字面量、`-0` 和浮点特殊值的规范化由字面量类型与数值类型规范定义。

T04 只规定类型格中的默认合并方向：无上下文时优先保留字面量联合。变量声明、返回值推导、对象属性推导和 `as const` 等具体 widening 时机由类型推导和字面量类型规范定义。

不同 `unique symbol` 类型的公共结果优先保留为明确联合；存在宽 `symbol` 上位候选或上下文要求 `symbol` 时合并为 `symbol`。这些关系只丢弃静态身份信息，不改变运行时表示。

品牌类型沿用 T03 的单向下位关系。`Brand<T, Tag>` 与 `T` 合并时可以使用 `T` 作为公共上界；不同标签的品牌在没有底层 `T` 上下文时保留为明确联合，不因运行时表示相同而丢失静态身份：

```text
lub(Brand<T, A>, T) => T
lub(Brand<T, A>, Brand<T, B>) => Brand<T, A> | Brand<T, B>
```

## 基础类型与原生数值类型

- 小节结论：已定

不同基础类型之间没有隐式公共基础上界。合并时使用联合类型：

```text
lub(string, number) => string | number
lub(boolean, string) => boolean | string
```

`number` 与 `f64` 是不同语义类型。二者不因底层表示可能相同而合并为同一类型，也不互相作为上界：

```text
lub(number, f64) => number | f64
```

不同原生数值类型之间不做隐式提升：

```text
lub(i32, i64) => i32 | i64
lub(i32, u32) => i32 | u32
```

需要数值提升、舍入或表示转换时，必须使用数值类型规范定义的显式转换或运算规则。

## 对象类型

- 小节结论：已定

普通对象使用精确形状。两个对象类型相等或满足已定义零成本视图关系时，可以使用该上位类型；否则公共上界为联合类型，不裁剪公共字段。

```ts
type Point = {
  x: i32;
  y: i32;
};

type LabeledPoint = {
  x: i32;
  y: i32;
  label: string;
};

const choosePoint = (flag: boolean, point: Point, labeled: LabeledPoint) => {
  const value = flag ? point : labeled;
  // 推导为 Point | LabeledPoint，而不是 { x: i32; y: i32 }
};
```

将多个对象合并为公共字段对象会隐式裁剪形状，破坏 T03 的零成本兼容原则。因此 checker 不通过字段交集自动构造对象公共上界。

可变对象与对应只读视图合并时，可以使用只读视图作为公共上界：

```text
lub(MutablePoint, ReadonlyPoint) => ReadonlyPoint
```

该规则只适用于已由对象规范证明的浅层只读视图兼容。

## 接口契约

- 小节结论：已定

checker 不根据若干对象的公共字段自动搜索或合成接口契约。没有上下文类型时，不同精确对象仍按前述规则合并为联合。

存在显式接口上下文时，每个分支可以分别按 T29 检查并形成目标接口视图：

```ts
interface PointView {
  x: i32;
  y: i32;
}

const value: PointView = flag ? point : labeled;
// 两个分支分别满足 PointView
```

已有候选中包含接口契约，且其他候选都能按 T29 静态转换为该接口时，可以选择该接口作为公共上界。两个接口类型合并时，如果其中一个契约是另一个契约的有效上位接口，则选择该上位接口；否则保留规范联合，不合成新的匿名公共契约。

```text
lub(ConcretePoint, PointInterface) => PointInterface
lub(ChildInterface, BaseInterface) => BaseInterface
lub(InterfaceA, InterfaceB)        => InterfaceA | InterfaceB
```

接口上位合并可以生成 `InterfacePack` 或 `InterfaceRepack`，但不得产生对象复制、成员扫描、堆分配或运行时失败。具体结构满足和表示规则由 T29 定义。

## 字典类型

- 小节结论：已定

checker 不根据若干精确对象的公共值类型自动合成字典。存在显式字典上下文时，每个候选分别按 T30 检查并形成原生字典或 `DictionaryPack`；已有候选本身是字典，且其他候选都能无失败进入该字典时，可以选择该字典作为公共上界。

可写字典在值类型上不变。两个不同值类型的可写字典默认合并为规范联合，不能合成为可写的公共值字典。只读字典只有在键域相同、值类型存在零成本公共上界且 T38 允许协变时，才可以合并为只读字典上位类型。

```text
lub(Dict<K, V>, ReadonlyDict<K, V>) => ReadonlyDict<K, V>
lub(Dict<K, A>, Dict<K, B>)         => Dict<K, A> | Dict<K, B>
lub(StringDict<V>, NumberDict<V>)   => NumberDict<V>
```

字典合并不能产生对象复制、逐条重建、值装箱或逐次读取转换。完整索引签名、对象字典视图和只读边界由 [`18-dictionaryTypes.md`](./18-dictionaryTypes.md) 定义。

## 类类型

- 小节结论：已定

类实例类型采用名义身份。两个类存在共同静态基类时，checker 可以选择最近公共静态基类作为公共上界；否则使用联合类型。

```ts
class Animal {}
class Dog extends Animal {}
class Cat extends Animal {}

const chooseAnimal = (flag: boolean, dog: Dog, cat: Cat) => {
  const animal = flag ? dog : cat;
  // 可推导为 Animal
};
```

无继承关系的类即使字段结构相同，也不共享结构上界：

```text
lub(A, B) => A | B
```

如果类 ABI 或基类子对象布局尚未定义到能够保证 `Derived -> Base` 为零成本视图，则类类型规范可以收紧具体场景的上界推导。

T04 的默认规则是优先选择最近公共静态基类。该规则依赖 T03 的 `Derived -> Base` 兼容关系；类规范若发现某类继承场景不能满足零成本基类视图，必须在对应场景中禁用该公共上界推导。

## 联合类型

- 小节结论：已定

联合类型是类型格中表达有限公共上界的主要机制。

```text
lub(A, B) => normalize(A | B)
lub(A | B, C) => normalize(A | B | C)
lub(A | B, B | C) => normalize(A | B | C)
```

联合归一化至少应满足：

- 展开嵌套联合。
- 删除 `never` 成员。
- 合并语义相等的成员。
- 删除已经被其他成员覆盖的下位类型，例如 `"ready" | string => string`。

联合成员排序、类型指纹和一般运行时表示由 [`13-unionTypes.md`](./13-unionTypes.md) 定义；精确 tag、payload 布局和跨模块 ABI 由 T45–T47 定义。

## 交叉类型与最大公共下界

- 小节结论：已定

交叉类型可以在已经定义下位关系的类型类别中表达最大公共下界，完整规则见 [`14-intersectionTypes.md`](./14-intersectionTypes.md)：

```text
存在满足 T03 的公共下位关系时：
  glb(A, B) => normalize(A & B)
```

普通分支合并和返回推导计算最小公共上界，仍使用本规范的上位类型或 T21 联合规则，不得误用交叉类型缩小实际可能值集合。控制流、泛型约束或类型运算明确需要最大公共下界时，checker 只能依据已有下位关系构造规范交叉，并必须在运行时值进入 Typed IR 前得到具体类型。

普通对象交叉是源码显式请求的新精确形状组合，不建立到组成形状的隐式投影，因此不是对象赋值类型格的公共下界。checker 不能为了下界计算自动合并不同属性集合，也不能借对象交叉绕过 T03 的对象裁剪禁令。一般函数交叉不作为重载入口；无关类、容器和泛型实例只能按各自能力已经定义的下位关系处理。

## 编译器职责

checker 在执行类型格计算时应记录选择原因：

```text
LatticeJoin
├─ SameType
├─ SubtypeSupertype
├─ LiteralWidening
├─ MutableToReadonlyView
├─ CommonInterfaceContract
├─ CommonBaseClass
├─ UnionConstruct
└─ DiagnosticNoJoin
```

`SameType`、`SubtypeSupertype`、`LiteralWidening`、`MutableToReadonlyView` 和 `CommonBaseClass` 不生成运行时代码。`CommonInterfaceContract` 必要时生成 T29 的 `InterfacePack` 或 `InterfaceRepack`；联合构造需要运行时表示变化时使用 T21 定义的 `UnionInject` 或 `UnionRepack`。这些节点必须在 Typed IR 中明确保留。

诊断应说明无法合并的原因。例如联合类型不可用的位置，不应退化为 `unknown`，而应提示需要显式类型注解、显式分支处理或等待对应能力支持。

## 与 TypeScript 的兼容性

- 小节结论：已定

Nxts 是 TypeScript 的严格静态子集，但不完整复刻 TypeScript 的类型格与最佳公共类型推导。所有被 Nxts 接受的源码都必须保持 TypeScript 语法可解析；在工具链提供 Nxts 内建类型声明后，也必须通过 TypeScript 类型检查。`i32`、`f64` 等 Nxts 原生类型由 Nxts 编译器内建识别，TypeScript 侧声明由后续开发者体验和工具链规范处理。该子集承诺约束源码接受范围，不要求原生类型的运行时表示和行为完全等同 JavaScript。

性能仍然是第一目标。T04 的目标是为静态编译提供可表达、可验证、无隐藏成本的公共类型；TypeScript 的部分推导规则服务于 JavaScript 生态兼容和开发便利，不能直接作为 Nxts 的默认行为。

Nxts 不使用 `any` 或 `unknown` 作为类型格兜底，也不通过宽结构对象、对象字段交集、隐式数值提升或 `void` 返回适配合成公共上界。

| 场景              | TypeScript 倾向                | Nxts 当前规则                              |
| ----------------- | ------------------------------ | ------------------------------------------ |
| 不同基础类型合并  | 可能推导联合或受上下文影响     | 使用联合，不退化为顶层动态类型             |
| 对象公共字段      | 可通过结构类型表达公共字段需求 | 不自动裁剪为公共字段对象                   |
| 接口公共契约      | 可能通过结构最佳公共类型推导   | 只使用显式上下文或已经存在的接口上位关系   |
| `void`            | 回调返回值兼容较宽松           | `void` 不作为普通值格上界                  |
| `any` / `unknown` | 可作为顶层或逃生口             | `any` 永久拒绝；`unknown` 需要显式动态转换 |
| 数值类型          | 主要围绕 `number`              | 原生数值类型之间不隐式提升                 |
| 字面量合并        | 常受 widening 和上下文推导影响 | 无上下文类型格优先保留字面量联合           |
| 类实例合并        | 结构兼容影响较大               | 名义继承下可选最近公共静态基类，否则联合   |

### 对象公共上界

TypeScript 的结构类型系统容易让公共字段成为可用视图：

```ts
type Point = {
  x: i32;
  y: i32;
};

type LabeledPoint = {
  x: i32;
  y: i32;
  label: string;
};

const choosePoint = (flag: boolean, point: Point, labeled: LabeledPoint) => {
  const value = flag ? point : labeled;
};
```

Nxts 不把 `value` 推导为 `{ x: i32; y: i32 }`。该推导会把对象形状裁剪伪装成类型合并，导致静态类型与 `Object.keys` 等可观察行为分裂，或迫使编译器生成隐藏对象重建。Nxts 使用 `Point | LabeledPoint` 表达真实运行时可能性。

### 顶层类型兜底

TypeScript 中 `any` 和 `unknown` 可以作为复杂场景的逃生口。Nxts 永久拒绝 `any`，且不把 `unknown` 作为隐式公共上界，因此公共上界计算失败时只能构造明确联合或报错，不能把值隐式擦除成动态表示。

### 数值合并

TypeScript 的数值世界主要围绕 `number`。Nxts 同时存在 `number` 和原生数值类型，类型格不做隐式数值提升：

```text
lub(i32, i64) => i32 | i64
lub(number, f64) => number | f64
```

二元运算、显式转换和目标平台相关提升规则由数值类型规范定义，不能由 T04 在类型合并时提前执行。

### `void`

TypeScript 允许一些返回值被赋给 `void` 返回位置的宽松模式。Nxts 不把 `void` 当成“忽略任意返回值”的普通上界。忽略函数调用结果是表达式语句规则；需要 `() => void` 回调时，应显式包装。新建箭头函数获得 `void` 上下文类型时可以使用简洁表达式体，表达式结果直接丢弃，不构成 `(): T` 到 `(): void` 的函数类型转换。

### 字面量保留

无上下文类型格合并优先保留字面量联合：

```ts
const mode = flag ? "on" : "off";
// "on" | "off"
```

是否在变量、对象属性、函数返回值或泛型推导中 widening 到 `string`，由类型推导和字面量规范细化。T04 不把 widening 作为公共上界计算的默认兜底。

TypeScript 兼容讨论应以 T03 的零成本子类型、有界接口表示构造和 T04 的显式联合上界为基础。若某项 TypeScript 写法需要隐藏装箱、运行时检查、对象裁剪或动态顶层类型才能成立，Nxts 应拒绝或要求显式写法。

## 下游规范事项

本规范定义公共类型格边界。以下内容由对应能力规范继续细化：

| 能力       | 下游规范职责                                                |
| ---------- | ----------------------------------------------------------- |
| 联合类型   | 完整归一化、成员排序、运行时 tag、payload 布局和 ABI。      |
| 控制流分析 | `never` 推导、空值收窄、穷尽检查和分支合并。                |
| 字面量类型 | widening 时机、`as const`、负数字面量和数字字面量默认类型。 |
| 接口       | 结构上位关系、上下文打包、见证表和接口联合表示。            |
| 字典       | 索引签名、对象字典视图、缺失读取、权限和表示约束。          |
| 类类型     | 最近公共基类、接口实现、基类子对象布局和动态派发约束。      |
| 泛型       | 约束求解、符号交叉实例化、单态化和代码共享策略。            |
