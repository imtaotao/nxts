# 特殊类型与预留类型

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-26
- 文档顺序：11

## 目标与边界

定义没有普通值载荷的静态特殊类型、安全动态值类型，以及当前不支持但影响类型系统扩展边界的基础类型。

用户可观察行为见 [`../semantics/11-specialValueSemantics.md`](../semantics/11-specialValueSemantics.md)，动态值与 symbol 的公开入口见 [`../../stdlib/7-dynamic.md`](../../stdlib/7-dynamic.md) 和 [`../../stdlib/8-symbol.md`](../../stdlib/8-symbol.md)，物理表示见 [`../../compiler/representation/1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)。

## `void`

- 小节状态：T15 已定稿

`void` 表示函数或异步操作没有可供调用方使用的返回结果，无独立运行时值表示。

### 允许位置

`void` 只允许出现在返回结果位置：

```ts
function log(message: string): void {
  console.log(message);
}

type Callback = () => void;
type SaveTask = Promise<void>;
```

泛型可以使用 `void` 表达没有结果，但对应泛型参数必须由该泛型能力定义为结果类型：

```ts
interface Task<Result> {
  run(): Result;
}

type LogTask = Task<void>; // 合法
```

用于存储普通值的泛型参数不能使用 `void` 实例化：

```ts
interface Box<T> {
  value: T;
}

type EmptyBox = Box<void>; // 编译错误
```

泛型使用 `void` 不需要新的源码标记。checker 在实例化时完成类型参数替换，再递归检查替换后的 `void` 是否只位于合法结果位置：

```ts
type Factory<Result> = () => Result;
type Action = Factory<void>; // 合法

type Values<T> = Array<T>;
type InvalidValues = Values<void>; // 编译错误
```

函数返回和异步完成结果属于结果位置；对象属性、函数参数、数组元素、元组元素和联合成员属于普通值位置。嵌套泛型按替换后的最终位置递归判断，checker 可以缓存泛型参数是否仅用于结果位置，但不要求用户声明新的类型参数种类。

`Promise<void>` 表示异步操作完成时没有 fulfillment 载荷。其成功回调不接收 `void` 参数，具体方法签名、状态布局和异步 lowering 由 T49 与 T59 定义。`ReturnType<() => void>` 可以产生 `void` 类型结果，但该结果仍只能继续用于合法结果位置。

不能使用 `void` 声明变量、属性、参数或联合类型成员：

```ts
let value: void; // 编译错误
type Box = { value: void }; // 编译错误
type Consumer = (value: void) => void; // 编译错误
type Result = string | void; // 编译错误，使用 string | undefined
```

### 一元 `void` 运算符

Nxts 支持 JavaScript 的一元 `void expression`。其静态结果类型为 `undefined`：

```ts
const result = void save(); // result: undefined
void 0; // undefined
```

它不把函数值转换为 `() => void`。完整求值、副作用、异常和零分配规则见 [`../semantics/11-specialValueSemantics.md`](../semantics/11-specialValueSemantics.md)；优先级和通用表达式诊断由 T50 定义。

### 返回完成规则

显式返回类型为 `void` 的函数允许到达函数末尾、使用 `return;`，或者显式返回静态类型为 `undefined` 的表达式：

```ts
function first(): void {}

function second(): void {
  return;
}

function third(): void {
  return undefined;
}
```

`return undefined;` 是 `void` 返回位置的专用检查规则，不建立 `void` 与 `undefined` 的普通类型兼容。返回其他值属于编译错误：

```ts
function invalid(): void {
  return 1; // 编译错误
}
```

`undefined` 可以作为真实返回类型。返回类型为 `undefined` 或包含 `undefined` 的联合类型时，到达函数末尾和 `return;` 均按返回 `undefined` 检查：

```ts
function missing(): undefined {}

function read(flag: boolean): string | undefined {
  if (flag) {
    return "ready";
  }
}
```

返回类型不接受 `undefined` 的值返回函数不能存在可达的无值完成路径。`void` 调用只能用于结果被丢弃的位置，不能初始化变量、作为参数或进入联合类型；`undefined` 调用结果是可使用的普通单例值。

`(): void` 与 `(): undefined` 是不同函数类型，不互相隐式兼容。求值语义见 [`../semantics/11-specialValueSemantics.md`](../semantics/11-specialValueSemantics.md)，零载荷优化与跨模块规则由 T23、T45 和 T47 定义。

### 函数兼容性

函数返回类型采用严格兼容规则。返回其他类型的函数不能赋给 `() => void`：

```ts
const producer = (): i32 => 1;
const callback: () => void = producer; // 编译错误
```

任意函数调用都可以作为表达式语句忽略结果。需要构造 `() => void` 回调时，使用显式包装函数：

```ts
producer(); // 合法，结果未使用

const callback: () => void = () => {
  producer();
};
```

新建箭头函数获得 `() => void` 上下文类型时，允许使用简洁表达式体。表达式结果按该上下文丢弃；箭头函数本身具有准确的 `() => void` 类型：

```ts
const callback: () => void = () => producer(); // 合法
items.forEach((item) => output.push(item)); // forEach 回调提供 void 上下文
```

没有 `void` 上下文时，简洁箭头函数仍从表达式推导返回类型，不能在之后隐式转换：

```ts
const inferred = () => producer(); // () => i32
const callback: () => void = inferred; // 编译错误
```

`(): T` 到 `(): void` 不存在隐式转换，编译器不为此生成隐藏的适配 thunk。

### 调用 ABI 约束

`void`、`undefined` 和 `Promise<void>` 的调用分类由 T45、T47 与 T59 定义。跨模块必须保留 `(): void` 与 `(): undefined` 的语义区别，不能为 `(): T` 到 `(): void` 生成隐藏适配 thunk。

### 下游依赖

- T32 定义函数签名、上下文箭头函数和调用 ABI 的完整规则。
- T37 定义泛型替换后的结果位置验证与实例化元数据。
- T45、T47 定义目标平台表示和跨模块 ABI。
- T49、T59 定义 `Promise<void>` 的标准库签名、状态布局和异步 lowering。
- T50 定义一元 `void` 的优先级和通用运算符诊断。

## `never`

- 小节状态：T16 已定稿

`never` 表示不会正常产生值，无运行时表示。

T04–T06 已确定以下公共规则：

- `never` 是所有普通类型的底类型，`never` 表达式可以用于任意目标值类型。
- `T | never` 归一化为 `T`，所有分支均为 `never` 时结果仍为 `never`。
- `throw`、已证明没有可达 `break` 的无限循环和返回 `never` 的调用使后续路径不可达。
- 函数返回类型使用 T05 的静态返回候选推导，函数体能否正常完成作为独立控制流事实记录。
- 穷尽检查使用 `never` 表示没有剩余联合成员。

### 判定与推导

checker 只能依据控制流图和已解析的类型证明 `never`，不能根据函数名称、常见行为或运行时概率进行猜测：

| 场景                                                 | 是否终止当前正常完成路径 |
| ---------------------------------------------------- | ------------------------ |
| `throw`                                              | 是。                     |
| 调用返回类型明确为 `never` 的函数                    | 是。                     |
| 条件静态为真的循环，且不存在可达 `break`             | 是。                     |
| 条件分支的所有可达出口都不会正常完成                 | 是。                     |
| 回调函数内部返回 `never`，但被调用函数本身可能返回   | 否。                     |
| 循环是否结束取决于运行时数据                         | 否。                     |
| 函数可能抛出异常，但声明或推导的返回类型不是 `never` | 否。                     |
| 没有显式返回类型的递归调用环                         | 不据此推导为 `never`。   |

显式声明返回类型为 `never` 时，函数体不得存在可达的无值返回或可达的函数末尾，并且每个源码级可达的 `return expression` 的静态类型都必须为 `never`。`return;`、普通类型的 `return expression;` 和正常落到函数末尾均产生编译错误；不能仅因普通返回表达式的内部求值不会完成而跳过返回类型检查。`return fail();` 合法，因为其静态类型为 `never`。

直接递归或相互递归的函数可以显式声明 `never`。checker 使用已声明签名检查递归调用，并分别验证每个函数体不存在正常完成路径；未标注的递归调用环不能依靠循环假设推导出 `never`。

标准库、宿主能力或运行时终止函数只有在其签名明确返回 `never` 时，调用点才形成不可达路径。`try` / `finally` 对突然完成的覆盖规则由 T61 定义，异步函数和生成器函数的返回推导分别由 T59、T60 定义。

以上证明只发生在编译期，不插入运行时检查。无法证明时保留普通控制流，不得为了优化将路径错误标记为不可达。

### 静态类型与完成状态

每个表达式分别具有静态结果类型和正常完成状态。`never` 静态类型必然表示不能正常完成，但反方向不成立：包含必经 `never` 子表达式的外层表达式可能具有普通静态类型，同时没有正常完成路径。

| 表达式                    | 静态类型           | 正常完成状态           |
| ------------------------- | ------------------ | ---------------------- |
| `fail()`                  | `never`            | 不能完成。             |
| `returnsNumber(fail())`   | `number`           | 不能完成。             |
| `1 + fail()`              | `number`           | 不能完成。             |
| `{ value: fail() }`       | `{ value: never }` | 不能完成。             |
| `flag ? fail() : "ready"` | `"ready"`          | 可以通过后一分支完成。 |

必经子表达式不能正常完成时，当前路径上的后续求值项静态不可达：

```ts
consume(fail(), sideEffect());
// 编译错误：sideEffect() 不可达
```

短路运算、条件表达式、可选链等结构只终止实际进入 `never` 子表达式的路径，其他路径继续参与类型合并。完整求值行为见 [`../semantics/11-specialValueSemantics.md`](../semantics/11-specialValueSemantics.md)。T50–T53 不能把完成状态重新编码为外层表达式的 `never` 静态类型。

函数返回推导使用 `return expression` 的静态类型，不使用其内部完成状态替换候选类型。命名函数声明、函数表达式和箭头函数的具体兼容推导规则由 T05 定义。实现内部证明出的不返回状态可以用于优化，但返回类型为 `void` 或普通类型的函数不能因此在调用点获得公开的 `never` 类型。

### 合法位置与可构造性

`never` 是完整底类型，可以出现在变量、参数、返回值、属性、数组、元组、联合、泛型参数和类型工具结果等所有静态类型位置。类型表达式合法不代表存在对应运行时值：

```ts
let impossible: never;

type ImpossibleObject = {
  value: never;
};

type EmptyValues = Array<never>;
type NeverPromise = Promise<never>;
```

checker 必须区分类型表达式是否合法与类型是否可构造。`never` 自身没有实例，复合类型按结构传播可构造性：

| 类型形式                      | 可构造性                                              |
| ----------------------------- | ----------------------------------------------------- |
| `never`                       | 不可构造。                                            |
| 包含必选 `never` 字段的对象   | 不可构造。                                            |
| 包含 `never` 元素的固定元组   | 不可构造。                                            |
| 仅包含可选 `never` 字段的对象 | 可以构造，但对应字段必须缺失。                        |
| `Array<never>`                | 可以构造空数组，但不能产生或插入元素。                |
| `Promise<never>`              | 可以处于 pending 或 rejection，不能正常 fulfillment。 |
| 参数为 `never` 的函数类型     | 函数值可以存在，但正常可达代码不能提供实参。          |
| 返回 `never` 的函数类型       | 函数值可以存在，调用后不会正常返回。                  |

`never` 不是可构造的零尺寸值。不可构造性向复合类型的传播由对象、数组、递归类型、泛型实例和异步状态规范细化；物理布局约束见 T45。

checker 不得使用 `never` 掩盖推导信息不足。空数组、无候选泛型参数和无法求得公共类型的表达式必须按对应规范诊断，不能自动退化为 `never` 或 `never[]`。只有真实不可达控制流、穷尽消除或明确的类型级计算可以产生 `never`。

### 泛型推导与实例化

静态类型真实为 `never` 的表达式可以提供泛型推导候选。候选全部为 `never` 时推导类型参数为 `never`；同时存在普通候选时，`never` 按 T04 底类型规则被普通候选吸收。完全没有候选时必须产生推导错误，不能使用 `never` 兜底。

显式类型参数可以指定为 `never`，`never` 也满足任意普通 `extends` 上界约束。类型参数替换后仍须遵守可构造性和禁止伪造规则：实例化可以形成 `Box<never>`、`Array<never>` 或 `(value: never) => void` 等静态类型，但不能生成、传递或存储 `never` 载荷。

T37 负责决定不可构造实例的实体代码、布局和函数值表示，不能为满足泛型代码生成而给 `never` 发明零尺寸值。条件类型、分布式条件类型和 `infer` 对 `never` 的类型级行为由 T41 定义，不由普通值级泛型推导隐式获得。

### 禁止构造与伪造

不存在从可构造类型到 `never` 的值转换。普通值不能通过类型断言、显式转换、装箱、反序列化、反射或 FFI 数据导入伪造成 `never`：

```ts
const value = input as never; // 编译错误
```

断言目标为 `never` 时，源表达式必须已经具有 `never` 类型，此时断言只是无运行时行为的冗余静态操作。泛型替换和类型级计算可以产生 `never` 类型结果，但不能据此合成该类型的运行时值。

`assertNever(value)` 只接受已经通过控制流收窄为 `never` 的参数，不执行转换。标准库、宿主或 FFI 函数可以将返回类型声明为 `never`，但该声明表示受信任的“不正常返回”调用契约，而不是外部环境能够提供 `never` 数据。

当前不提供能够从可达代码返回 `never` 值的安全或不安全 intrinsic。若语言未来引入等价于 unchecked unreachable 的底层能力，必须纳入独立的 `unsafe` 契约，不能放宽普通断言、转换或 FFI 数据规则。T43 和 T48 必须继承本节约束。

### 函数值兼容

`never` 表达式作为底类型可以用于任意值结果位置，但已有 `(...P) => never` 函数值不能仅依据返回协变兼容到任意值返回函数。目标返回类型需要值载荷时，必须使用具有目标上下文签名的新箭头函数：

```ts
function fail(): never {
  throw new Error("failed");
}

const value: string = fail(); // 合法

const action: () => void = fail; // 合法，双方均无返回载荷
const loader: () => LargeObject = fail; // 编译错误
const safeLoader: () => LargeObject = () => fail(); // 合法
```

该限制不按标量或目标平台放宽。即使某个平台允许忽略标量返回寄存器，也不能让函数兼容结果依赖目标 ABI。checker 只允许 `(...P) => never` 直接兼容参数关系满足 T03 且目标为 `void` 的函数类型；其他目标返回类型需要显式包装，不生成隐藏适配 thunk。

该规则是函数值 ABI 约束，不改变普通 `never -> T` 的底类型关系。

### Typed IR 与 lowering

前端必须把静态结果类型、正常完成能力和异常完成能力作为三个独立事实，不能把 `never` 提前改写为 `void`。没有正常完成路径的表达式不产生值载荷；普通外层类型仍不能被错误改写为 `never`。

具体 Checked HIR、终止块、合并值、后端 no-return 标记和跨模块契约见 [`../../compiler/ir/1-irContracts.md`](../../compiler/ir/1-irContracts.md) 与 [`../../compiler/abi/1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)。

### 不可达代码诊断

checker 根据语言控制流规则直接证明的顺序不可达语句或必经求值项属于编译错误，包括 `return`、`throw`、准确返回 `never` 的调用、必经 `never` 子表达式、无可达 `break` 的无限循环以及所有分支均终止之后的代码。

该诊断只依据优化前的源码级控制流图。仅因常量传播、函数内联、泛型单态化或后端优化而被删除的代码不产生该错误，编译结果不能依赖优化级别。函数值从 `(...P) => never` 兼容为 `(...P) => void` 后，调用点也不能继续据此判定后续语句不可达。

穷尽检查中的显式 `default` / `assertNever` 防御分支合法；分支内部仍按普通规则完成名称绑定和类型检查。所有不可达代码均须先完成解析、名称绑定和类型检查，不能利用不可达状态隐藏无效声明或类型错误。

### 与 TypeScript 的兼容性

Nxts 保持 TypeScript 的 `never` 底类型、联合归一化、函数形式返回推导和真实泛型候选语义，并收紧可能伪造值、破坏 ABI 或掩盖错误的使用方式：

| 场景                                      | TypeScript                       | Nxts                                                            |
| ----------------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| 底类型与联合中的 `never`                  | 作为底类型并从普通联合中消去。   | 一致。                                                          |
| 命名函数声明与函数表达式的返回推导        | 保留两种函数形式的历史推导差异。 | 一致。                                                          |
| 普通值断言为 `never`                      | 类型擦除环境中允许。             | 编译错误。                                                      |
| 返回 `never` 的已有函数值兼容到值返回函数 | 按返回协变允许。                 | 仅直接兼容 `never` 或 `void` 返回目标；值返回目标要求显式包装。 |
| 源码级顺序不可达代码                      | 诊断受工具配置影响。             | 编译错误。                                                      |
| 无候选泛型参数                            | 可以由顶层类型兜底。             | 编译错误，不使用 `never`、`unknown` 或 `any` 兜底。             |
| 条件类型中的 `never`                      | 具有条件类型和分布式规则。       | 由 T41 独立决定。                                               |

上述差异只缩小 Nxts 接受范围，不为已接受的 JavaScript 求值过程增加新的可观察行为。完成状态比 TypeScript 更精确时，只能用于拒绝不可达源码和优化，不能改写外层静态类型后扩大赋值兼容。

### 编译器职责

checker 处理底类型关系、归一化、可构造性、泛型候选、禁止伪造、函数返回和函数值兼容。控制流分析独立记录静态类型、正常完成和异常完成，传播必经 `never` 子表达式并诊断源码级不可达代码。

语法节点与源码范围归 [`../syntax/1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)，Typed IR 和 lowering 归 [`../../compiler/ir/1-irContracts.md`](../../compiler/ir/1-irContracts.md)，模块与 FFI 契约归 T47–T48。

### 下游依赖

| 能力组             | 需要继承或细化的内容                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| 联合与复合布局     | T21、T26、T31、T34、T37、T45–T47 细化不可构造成员、容器状态、泛型实体代码、布局和 ABI。 |
| 函数与表达式       | T32、T50–T54 继承函数值兼容、从左到右求值、短路路径、调用和语句可达性规则。             |
| 类型级能力与边界   | T41、T43、T48 定义条件类型行为、品牌断言和 FFI 信任边界，不得放宽禁止伪造规则。         |
| 异步、生成器与异常 | T59–T61 定义 `Promise<never>`、生成器完成、`try` / `finally` 覆盖、unwind 和异常 ABI。  |

### 诊断与测试

静态接受、拒绝和推导测试至少覆盖：

| 场景                                                      | 预期结果                                             |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `never` 表达式用于普通目标值位置                          | 接受，不生成值转换。                                 |
| 普通值赋给、断言为或转换为 `never`                        | 编译错误。                                           |
| 显式 `: never` 函数存在 `return;`、普通类型返回或可达末尾 | 编译错误。                                           |
| 命名函数声明、函数表达式、箭头函数以及 `return fail()`    | 推导结果符合 T05 的函数形式规则。                    |
| 必经 `never` 位于调用参数、运算数或构造子表达式           | 外层保持自身静态类型，完成状态为不能完成。           |
| 必经 `never` 之后仍有参数、运算数或语句                   | 编译错误；仍完成名称绑定和类型检查。                 |
| 真实 `never` 泛型候选、混合候选和无候选                   | 分别推导 `never`、吸收到普通候选、产生推导错误。     |
| 返回 `never` 的函数值直接兼容值返回函数                   | 编译错误；兼容到 `void` 或显式上下文包装按规则接受。 |
| 穷尽和未穷尽的 `assertNever`                              | 前者接受，后者因参数不是 `never` 而编译错误。        |

IR、lowering 和跨模块测试由 [`../../compiler/ir/1-irContracts.md`](../../compiler/ir/1-irContracts.md) 与 [`../../compiler/abi/1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 统一覆盖。

## `any` 与 `unknown`

- 小节状态：T17 已定稿

### `any`

`any` 永久不支持。它不属于有效类型集合，不进入类型格、推导、兼容、联合、泛型、函数签名、对象属性、容器元素或跨模块 ABI。

以下 `any` 入口均为编译错误：

```ts
let explicit: any;
const asserted = value as any;
type Values = Array<any>;
```

Babel AST 识别和源码诊断归 [`../syntax/1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)。

缺少注解且无法从上下文或初始化值推导类型时同样产生编译错误，不能形成隐式 `any`。导入声明、FFI 描述、标准库签名、异常、JSON、反射和生成代码不能使用 `any` 绕过该限制。

checker 不提供 TypeScript `any` 的任意属性访问、索引、调用、构造、运算或双向赋值能力，也不能根据值来源对 `any` 进行隐藏特化。此类行为需要通用动态表示、运行时分派或不安全解释，会破坏固定布局、零隐藏成本和跨模块 ABI。

`ReturnType` 等常用内建类型工具由 [T41](./27-advancedTypes.md)、T49 定义专用静态规则，不要求用户通过包含 `any` 的函数约束表达。若语言提供安全动态值能力，其使用前必须经过运行时收窄，不能恢复 `any` 的无检查操作。

### `unknown`

`unknown` 按显式安全动态值类型设计。它可以保存经过显式打包的受支持值，但不能像 TypeScript 顶层类型一样通过普通赋值隐式接收任意 `T`，也不作为推导失败、公共上界或无候选泛型参数的兜底。

普通值进入 `unknown` 必须使用明确的表示转换；具体 API 名称由 T49 定义。FFI、反射、宿主和异常等本身具有动态语义的入口可以在签名中直接返回 `unknown`，其 API 调用即为显式成本边界。

### 类型关系与使用位置

`unknown` 不是 T03 零成本关系中的普通顶类型。普通 `T` 不能直接赋给 `unknown` 参数、返回位置、变量、属性或容器元素；这些位置要求源表达式已经是 `unknown`，或显式执行动态值打包。`never` 表达式仍可用于 `unknown` 目标，因为它不产生运行时值。

```ts
const invalid: unknown = 1; // 编译错误：需要显式动态值打包
const valid: unknown = dynamic(1); // API 名称由 T49 定义

function consume(value: unknown) {}

consume(1); // 编译错误
consume(dynamic(1)); // 合法
```

`unknown` 可以作为变量、对象属性、函数参数、函数返回值、数组元素和泛型实参使用，这些位置存储统一的动态值表示。可选 `unknown` 属性仍可使用对象存在位表示缺失；存在时属性值使用动态表示。

`unknown` 已能显式打包 `null` 和 `undefined`。`unknown` 不能与普通类型直接构造混合联合，`T | unknown` 也不归一化为 `unknown`；调用方必须先把每个普通分支显式打包，使合并结果的静态类型和运行时表示均为 `unknown`：

```ts
const invalid = flag ? dynamic(1) : "text"; // 编译错误
const valid = flag ? dynamic(1) : dynamic("text"); // unknown
```

### 收窄前的合法操作

`unknown` 值在完成收窄、受信任类型检查或 schema 解码前只允许保留动态表示的传递操作，以及能够直接检查动态标签的有限操作：

| 操作                                                     | 规则                                                   |
| -------------------------------------------------------- | ------------------------------------------------------ |
| 复制、存储、传参和返回                                   | 目标位置必须接受 `unknown`。                           |
| `typeof`、`instanceof` 和判别 API                        | 允许；成功分支收窄，失败分支通常仍为 `unknown`。       |
| `=== null`、`!== null`、`=== undefined`、`!== undefined` | 允许并按对应成员收窄。                                 |
| `unknown === unknown`、`unknown !== unknown`             | 允许，结果为 `boolean`；普通非空值一侧必须先显式打包。 |
| `value ?? fallback`                                      | 右侧必须兼容 `unknown`，结果为 `unknown`。             |
| 受信任类型检查                                           | 允许；成功分支得到闭合目标类型。                       |
| schema 解码                                              | 允许；结果类型和失败模型由 T49 定义。                  |

收窄前禁止成员读取与写入、索引、调用、构造、算术、大小比较和直接赋给普通类型。也禁止将 `unknown` 用作条件、逻辑非或其他真值上下文；开放动态类型集合无法在成功分支形成精确且有用的静态类型。`as T` 不能代替受信任类型检查或 schema 解码。

这些操作的单次求值、严格相等、空值和无用户代码行为见 [`../semantics/11-specialValueSemantics.md`](../semantics/11-specialValueSemantics.md)。具体支持范围由 T24、T36、T44、T49 和 T61 细化。

### 与 TypeScript 的兼容性

T17 保持 Nxts 的 TypeScript 严格静态子集约束。显式动态打包、受信任类型检查和 schema 解码必须使用 TypeScript 可解析、可声明的函数或 intrinsic 形式，不新增专用语法。

| 场景                                   | TypeScript                  | Nxts                                               |
| -------------------------------------- | --------------------------- | -------------------------------------------------- |
| 普通 `T` 赋给 `unknown`                | 隐式允许。                  | 要求显式动态打包。                                 |
| `typeof`、`instanceof` 和严格空值检查  | 允许并参与收窄。            | 允许并参与收窄。                                   |
| 严格相等                               | 允许与其他值比较。          | `unknown` 之间允许；普通非空值一侧必须先显式打包。 |
| `unknown as T`                         | 允许类型断言。              | 编译错误，要求受信任类型检查或 schema 解码。       |
| 真值判断                               | 允许并收窄为非 falsy 范围。 | 编译错误。                                         |
| `??`                                   | 允许。                      | 允许，但右侧和结果必须保持 `unknown` 表示。        |
| 成员、索引、调用、构造、算术和大小比较 | 收窄前禁止。                | 收窄前禁止。                                       |

这些差异只缩小 Nxts 的源码接受范围。TypeScript 的 `unknown` 仅是静态约束，JavaScript 值已有统一动态表示；Nxts 必须显式建立动态表示，才能在不向普通静态值传播 tag、装箱和 GC 成本的前提下提供同类安全边界。

`unknown` 的精确布局、动态 GC 扫描、跨模块 ABI 和可打包类型范围由 T44–T48 定义，见 [`../../compiler/representation/1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) 与 [`../../runtime/objects/6-dynamicRuntime.md`](../../runtime/objects/6-dynamicRuntime.md)。普通静态值不为 `unknown` 预留运行时状态。

有限异构数据仍优先使用联合类型，通用算法仍优先使用泛型，JSON 等结构化外部数据优先使用带验证的确定联合类型。`unknown` 用于类型集合无法在编译期封闭的真实动态边界，不能替代这些静态能力。

## `symbol`

- 小节状态：T18 已定稿

`symbol` 是保存唯一运行时身份的不透明基础值类型。`unique symbol` 是绑定具体声明身份的单例静态类型，也是 `symbol` 的下位类型；二者使用相同运行时表示。

### 构造与描述

当前 `Symbol` 入口的候选签名为：

```ts
Symbol(description?: string | number): symbol
```

`const` 直接初始化可以推导新的 `unique symbol`。公开 API 集合见 [`../../stdlib/8-symbol.md`](../../stdlib/8-symbol.md)，唯一身份、描述和不可构造行为见 [`../semantics/11-specialValueSemantics.md`](../semantics/11-specialValueSemantics.md)。

### 类型身份与推导

每个 `unique symbol` 类型由其声明身份确定。不同声明的 `unique symbol` 类型始终不同，即使描述相同。显式 `unique symbol` 注解只允许用于 `const` 声明，以及类能力支持后的 `static readonly` 声明；其他类型位置通过 `typeof token` 引用具体身份。

推导保持 TypeScript 的 widening 规则：

| 场景                            | 推导类型                                                         |
| ------------------------------- | ---------------------------------------------------------------- |
| `const token = Symbol()`        | `typeof token`，新的 `unique symbol`。                           |
| `const alias = token`           | `symbol`；需要保留身份时显式标注 `typeof token`。                |
| `let token = Symbol()`          | `symbol`。                                                       |
| 可写对象属性、数组元素          | `symbol`。                                                       |
| 函数返回 `Symbol()`             | `symbol`，因为每次调用可以产生不同身份。                         |
| 在既有 unique symbol 值之间选择 | 保留对应 `typeof A \| typeof B` 联合，完整规则由 T20、T21 定义。 |

```ts
const token = Symbol("token");
const alias: typeof token = token;

let invalid: unique symbol = Symbol(); // 编译错误：必须使用 const
```

`unique symbol -> symbol` 是零成本单向兼容，反方向不成立。宽 `symbol` 与具体 token 可以执行运行时身份比较，但比较成功后仍保持 `symbol`，不能恢复已经丢弃的声明身份；只有有限 `unique symbol` 联合可以通过严格比较排除成员。两个静态已知且不同的 `unique symbol` 直接比较属于编译错误；需要普通运行时身份比较时，应先显式 widening 为 `symbol`。

### 值操作与合法位置

`symbol` 可以作为变量、对象属性值、函数参数和返回值、数组元素、联合成员及泛型实参使用。它也可以显式打包进入 `unknown`，动态载荷直接保存 symbol 身份，不需要为身份本身装箱。

当前合法操作如下：

| 操作                | 静态规则                                            |
| ------------------- | --------------------------------------------------- |
| 复制、传参和返回    | 保持当前 `symbol` 或精确 `unique symbol` 类型关系。 |
| `typeof value`      | 结果类型包含字符串字面量 `"symbol"`。               |
| `===`、`!==`        | 结果为 `boolean` 并参与有限身份收窄。               |
| truthiness          | 允许用于条件位置，不产生额外值域收窄。              |
| `switch` 和判别字段 | `unique symbol` 可以参与收窄和穷尽检查。            |
| `Map` 键            | 类型能力允许，签名由 T49 定义。                     |

算术、位运算、大小比较、字符串 `+`、模板插值以及向字符串或数值的隐式转换均为编译错误。具体值行为见 [`../semantics/11-specialValueSemantics.md`](../semantics/11-specialValueSemantics.md)。

### 当前不支持的 symbol 能力

当前对象属性键只接受对象规范允许的字符串键，不接受 symbol 键；自定义迭代和元编程协议不进入类型系统。未提供的 `Symbol.*`、实例 API 与反射入口由 [`../../stdlib/8-symbol.md`](../../stdlib/8-symbol.md) 统一列出，语法诊断边界见 [`../syntax/1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)。

### 运行时表示与模块身份

`symbol` 与 `unique symbol` 使用相同标量布局，后者不增加 tag 或包装。身份分配、模块值传递与资源耗尽见 [`../../runtime/values/1-symbolRuntime.md`](../../runtime/values/1-symbolRuntime.md)；布局和跨模块类型身份分别由 T45、T47 定义。

### 扩展边界

当前不支持的 API 不得被永久写死为无法扩展：

| 位置             | 预留要求                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| AST 与语义属性键 | 内部 `PropertyKey` 应可扩展为字符串键或规范 symbol 键。                                       |
| 对象类型描述符   | 属性键编码可扩展，但普通对象实例不预留动态属性表。                                            |
| symbol 身份空间  | 为 well-known symbols、全局 registry 和跨模块共享身份保留分类。                               |
| 迭代检查         | 使用独立的静态可迭代能力，后续可映射到 `[Symbol.iterator]`，不绑定数组特例。                  |
| 对象枚举         | 保持字符串键与 symbol 键分组边界；公开枚举 API 由[对象标准库](../../stdlib/4-object.md)定义。 |

未来开放静态 symbol 属性时仍必须使用固定对象形状；运行时任意增加、删除或按宽 `symbol` 索引对象不属于该扩展承诺。

### 与 TypeScript / JavaScript 的兼容性

`Symbol()` 唯一身份、`const` 的 `unique symbol` 推导、widening、`typeof`、严格相等和 truthiness 保持 TypeScript / JavaScript 行为。Nxts 的差异是拒绝 symbol 属性键、`Symbol.*` 静态成员、实例辅助 API、隐式转换和自定义元编程协议；这些差异只缩小源码接受范围，因此保持 TypeScript 严格静态子集。

## `bigint`

- 小节状态：T19 已定稿

当前核心语言不支持 JavaScript `bigint`。它不进入有效类型集合、类型格、推导、联合、泛型、`unknown` 动态载荷或跨模块 ABI。

### 拒绝范围

bigint 类型、字面量和构造入口均不形成有效类型或表达式：

```ts
const literal = 123n; // 编译错误
let value: bigint; // 编译错误
const converted = BigInt("123"); // 编译错误：不提供内建 BigInt
```

`typeof value === "bigint"` 不能形成有效收窄目标，也是编译错误。导入声明、FFI 描述、标准库签名、类型工具和生成代码均不能使用 `bigint` 绕过该限制。

带 `n` 后缀的字面量不能去掉后缀后静默退化为 `number`。无 `n` 后缀的普通数字字面量仍按 T08 的 JavaScript Number 规则推导；处于原生整数上下文时按目标类型执行范围检查，越界即报错，不能自动改用 bigint。

Babel AST 识别、原始文本保留和拒绝诊断见 [`../syntax/1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)。

### 替代能力

固定宽度原生整数覆盖当前主要的大整数使用场景：

| 场景                                 | 使用类型                                         |
| ------------------------------------ | ------------------------------------------------ |
| 数据库 ID、雪花 ID、时间戳和文件偏移 | `i64` 或 `u64`。                                 |
| 网络协议和持久化字段                 | 协议明确规定的定宽整数。                         |
| 内存大小与地址偏移                   | `usize` 或 `isize`。                             |
| 超过 64 位的外部整数                 | 使用十进制字符串、字节序列或显式 limb 容器传递。 |
| 密码学固定宽度整数                   | 由专用库提供 `u128`、`u256` 或字节数组能力。     |

原生整数具有固定布局、原生算术和可预测 ABI；它们不是 bigint 的隐式近似。超出其范围的程序必须显式选择其他数据表示，不能截断、回绕到其他宽度或借助 `number` 隐藏精度损失。

### 编译器与运行时边界

编译器内部任意精度整数只属于 [`../../compiler/frontend/6-constantEvaluation.md`](../../compiler/frontend/6-constantEvaluation.md) 的实现能力，不能泄漏为语义类型或运行时值。

T45–T48 不提供 bigint 布局、GC、ABI 或 FFI 映射。外部 bigint 必须拒绝，或由未来显式适配器转换为已声明的定宽整数、字符串或字节数据。

### 扩展边界

该拒绝不是永久禁止任意精度整数。出现明确需求时，优先评估标准库 `BigInteger`：使用显式构造、方法调用和所有权明确的结果对象，使分配与复制成本可见。是否进一步支持 JavaScript `bigint` 类型、`n` 字面量和运算符，需要重新确定完整的算术、位运算、转换、内存管理、异常和 ABI 语义。

bigint 字面量原始文本和可扩展常量分派分别由 [`../syntax/1-syntaxSubset.md`](../syntax/1-syntaxSubset.md) 与 [`../../compiler/frontend/6-constantEvaluation.md`](../../compiler/frontend/6-constantEvaluation.md) 保留。该预留不要求当前运行时携带 bigint 代码或元数据。

### 与 TypeScript / JavaScript 的兼容性

TypeScript 和 JavaScript 支持任意精度 `bigint` 基础值及对应字面量和运算。Nxts 完整拒绝该能力，而不是提供固定宽度但同名的近似实现；因此只缩小源码接受范围，保持 TypeScript 严格静态子集。普通 `number` 以及 Nxts 原生整数继续遵守各自已经确定的语义。
