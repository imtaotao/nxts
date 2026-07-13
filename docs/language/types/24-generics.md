# 泛型与方差

- 覆盖能力：T37、T38
- 规范状态：已定稿
- 文档顺序：24

## 目标与边界

本规范定义泛型参数、作用域、约束、默认值、推导、结果位置、方差、泛型函数值及闭合实例的静态规则，使 TypeScript 常用泛型写法能够在不引入动态泛型类型的前提下完成检查。

泛型的首要目标是复用静态算法，不是建立运行时动态类型系统。普通泛型调用不得因为使用类型参数而增加装箱、类型描述、哈希查找、隐藏字典或运行时泛型分派。

推导、实例图和方差求解实现见 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)，闭合布局见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，单态化与代码共享见 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)，跨模块配方见 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)。

以下能力由其他规范定义：

| 能力                                        | 规范归属         |
| ------------------------------------------- | ---------------- |
| 公共推导、类型格、字面量和联合规范化        | T04–T05、T20–T21 |
| `void`、`never`、`unknown` 和 `any` 边界    | T15–T17          |
| 递归类型与无界类型增长                      | T31              |
| 函数、重载、数组、元组和类的基础契约        | T32–T36          |
| `keyof`、条件类型、`infer` 和 `satisfies`   | T40–T42          |
| 精确布局、GC、跨模块 ABI 和标准库 intrinsic | T45–T49          |
| spread、调用、`await`、迭代和闭包环境       | T52–T53、T58–T60 |
| 名称、作用域与声明绑定                      | T57              |

## 核心原则

| 原则             | 约束                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| 声明期检查       | 泛型声明基于类型参数及其约束检查一次，不采用 C++ 模板式的实例化后试错。                           |
| 闭合实例         | 进入 Typed IR、布局和调用 ABI 前，所有运行时类型实参必须具体确定。                                |
| 静态专门化       | 表示或语义不同时生成独立实现；只有安全等价时共享机器码。                                          |
| 普通路径零成本   | 普通泛型调用不携带运行时类型参数、字典、统一盒或动态查找。                                        |
| 显式动态局部付费 | 只有一等多态函数值和接口泛型方法的动态调用使用固定专门化槽位。                                    |
| 身份与入口分离   | 函数和类的逻辑身份不因类型化入口或专门化代码不同而改变。                                          |
| 方差零运行时     | 方差只确定静态兼容方向，不进入值布局、GC 描述或运行时检查。                                       |
| TS 静态子集      | 推导主流程和源码语法尽量保持 TypeScript；动态兜底可以被拒绝，不能接受 TypeScript 无法检查的源码。 |
| 确定失败         | 无候选、无界增长和资源超限必须诊断，不能静默退化为动态泛型。                                      |

## 支持的声明位置

泛型参数可以声明在以下位置：

| 声明位置             | 示例                                           |
| -------------------- | ---------------------------------------------- |
| 函数声明             | `function id<T>(value: T): T`                  |
| 函数表达式和箭头函数 | `const id = <T>(value: T): T => value`         |
| 类声明和类表达式     | `class Box<T> {}`                              |
| 接口和类型别名       | `interface Box<T> {}`、`type Pair<T> = [T, T]` |
| 实例方法和静态方法   | `map<U>(fn: (value: T) => U): U[]`             |
| 接口方法与纯调用签名 | `map<T>(value: T): T`、`<T>(value: T): T`      |
| 构造签名             | `new <T>(value: T): Box<T>`                    |
| 函数和方法重载签名   | 每个公开候选拥有自己的参数列表                 |

类构造器不能声明独立的 `constructor<T>`；泛型构造由类参数或构造签名表达。getter、setter 和静态初始化块不能声明自己的类型参数。静态方法不能引用类实例侧类型参数，但可以声明自己的参数：

```ts
class Box<T> {
  static create<U>(value: U): Box<U> {
    return new Box(value);
  }

  constructor(public value: T) {}
}
```

字段初始化器中的泛型箭头函数合法，类型参数属于箭头函数而不是字段：

```ts
class Utilities {
  identity = <T>(value: T): T => value;
}
```

当前类型系统不支持高阶类型参数、类型构造器参数或类型构造器的部分应用。`F<T>` 中的 `F` 必须绑定到已知泛型声明，不能把 `Array`、`Promise` 等未实例化类型构造器作为普通类型实参传递。

## 参数作用域与名称

类型参数使用词法作用域：

- 同一参数列表中的名称不能重复。
- 约束和默认值只能引用当前参数之前声明的参数。
- 声明体、参数类型、返回类型和成员可以引用当前声明的参数。
- 嵌套泛型声明可以使用同名参数，并遮蔽外层类型参数。
- 类型参数只建立类型空间绑定，不建立可在表达式中读取的运行时值。
- 类静态成员不在类实例侧类型参数的可见使用范围内。

```ts
function convert<T, U extends Mapper<T> = DefaultMapper<T>>(
  value: T,
  mapper: U,
) {
  return mapper.map(value);
}

function invalid<T extends U, U>(value: T): T {
  return value;
}
// 编译错误：T 的约束引用了后声明的 U
```

parser 保留参数顺序、`const` 修饰、约束、默认值和源码位置；具体名称绑定由 T57 完成。

## 约束

### `extends` 上界

`extends` 可以使用当前已支持的具体类型、接口、基类、联合和合法接口交叉：

```ts
interface Named {
  name: string;
}

interface Timestamped {
  timestamp: i64;
}

function label<T extends Named>(value: T): string {
  return value.name;
}

function audit<T extends Named & Timestamped>(value: T): string {
  return `${value.name}:${value.timestamp}`;
}
```

多个能力使用交叉约束表达。对象交叉仍遵循 T22 的精确形状与冲突规则，不能借泛型约束绕过 T03 的对象兼容边界。

有限 F-bounded 约束合法：

```ts
interface Comparable<T> {
  compareTo(other: T): i32;
}

function compare<T extends Comparable<T>>(left: T, right: T): i32 {
  return left.compareTo(right);
}
```

约束图按 T31 使用符号回边表示。声明本身可以递归；实际需求产生无界新实例链时才诊断。

### 无约束参数

`<T>` 表示任意受支持且在当前位置合法的具体类型，不表示统一的运行时动态值。

为保持 TypeScript 常见泛型声明，`T extends unknown` 在直接泛型约束位置等价于无约束：

```ts
function identity<T extends unknown>(value: T): T {
  return value;
}
```

该特例不会建立普通 `T -> unknown` 的隐式赋值，也不会使 `unknown[]` 在普通值位置变成静态顶层数组。`T = unknown` 是实际默认类型实参，使用 T17 的动态表示和显式打包边界。

以下约束非法：

```ts
function unsafe<T extends any>(value: T): T {
  return value;
}

function unclear<T extends {}>(value: T): T {
  return value;
}
```

`any` 不属于有效类型集合。裸 `{}` 不是通用上界；需要成员能力时声明具体接口，需要无约束时直接使用 `<T>`。

`never` 满足普通上界约束，但实例化后仍遵守 T16 的不可构造规则。`void` 不能作为普通参数或存储类型绕过结果位置限制。

### 约束提供的能力

泛型声明体只能使用约束保证的能力：

```ts
function readName<T extends Named>(value: T): string {
  return value.name;
}

function invalid<T>(value: T): string {
  return value.name;
}
// 编译错误：T 未保证存在 name
```

无约束 `T` 只提供所有 Nxts 值都成立的基础操作：

| 操作                            | 结果                                 |
| ------------------------------- | ------------------------------------ |
| 赋值、传参和返回                | 合法，保持 `T`                       |
| `===`、`!==`                    | 合法，实例化后使用具体类型的严格相等 |
| `typeof`                        | 合法，实例化后选择具体实现或常量折叠 |
| 与 `null`、`undefined` 严格比较 | 合法，按 T23–T24 收窄                |
| 未受约束的属性或方法访问        | 编译错误                             |
| 算术、位运算和大小比较          | 编译错误                             |
| 隐式字符串转换                  | 编译错误，除非 T13 能确定唯一转换    |
| `new T`、`instanceof T`         | 编译错误；`T` 不是运行时值           |

对象 spread、动态调用、`await`、迭代和数组 spread 分别由 T52–T53、T59–T60 根据具体约束定义，不由无约束泛型自动获得。

### 原生数值约束

单一原生数值基础类型可以提供其已定义运算。结果使用基础数值类型，不承诺保持任意更窄的 `T`：

```ts
function add<T extends i32>(left: T, right: T) {
  return left + right;
}
// 返回 i32

function addExact<T extends i32>(left: T, right: T): T {
  return left + right;
}
// 编译错误：i32 不能承诺为任意更窄的 T
```

约束同时包含不同机器表示时，不开放对应算术、位运算或有序比较：

```ts
function addNative<T extends i32 | i64>(left: T, right: T) {
  return left + right;
}
// 编译错误：约束不能确定唯一机器表示和结果类型
```

该限制避免为泛型运算引入运行时表示分派。标准库可以由 T49 定义 TS 可声明的数值泛型能力或 intrinsic；其实现必须静态选择具体指令，不得使用运行时运算符字典、统一装箱或动态类型检查。公开名称不属于 T37。

## 声明体检查

泛型函数、方法和类成员在声明位置基于符号类型参数及其约束检查一次：

```ts
function add<T>(left: T, right: T) {
  return left + right;
}
// 编译错误：无约束 T 不支持 +
```

实例化阶段执行类型替换、约束验证、结果位置验证、归一化和布局检查，但不能把声明期非法操作变成合法。错误不能推迟到某个偶然调用点，也不能因当前程序尚未使用非法路径而忽略。

该规则允许模块单独检查和缓存泛型配方，并保证不同消费模块看到相同静态语义。

## 默认类型参数

默认类型参数对函数、类、接口和类型别名使用同一规则：

```ts
interface Result<T, E extends ErrorInfo = ErrorInfo> {
  value?: T;
  error?: E;
}
```

- 必选类型参数必须位于带默认值参数之前。
- 默认值在声明位置检查，并必须满足当前参数约束。
- 默认值只能引用前面声明的类型参数。
- 没有显式类型实参时，checker 先推导候选；无候选时才使用默认值。
- 一旦调用点提供任意显式类型实参，后续省略参数必须全部具有默认值。
- 显式参数之后的省略位置直接采用默认值，不继续从值实参推导。
- 不支持 `_` 占位、跳过中间参数或命名类型实参。

```ts
function pair<T, U = T>(left: T, right: U): [T, U] {
  return [left, right];
}

const inferred = pair("x", 1); // [string, i32]
const defaulted = pair<string>("x", "y"); // [string, string]

function required<T, U>(left: T, right: U): [T, U] {
  return [left, right];
}

required<string>("x", 1);
// 编译错误：U 没有默认值
```

类型引用省略全部实参时，只有所有必需参数都能使用默认值才合法。`Box` 不能隐式表示 `Box<unknown>`、`Box<any>` 或开放实例。

## 调用推导

### 推导顺序

没有显式类型实参时，checker 按以下顺序建立候选：

1. 普通值实参和接收者。
2. 已知参数候选提供的回调上下文类型。
3. 回调返回表达式。
4. 调用表达式的直接结果上下文。
5. 默认类型参数。
6. 约束验证、类型替换、规范化和布局合法性检查。

约束用于限制和验证候选，不在没有候选时伪造具体结果：

```ts
interface NamedFactory {
  <T extends Named>(): T;
}

function createWithoutCandidate(create: NamedFactory): void {
  const value = create();
  // 编译错误：无法推导 T；不会使用 Named 作为结果
}
```

结果上下文可以提供候选：

```ts
interface EmptyFactory {
  <T>(): T[];
}

function inferEmpty(empty: EmptyFactory): void {
  const names: string[] = empty(); // T = string
  const values = empty(); // 编译错误：无法推导 T
}
```

TypeScript 在无候选时可能使用 `unknown` 或约束兜底；Nxts 要求显式类型实参、直接上下文或默认值。

### 候选合并与字面量

多个候选不无条件使用 T04 构造联合。checker 使用 TypeScript 的候选优先级、声明位置和 widening 规则，并在支持范围内保持相同结果：

```ts
function identity<T>(value: T): T {
  return value;
}

function choose<T>(left: T, right: T): T {
  return left;
}

function pair<T>(left: T, right: T): T[] {
  return [left, right];
}

const exact = identity("on"); // "on"
const selected = choose("on", "off"); // "on" | "off"
const values = pair("on", "off"); // string[]
```

不同基础类别的候选不能仅为完成推导而合成为联合：

```ts
function rejectMixedCandidates(text: string, count: i32): void {
  pair(text, count);
  // 编译错误：不存在 TS 推导规则允许的共同候选
}
```

只有调用签名、显式约束或其他既有规则要求联合时才能产生联合候选。不能通过隐式数值转换、对象裁剪、`unknown` 或动态盒合并候选。

静态类型真实为 `never` 的表达式可以提供候选。全部候选均为 `never` 时推导为 `never`；同时存在普通候选时按 T04 吸收到普通候选。完全没有候选仍是推导错误。

### 回调上下文

普通实参先确定可用于回调参数的类型，回调返回值再为剩余参数提供候选：

```ts
function transform<T, U>(value: T, fn: (value: T) => U): U {
  return fn(value);
}

const length = transform("hello", (text) => text.length);
// T = string，U = i32
```

候选依赖形成没有外部锚点的循环时，checker 不执行无界固定点猜测：

```ts
interface Cycle {
  <T>(fn: (value: T) => T): T;
}

function inferCycle(cycle: Cycle): void {
  const value = cycle((item) => item);
  // 编译错误：T 没有独立候选
}
```

用户可以通过参数注解、结果上下文或显式类型实参消除循环。推导不能自动选择 `unknown`。

### 显式类型实参

显式类型实参优先于全部推导候选：

```ts
const value = identity<string>("on"); // string
```

提供显式实参后，checker 检查约束和普通实参兼容，不通过实参把显式类型改成更窄或更宽的类型。部分显式实参遵循默认参数规则。

## 构造推导

泛型类构造按以下顺序推导：

1. 构造参数。
2. 目标实例上下文。
3. 默认类型参数。
4. 无候选诊断。

```ts
class Box<T> {
  constructor(public value: T) {}
}

class Empty<T> {
  value!: T;
}

class Defaulted<T = string> {
  value!: T;
}

const box = new Box("value"); // Box<string>
const contextual: Empty<i32> = new Empty(); // Empty<i32>
const defaulted = new Defaulted(); // Defaulted<string>
const invalid = new Empty(); // 编译错误
```

TypeScript 最后一种情况可能得到 `Empty<unknown>`；Nxts 不使用该兜底。

## `const` 类型参数

函数、方法和类可以使用 TypeScript 的 `const` 类型参数，要求推导优先保留直接字面量、对象形状和元组信息：

```ts
function defineRoutes<const T extends readonly string[]>(routes: T): T {
  return routes;
}

const routes = defineRoutes(["/", "/users"]);
// readonly ["/", "/users"]
```

`const` 只影响推导：

- 显式类型实参不受影响。
- 只有调用或构造位置直接出现的字面量参与 const 推导。
- 已经 widening 到普通变量类型的值不会重新恢复字面量或元组。
- 推导结果仍必须满足约束和可写性规则。
- 类型别名和接口参数不使用 `const` 修饰。

不同字面量实参具有不同静态类型身份，但运行时表示和执行语义相同时必须优先共享机器码，不能仅因 `const` 推导复制实现。

## 泛型 rest 与 variadic tuple

T37 支持以单个类型参数捕获和转发有限参数元组：

```ts
function invoke<T extends readonly unknown[], R>(
  fn: (...args: T) => R,
  ...args: T
): R {
  return fn(...args);
}

const result = invoke(
  (name: string, count: i32) => `${name}:${count}`,
  "item",
  10,
);
```

在泛型 variadic tuple 约束中，`readonly unknown[]` 表示任意受支持的只读参数元组形状。它是类型级形状约束，不建立普通值到动态 `unknown[]` 的隐式转换。

每个实际调用仍具有有限、确定的参数数量和元素类型。纯转发路径可以标量化参数并消除临时 rest 数组；函数读取、保存或使 `args` 逃逸时，才按 T32 的普通 rest 语义创建数组。

多段 tuple spread、`[...T, ...U]` 的一般类型运算、条件提取和 `infer` 由 T41 定义。动态数组 spread 和调用 lowering 由 T52–T53 定义。

## 泛型重载

泛型重载复用 T33 的有序重载集合：

```ts
function collect<T>(value: T): T[];
function collect<T>(left: T, right: T): T[];
function collect<T>(left: T, right?: T): T[] {
  return right === undefined ? [left] : [left, right];
}
```

每个公开候选独立执行类型参数推导、约束检查和适用性检查。选择唯一候选后才建立具体实例和调用入口。实现签名仍不对调用方可见，运行时不根据值选择重载。

候选推导失败不能污染其他候选。多个候选仍适用时，使用 T33 已确定的 TypeScript 顺序和特化规则；不能通过返回类型单独建立运行时重载。

## 一等泛型函数值

### 多态值

具有泛型调用签名的函数可以作为参数、返回值、字段、容器元素或运行时分支结果：

```ts
type Identity = <T>(value: T) => T;

function useIdentity(fn: Identity): string {
  return fn("value");
}

const identity: Identity = <T>(value: T): T => value;
```

调用点的类型实参仍必须静态确定。目标静态已知时直接选择具体函数视图；动态选择的一等多态值仍只能调用链接期已知的闭合签名。固定表示、专门化槽位和调用成本见 [`3-polymorphicFunctionRuntime.md`](../../runtime/values/3-polymorphicFunctionRuntime.md)。

### 实例化表达式

TypeScript 实例化表达式可以把泛型函数或泛型类构造器变成确定签名的值：

```ts
function identity<T>(value: T): T {
  return value;
}

class Box<T> {
  static count = 0;

  constructor(public value: T) {
    Box.count++;
  }
}

const identityI32 = identity<i32>;
const I32Box = Box<i32>;

const value = identityI32(1);
const box = new I32Box(1);
```

实例化表达式执行类型实参、约束和重载检查，并产生确定的静态函数或构造签名。它不创建新的类型身份；函数和类的可观察身份由 T32、T36 及 [`3-polymorphicFunctionRuntime.md`](../../runtime/values/3-polymorphicFunctionRuntime.md) 保持。

`I32Box` 的静态构造签名只产生 `Box<i32>`，不能再次提供其他类型实参。它与其他 `Box<T>` 构造视图共享 `Box` 的类身份和静态状态。

## 接口泛型方法

接口方法可以声明自己的类型参数：

```ts
interface Decoder {
  decode<T>(input: string, schema: Schema<T>): T;
}

const user = decoder.decode(input, userSchema);
```

具体接收者已知时，调用选择闭合方法实例。动态接口值仍只允许调用静态可达的闭合签名；witness 槽位和跨模块需求由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义，runtime 路径见 [`3-polymorphicFunctionRuntime.md`](../../runtime/values/3-polymorphicFunctionRuntime.md)。

## 类型参数不是运行时值

类型参数不能出现在需要运行时构造器或类型描述的表达式位置：

```ts
function create<T>() {
  return new T();
}

function check<T>(value: unknown): boolean {
  return value instanceof T;
}
```

以上均为编译错误。需要构造或检查时必须显式传入运行时值：

```ts
function create<T>(Ctor: new () => T): T {
  return new Ctor();
}

const user = create(User);
```

调用点可以对已知构造器去虚化和内联。显式构造器参数是普通值参数，不是泛型隐藏参数。

## 开放泛型与闭合实例

运行时值类型必须闭合：

```ts
let missing: Box; // 没有默认值时编译错误
let placeholder: Box<_>; // 不支持
let wildcard: Box<*>; // 不支持

let finite: Box<i32> | Box<string>; // 合法
```

泛型声明体和模块元数据可以保留符号类型参数；进入 Typed IR 的字段、参数、返回值、容器元素、联合成员和 GC 描述必须经过完整替换和规范化。

Nxts 不支持存在类型、通配符泛型或开放运行时布局。需要隐藏具体类型时使用已经定义的接口视图或有限联合，并承担对应能力明确规定的成本。

## `void` 与 `never`

### `void` 结果

类型替换后，`void` 只能出现在 T15 定义的结果位置：

```ts
type Action = Task<void>; // 合法
type Invalid = Box<void>; // 编译错误
```

`void` 函数实例正常完成但不产生可用结果值。返回槽位和 `Promise<void>` 状态分别由 T47、T59 定义。

### `never` 实例

`never` 实参保留底类型和不可构造性：

| 实例                       | 运行时含义                               |
| -------------------------- | ---------------------------------------- |
| `Box<never>`               | 类型可描述，但没有合法实例构造。         |
| `Array<never>`             | 容器可以为空；不存在合法元素写入。       |
| `(value: never) => string` | 函数值可以存在，但正常代码不能调用。     |
| `() => never`              | 可以调用，但没有正常返回路径和返回槽位。 |

类型替换不能为 `never` 发明可构造值。外层容器和函数的布局由 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) 定义。

## 泛型类运行时模型

不同闭合实参形成不同静态实例类型，但不创建不同用户可观察类家族。`instanceof`、静态状态与构造器身份由 [`7-classSemantics.md`](../semantics/7-classSemantics.md) 定义；闭合字段布局由 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) 定义。

## 实例化与机器码

### 按需静态专门化

只有实际需要的闭合实例进入可执行 IR，后端不接收开放运行时类型。实例缓存与替换顺序由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义，阶段间闭合要求见 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)。

### 安全代码共享

只有物理 ABI、访问布局、GC、运算语义和调用约定均等价时才能共享机器码。共享不能合并静态类型、函数、类或公开 ABI 身份；完整条件与热实例策略见 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)。

### 普通调用成本

普通闭合泛型调用必须与手写具体函数具有等价调用形态，不传递隐藏类型描述、字典或类型参数，也不因泛型本身分配或执行运行时约束检查。优化要求见 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)。

## 跨模块实例化

导出泛型必须提供无需原始源码即可实例化的已检查配方，消费模块可以请求生产模块未提前生成的新闭合实参。配方内容、增量缓存键、动态库边界和版本拒绝规则由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义；不能以 runtime 泛型解释器替代。

## 递归增长与代码体积

相同类型实参的直接或互相递归复用现有实例：

```ts
function walk<T>(node: Node<T>): void {
  if (node.next !== null) {
    walk(node.next);
  }
}
```

类型实参持续增长而无法形成有限实例图时编译报错：

```ts
function grow<T>(value: T) {
  return grow<[T]>([value]);
}
```

诊断必须显示泛型声明、初始实参和重复增长路径。编译器不能为使增长终止而擦除类型、统一装箱或切换到动态泛型。

有限但数量很大的实例先执行规范缓存和安全共享，再进入确定性代码体积预算。软硬阈值与热点诊断由 [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md) 定义，不得改变类型规则。

## 方差模型

方差描述已知 `Dog -> Animal` 时，同一泛型声明的不同实例之间能否建立兼容关系。它不建立新的基础子类型，也不改变泛型实例的字段和代码布局。

| 类别 | 关系                                | 含义                                   |
| ---- | ----------------------------------- | -------------------------------------- |
| 协变 | `Producer<Dog> -> Producer<Animal>` | 类型参数只作为安全输出。               |
| 逆变 | `Consumer<Animal> -> Consumer<Dog>` | 类型参数只作为安全输入。               |
| 不变 | 两个方向均拒绝                      | 类型参数同时可读可写，或经过不变位置。 |
| 独立 | 两个方向均不受该参数限制            | 类型参数没有影响公开类型能力。         |

```ts
interface Producer<T> {
  get(): T;
}

interface Consumer<T> {
  accept(value: T): void;
}

interface Cell<T> {
  value: T;
}
```

`Producer<T>` 对 `T` 协变，`Consumer<T>` 对 `T` 逆变，`Cell<T>` 的属性可读可写，因此对 `T` 不变。

方差关系是泛型实例兼容的必要条件，不是充分条件。通过方差检查后仍须满足 T03 的类型兼容、T45 的机器表示和所属容器或函数的 ABI 规则。

## 自动方差推导

用户不需要声明方差。checker 默认根据类型参数在公开类型能力中的使用位置自动推导：

| 使用位置                                  | 方向                             |
| ----------------------------------------- | -------------------------------- |
| readonly 属性、getter、函数返回、方法返回 | 协变位置                         |
| 函数参数、方法参数、setter 参数           | 逆变位置                         |
| 可写属性                                  | 同时包含协变和逆变位置，因此不变 |
| 可写数组、字典或元组位置                  | 不变位置                         |
| readonly 容器元素                         | 协变位置                         |
| 未使用参数                                | 独立                             |

Nxts 对普通函数、对象方法、接口方法和类方法统一使用严格参数逆变。TypeScript strict 为历史兼容保留的方法参数双变不参与 Nxts 方差推导。

### 参与推导的声明位置

方差只反映泛型实例对调用方提供的静态能力：

| 位置                           | 处理                                         |
| ------------------------------ | -------------------------------------------- |
| 公开属性、方法、getter、setter | 参与推导。                                   |
| 公开重载签名                   | 每个签名都参与推导。                         |
| 重载实现签名                   | 不参与；调用方不可见。                       |
| 类构造器参数                   | 不参与实例侧方差。                           |
| private、protected 实现成员    | 不直接参与；经公开成员暴露的类型路径仍参与。 |
| 类型参数约束和默认值           | 不决定方差，只限制合法实参。                 |
| 方法自己的类型参数             | 不并入外层类型参数的方差。                   |
| 方法签名中引用的外层参数       | 按完整嵌套位置推导。                         |
| 静态类成员                     | 不能引用类实例侧类型参数，不参与。           |

构造器接收 `T` 不会使只读实例变为不变：

```ts
class Box<T> {
  constructor(private readonly stored: T) {}

  get(): T {
    return this.stored;
  }
}

const dogs: Box<Dog> = new Box(new Dog());
const animals: Box<Animal> = dogs;
```

`Box<T>` 的实例只产生 `T`，因此对 `T` 协变。构造过程的输入属于类静态创建入口；不同泛型实例的构造签名仍由 T37 独立检查。

### 嵌套位置组合

泛型参数经过嵌套类型时，内外方向按以下规则组合：

| 外层方向 | 内层方向 | 结果       |
| -------- | -------- | ---------- |
| 协变     | 协变     | 协变       |
| 协变     | 逆变     | 逆变       |
| 逆变     | 协变     | 逆变       |
| 逆变     | 逆变     | 协变       |
| 任意方向 | 不变     | 不变       |
| 任意方向 | 独立     | 不增加限制 |

```ts
type Producer<T> = () => T;
type Consumer<T> = (value: T) => void;

interface Service<T> {
  load(): Producer<T>;
  subscribe(fn: Consumer<T>): void;
}
```

`load` 中的 `T` 经过两层协变仍为协变；`subscribe` 中的 `T` 经过方法参数和回调参数两次逆变，也得到协变。因此 `Service<T>` 对 `T` 协变。

同一参数存在协变和逆变可达路径时得到不变。经过已经不变的泛型参数位置后，外层结果同样不变。

### 递归推导

递归泛型使用声明依赖图和有限方差状态求稳定结果，不展开无限类型：

```ts
interface Tree<T> {
  readonly value: T;
  readonly children: readonly Tree<T>[];
}

interface MutableNode<T> {
  value: T;
  next: MutableNode<T> | null;
}
```

`Tree<T>` 的递归路径始终为正向，因此协变；`MutableNode<T>` 的可写 `value` 使其不变。

递归方差必须得到有限稳定结果。强连通分量、状态迭代和复杂度诊断由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义；分析失败不能默认为双变、独立或不变。

## 显式方差标记

Nxts 支持 TypeScript 的可选 `in`、`out` 和 `in out` 标记：

```ts
interface Producer<out T> {
  get(): T;
}

interface Consumer<in T> {
  accept(value: T): void;
}

interface Cell<in out T> {
  get(): T;
  set(value: T): void;
}
```

| 标记       | 声明契约 |
| ---------- | -------- |
| `out T`    | 协变     |
| `in T`     | 逆变     |
| `in out T` | 不变     |
| 无标记     | 自动推导 |

标记只允许出现在类、接口和类型别名的类型参数上。函数、方法、调用签名和构造签名的自有类型参数不能标记方差。

### 校验与收紧

显式标记不能比实际用法更宽松：

```ts
interface Invalid<out T> {
  set(value: T): void;
}
// 编译错误：T 在 set 参数中处于逆变位置
```

类和接口可以使用更严格的契约。例如实际推导为协变的接口可以声明 `in out T`，主动限制为不变：

```ts
interface StrictProducer<in out T> {
  get(): T;
}
```

该收紧只减少赋值兼容，不增加运行时状态。实际推导为不变时只能省略标记或声明 `in out`；不能通过 `in` 或 `out` 强制放宽。

诊断必须显示声明标记、实际推导方向以及导致冲突的最短公开成员路径。

### 透明类型别名

普通类型别名按 T28 完全展开，不能因为比较时是否保留别名名称而改变类型关系。别名上的方差标记只校验展开目标的推导结果，不能主动收紧：

```ts
type ProducerAlias<out T> = () => T; // 合法
type ConsumerAlias<in T> = (value: T) => void; // 合法

type MarkerAlias<in out T> = {
  id: i32;
};
// 编译错误：展开目标中的 T 为独立，标记试图改变透明目标兼容关系
```

需要不透明静态身份时使用 `Brand<T, Tag>`；需要带公开泛型契约的结构视图时使用接口。该规则比 TypeScript strict 更严格，但避免同一展开类型因别名路径不同而产生不同兼容结果。

## 独立参数

类型参数没有出现在公开类型能力中时推导为独立：

```ts
interface Marker<T> {
  readonly id: i32;
}

function compareMarkers(
  dogMarker: Marker<Dog>,
  animalMarker: Marker<Animal>,
): void {
  const first: Marker<Animal> = dogMarker;
  const second: Marker<Dog> = animalMarker;
}
```

类和接口的不同闭合实参仍保留规范类型身份，但独立参数不限制赋值方向。透明类型别名实例在展开后可以直接归一为相同目标类型。

类或接口可以使用 `in out` 把独立参数收紧为不变。该能力适合固定公开泛型契约，但不建立无法被结构实现绕过的名义品牌；需要可靠品牌隔离时使用 T28 的 `Brand`。

“独立”不是 TypeScript 方法双变。前者表示参数没有影响任何公开能力，后者允许真实输入位置进行不安全双向赋值；Nxts 只支持前者。

## 内建泛型方差

现有内建和容器规范形成以下公共方差表：

| 类型或位置                    | 方差规则                                     |
| ----------------------------- | -------------------------------------------- |
| `(value: T) => R`             | `T` 逆变，`R` 协变                           |
| `T[]`                         | `T` 不变                                     |
| `readonly T[]`                | `T` 协变，并要求元素表示兼容                 |
| 可写元组位置                  | 对应参数不变                                 |
| readonly 元组位置             | 逐位置协变，并要求布局兼容                   |
| `MutableDict<T>`              | 值参数不变                                   |
| `ReadonlyDict<T>`             | 值参数协变，并要求 ABI 兼容                  |
| `Promise<T>`                  | 完成值参数协变，运行时布局由 T59 定义        |
| `T \| null`、`T \| undefined` | 不改变 `T` 的正向关系                        |
| `Brand<T, Tag>`               | 两个参数均按品牌身份处理，不通过普通方差转换 |
| 用户类、接口和类型别名        | 按本规范自动推导                             |

可写容器可以先零成本形成相同元素类型的只读视图，再应用表示安全的协变：

```ts
const dogs: Dog[] = [new Dog()];

const readonlyDogs: readonly Dog[] = dogs;
const animals: readonly Animal[] = readonlyDogs;
```

checker 可以把连续两步归一为一个只读视图兼容，不复制容器。

### Promise

`Promise<T>` 只向调用方产生完成值，调用方不能把新的 `T` 写回已有 Promise，因此对 `T` 协变：

```ts
function widenTask(dogTask: Promise<Dog>): Promise<Animal> {
  return dogTask;
}
```

`then` 的完成回调形成两次逆变：

```ts
interface PromiseView<T> {
  then<U>(onFulfilled: (value: T) => U): Promise<U>;
}
```

`onFulfilled` 是方法输入，`T` 又是回调输入，两次反转后仍为协变。`Promise<Dog> -> Promise<Animal>` 还必须保证完成值表示和 Promise 状态 ABI 可复用。需要改变完成值表示时不建立隐式兼容；显式 `then` 按 T59 创建并返回新的 Promise。

T38 只确定静态方向和表示门槛。fulfillment、rejection、状态布局、`await` 和异步传播由 T59 定义。

## 泛型函数值兼容

泛型函数值表示对类型参数范围内全部闭合实例的承诺。目标允许调用的每个实例，来源函数都必须支持：

```ts
interface Named {
  name: string;
}

interface User extends Named {
  id: i32;
}

function compareGenericFunctions(
  allNamed: <T extends Named>(value: T) => T,
  allUsers: <T extends User>(value: T) => T,
): void {
  const userHandler: <T extends User>(value: T) => T = allNamed;
  const namedHandler: <T extends Named>(value: T) => T = allUsers;
  // 编译错误：allUsers 不能处理所有 Named
}
```

类型参数改名不影响兼容。checker 以目标的符号类型参数检查来源约束、参数关系和返回关联，不能使用 `any`、`unknown` 或单个代表类型代替全称检查。

泛型函数可以形成具体函数视图：

```ts
const handleUser: (value: User) => User = allNamed;
```

该转换选择 `User` 的具体入口，不创建包装函数。普通具体函数不能反向伪装为支持所有类型实例的泛型函数：

```ts
const stringIdentity = (value: string): string => value;

const genericIdentity: <T>(value: T) => T = stringIdentity;
// 编译错误
```

泛型重载集合继续按 T33 要求目标每个公开签名都由来源的兼容签名覆盖。默认参数、`const` 推导和约束属于公开泛型签名；兼容不能破坏调用方可观察的推导与返回关联。

一等泛型函数值沿用 T37 的固定专门化槽位。方差检查不会增加运行时字典、包装或二次分派。

## 类、接口与类型组合

### 泛型类

同一泛型类家族的不同实例先按类型参数方差检查，再按 T36 的名义类关系和 T45 的表示规则检查。不同类即使成员结构相同也不会仅因方差建立兼容。

构造器输入不影响实例侧方差。公开 writable 字段、setter 和方法参数使用 Nxts 的严格输入方向；private、protected 状态只在经公开签名暴露时影响外部方差。内部字段仍参与布局和 GC 兼容。

### 泛型接口

接口按规范结构契约推导方差。readonly 属性和返回值为协变位置，可写属性为不变位置，方法参数为严格逆变位置。接口继承展开后推导，冲突路径按 T29 先产生成员错误，不能用方差掩盖。

接口泛型方法自己的参数按 T37 全称检查；方法签名引用外层类型参数时，外层参数继续按嵌套方向推导。

### 类型组合

透明类型别名根据展开目标推导：

```ts
type Maybe<T> = T | null;
type Reader<T> = () => T;
type Writer<T> = (value: T) => void;

type Result<T, E> = {
  readonly value?: T;
  readonly error?: E;
};
```

`Maybe<T>`、`Reader<T>` 对参数协变，`Writer<T>` 逆变，`Result<T, E>` 对两个参数分别协变。多个参数独立推导，不共享默认方向。

接口交叉和精确对象交叉继续使用 T22 的成员与投影规则，不能借方差恢复 T22 禁止的对象投影。`keyof`、索引访问、条件类型、映射类型和 `infer` 的方差传播由 T40–T41 定义。

## 表示与成本门槛

方差只回答静态方向。实际隐式兼容还必须满足所属类型的表示契约：

```ts
function widenAnimals(dogs: readonly Dog[]): readonly Animal[] {
  return dogs;
}
```

`Dog` 和 `Animal` 都使用兼容类引用表示时，该转换只改变静态只读视图。

以下转换不能仅凭静态协变接受：

```ts
function rejectInterfaceArray(values: readonly Concrete[]): void {
  const interfaces: readonly SomeInterface[] = values;
}
```

如果 `Concrete` 元素是对象引用，而 `SomeInterface` 元素需要数据引用和 witness，则数组元素布局不同。接受该转换会要求逐元素重建或逐次读取适配。

规则如下：

- 数组、元组和字典协变要求无操作且元素布局、对齐和 GC 描述兼容。
- 需要逐元素接口打包、联合注入、装箱、复制或运行时检查时拒绝隐式容器兼容。
- 函数返回协变只能使用 T32 已允许的无失败、有界且不分配的静态类型化入口。
- 接口间协变可以使用 T29 已允许的无失败 witness repack，但不能扫描成员或分配包装对象。
- 普通对象和类仍保持自身身份、字段权限和反射语义。
- 用户需要改变元素表示时使用 `map`、显式构造或对应表示转换 API。

同构只读 API 可以用泛型约束避免接口数组重建：

```ts
function printNames<T extends Named>(values: readonly T[]): void {
  for (const value of values) {
    console.log(value.name);
  }
}

printNames(users);
```

实例化后 `T` 保持具体元素类型，编译器可以直接访问已知实现，不产生接口元素转换。

## 跨模块方差摘要

导出的泛型类、接口和别名必须保存规范方差摘要：

```text
Result<out T, out E>
Handler<in T>
Cell<in out T>
Marker<independent T>
```

摘要必须反映公开成员、递归依赖和合法显式标记，使消费模块无需源码即可复现相同静态关系。编码、配方校验、版本与动态库规则由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义；方差仍不产生运行时状态。

## 与 TypeScript 的兼容性

Nxts 保持 TypeScript strict 的泛型声明语法、词法作用域、`extends`、默认值、`const` 参数、调用与构造推导、回调上下文、重载、实例化表达式、泛型函数值、接口泛型方法、variadic tuple、自动方差推导以及可选 `in` / `out` 标记。

主要差异如下：

| 场景                 | TypeScript                                    | Nxts                                                   |
| -------------------- | --------------------------------------------- | ------------------------------------------------------ |
| 运行时实现           | JavaScript 动态表示，类型参数擦除。           | 闭合实例静态专门化或安全共享机器码。                   |
| 无候选推导           | 可能使用 `unknown` 或约束兜底。               | 编译错误，要求显式参数、上下文或默认值。               |
| `any`                | 可以参与约束和推导。                          | 永久不支持。                                           |
| `unknown` 上界       | 普通顶层类型。                                | 直接约束位置作为无约束语法；普通值仍使用显式动态表示。 |
| 裸 `{}` 上界         | 可以表达非空值集合。                          | 不支持，使用无约束参数或明确接口。                     |
| `void` 泛型实参      | 可以进入更多普通类型位置。                    | 只允许最终替换结果处于结果位置。                       |
| 原生数值联合约束运算 | 统一 `number` 世界中可能接受并返回 `number`。 | 不同机器表示不能隐式建立动态运算分派。                 |
| 推导失败兜底         | 可以形成较宽静态结果。                        | 不使用 `unknown`、`any`、对象裁剪或隐藏转换。          |
| 类型参数反射         | 类型参数本身同样不可作为运行时值。            | 保持该边界，并且不携带隐藏类型描述。                   |
| 高阶类型与通配符     | 没有原生 HKT 或 `Box<*>`。                    | 同样不支持。                                           |
| 方法参数方差         | strict 下仍保留方法参数双变兼容。             | 方法与普通函数统一按参数逆变检查。                     |
| 可写属性与容器       | 部分场景允许协变赋值。                        | 可写类型参数位置不变，拒绝不安全写入。                 |
| readonly 协变        | 运行时值采用统一动态表示。                    | 还必须满足布局、ABI 和 GC 表示兼容。                   |
| 透明别名方差标记     | 可以影响保留别名形式时的直接比较。            | 只校验展开目标，不改变透明别名兼容关系。               |

在 Nxts 标准类型声明下，通过 Nxts checker 的源码仍应通过 TypeScript 严格类型检查。Nxts 的差异只缩小接受范围，或改变不可观察的内部代码生成方式。

## 编译器职责

| 阶段                   | 唯一职责来源                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| 语法接受范围           | [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)                                        |
| 类型参数词法绑定       | T57                                                                                       |
| 推导、实例图与方差求解 | [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)          |
| Checked HIR 与实例需求 | [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)                                  |
| 闭合布局               | [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)        |
| 一等多态值 runtime     | [`3-polymorphicFunctionRuntime.md`](../../runtime/values/3-polymorphicFunctionRuntime.md) |
| 专门化、共享与去虚化   | [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)             |
| 配方、方差摘要与链接   | [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)                                         |
| 体积与热点诊断         | [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md)              |

## 依赖边界

| 相关能力                  | T37–T38 已确定内容                                   | 对应能力负责内容                                  |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| T04–T05 推导              | 候选顺序、无动态兜底、默认值和上下文入口。           | 普通公共类型、函数返回和非泛型推导。              |
| T15–T17、T20 特殊与字面量 | 替换后检查 `void` / `never`；支持 const 泛型保留。   | 特殊类型合法位置、字面量身份和基础 widening。     |
| T21–T22 组合类型          | 实例替换后执行完整联合与交叉规范化。                 | 成员关系、布局类别和复杂度规则。                  |
| T28–T31 声明与递归        | 别名、接口和递归泛型统一推导方差并缓存稳定结果。     | 声明身份、结构契约、透明别名和递归符号图。        |
| T32–T33 函数              | 泛型函数值遵循全称兼容，参数位置严格逆变。           | 普通函数兼容、身份、参数适配和重载顺序。          |
| T34–T35 集合              | mutable 元素不变；readonly 元素经表示门槛后协变。    | 数组、元组、rest 对象、布局和普通方法。           |
| T36 类                    | 泛型类推导实例侧方差，类身份与静态状态保持共享。     | 构造、继承、覆盖、描述符和 `instanceof`。         |
| T40–T42 类型级边界        | 普通值级推导不隐式获得高级类型计算。                 | 类型运算符、高级类型和 `satisfies` 的拒绝规则。   |
| T45–T49 表示与标准库      | 方差兼容受布局、GC 和 ABI 门槛约束；摘要零运行时。   | 精确表示、元数据格式、预算配置和 intrinsic 名称。 |
| T52–T60 使用点            | 具体实例信息可供调用、spread、闭包、异步和迭代使用。 | 表达式入口、环境对象、`await` 与迭代协议。        |
| T57 名称绑定              | 参数采用词法作用域和类型空间。                       | 符号表、遮蔽诊断、导入绑定和声明顺序。            |

## 诊断与测试

至少覆盖以下场景：

| 场景                                         | 预期                                              |
| -------------------------------------------- | ------------------------------------------------- |
| 函数、箭头、类、接口、别名和方法参数         | 语法接受且作用域正确。                            |
| constructor、getter、setter 和静态块自有参数 | 编译错误。                                        |
| 后声明参数被约束或默认值引用                 | 编译错误并指出参数顺序。                          |
| 简单、交叉和 F-bounded 约束                  | 合法实例接受，失败显示替换后的约束路径。          |
| `T extends unknown`                          | 作为无约束处理，不引入动态表示。                  |
| `T extends any`、`T extends {}`              | 编译错误。                                        |
| 默认参数与部分显式参数                       | 按 TS 规则应用默认值，不继续推导省略位置。        |
| `identity`、`choose`、`pair` 字面量推导      | 分别得到精确字面量、字面量联合和 widening 数组。  |
| 不同基础类别候选                             | 编译错误，不自动合成联合。                        |
| 无实参、有结果上下文                         | 从直接上下文推导。                                |
| 无候选、无上下文、无默认值                   | 编译错误，不得到 `unknown`。                      |
| 回调参数与回调返回推导                       | 依赖顺序正确；无锚循环要求注解。                  |
| `const` 类型参数直接字面量                   | 保留对象、字面量和元组信息。                      |
| 已 widening 变量传给 const 参数              | 不恢复已丢失的精确信息。                          |
| 泛型类构造参数、上下文和默认值               | 按规定顺序得到闭合实例。                          |
| 泛型函数和构造器实例化表达式                 | 签名确定，身份、`name`、`length` 和静态状态不变。 |
| 多态函数值直接调用和动态选择                 | 前者可内联；后者固定槽位且每次调用不分配。        |
| 接口泛型方法直接与动态调用                   | 直接去虚化或使用链接期固定 witness 槽位。         |
| `new T`、`instanceof T`                      | 编译错误；显式构造器参数合法。                    |
| `Task<void>` 与 `Box<void>`                  | 前者无返回载荷，后者编译错误。                    |
| `Box<never>`、`Array<never>` 和 never 函数   | 保持不可构造性，不发明零尺寸载荷。                |
| 普通闭合泛型调用                             | 无隐藏参数、装箱、运行时约束检查或额外分配。      |
| 表示相同与不同的实例                         | 分别安全共享或生成独立实现。                      |
| 泛型类多个实参                               | 布局可不同，静态状态和运行时类身份共享。          |
| 跨模块新实参                                 | 使用模块配方实例化，不需要源码或运行时解释器。    |
| 稳定递归与增长递归                           | 前者复用实例，后者显示增长链并报错。              |
| 大量有限实例                                 | 先共享，再产生确定的体积诊断或资源错误。          |
| 自动方差推导                                 | 分别得到协变、逆变、不变或独立结果。              |
| 合法和冲突的显式 `in` / `out` 标记           | 前者接受；后者显示实际方向及最短冲突路径。        |
| 方法参数与普通函数参数                       | 统一严格逆变，不采用 TypeScript 方法双变例外。    |
| mutable 数组、元组、字典和可写属性           | 对应类型参数不变，拒绝不安全协变赋值。            |
| readonly 容器与属性                          | 同向且表示兼容时协变；表示不兼容时拒绝。          |
| 泛型函数值之间及泛型到单态视图               | 按全称承诺和静态实例选择检查，无运行时包装。      |
| `Promise<Dog> -> Promise<Animal>`            | 静态协变，并经过 Promise 表示门槛。               |
| 递归和互相递归泛型                           | 方差有限迭代得到稳定结果，超限产生确定诊断。      |
| 透明别名上的方差标记                         | 只能验证展开目标，不能收紧或放宽兼容关系。        |
| 泛型声明跨模块使用                           | 使用规范摘要复现相同兼容结果并校验静态指纹。      |
| TypeScript 对照样例                          | Nxts 接受样例在标准声明下通过 TS 严格检查。       |

运行时形态、代码共享、跨模块实例和 Go 对照基准由 [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md) 验证。仅因方差建立的兼容关系不得增加包装、分配、类型标记或分派。
