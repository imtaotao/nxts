# 类型推导

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-26
- 文档顺序：5

## 目标

定义 Nxts 在缺少显式类型注解时如何推导变量、表达式、对象字面量、函数返回值和上下文类型中的静态类型。

类型分类见 [`1-typeClassification.md`](./1-typeClassification.md)，类型相等见 [`2-typeIdentity.md`](./2-typeIdentity.md)，赋值兼容见 [`3-typeCompatibility.md`](./3-typeCompatibility.md)，公共上界计算见 [`4-typeLattice.md`](./4-typeLattice.md)。T05 假定名称、作用域和声明绑定已经完成；符号解析、类型/值空间和导入符号绑定由 T57 定义。

## 核心原则

类型推导必须保持 TypeScript 风格语法可解析，并服务于 Nxts 的静态高性能编译目标。推导不能引入 `any`、`unknown`、隐藏装箱、对象裁剪、数值表示转换或运行时检查。

当源码提供显式类型注解时，注解优先；checker 使用赋值兼容规则检查初始化表达式是否能赋给目标类型。

当没有显式类型注解时，checker 应优先推导能真实描述表达式运行时值的静态类型；需要扩大字面量类型时，必须由明确的 widening 规则决定。

推导失败时产生诊断，不退化为动态顶层类型。

## 术语

| 术语         | 含义                                                         |
| ------------ | ------------------------------------------------------------ |
| 推导类型     | checker 从表达式或声明中计算出的静态类型。                   |
| 上下文类型   | 由显式注解、参数位置、返回位置或目标类型反向提供的期望类型。 |
| 字面量保留   | 将字面量表达式推导为对应字面量类型。                         |
| widening     | 将字面量类型扩大为对应基础类型或上下文指定的上位类型。       |
| 最佳公共类型 | 多个候选类型通过类型格计算得到的公共类型。                   |

## 显式注解优先

- 小节结论：已定

显式类型注解优先于默认推导。checker 先解析注解为目标类型，再检查初始化表达式是否赋值兼容。

```ts
const mode: string = "on";
// mode: string

let exact: "on" = "on";
// exact: "on"
```

显式注解不能绕过 Nxts 的兼容和转换规则：

```ts
const count: i32 = 1.5; // 是否合法由数值字面量和数值类型规范决定

const requireNative = (value: number) => {
  const native: i32 = value; // 编译错误：需要显式数值转换
};
```

## 变量声明推导

- 小节结论：已定

`const` 绑定的基础字面量默认保留字面量类型：

```ts
const mode = "on";
// mode: "on"

const enabled = true;
// enabled: true
```

`let` 绑定的基础字面量默认 widening 到对应基础类型：

```ts
let status = "ready";
// status: string

status = "done"; // 合法
```

显式注解可以要求 `let` 使用字面量类型：

```ts
let status: "ready" = "ready";
status = "done"; // 编译错误
```

数字字面量的默认类型、上下文推导到原生数值类型、越界诊断和负数字面量规则由字面量类型与数值类型规范定义。T05 只规定 `const` 默认保留、`let` 默认 widening 的方向。

## `symbol` 推导

- 小节结论：已定

直接以 `Symbol()` 初始化的 `const` 声明获得新的 `unique symbol` 类型。该精确身份不会默认传播到可重新赋值或可批量存储的位置：

```ts
const token = Symbol("token"); // typeof token
const alias = token; // symbol
const exact: typeof token = token;

let mutable = Symbol(); // symbol
const values = [token]; // symbol[]
const object = { token }; // { token: symbol }
```

函数返回 `Symbol()` 时推导为 `symbol`，因为不同调用可以产生不同身份。条件表达式在既有 `unique symbol` 值之间选择时保留对应联合；数组元素、可写对象属性、普通别名和无精确上下文的泛型候选按 T18 widening 为 `symbol`。显式上下文为 `typeof token` 时可以保留身份，但不能把其他 symbol 赋给该位置。

## 对象字面量属性推导

- 小节结论：已定

对象字面量属性默认 widening。即使对象绑定使用 `const`，对象属性仍可写，不能因为绑定不可重新赋值就把可写属性推导为过窄字面量类型。

```ts
const config = {
  mode: "on",
};
// config: { mode: string }

config.mode = "off"; // 合法
```

需要保留对象属性字面量类型时，使用显式类型注解或 [`as const`](./26-typeOperators.md)：

```ts
const config: { mode: "on" } = {
  mode: "on",
};

config.mode = "off"; // 编译错误
```

`as const` 按 T40 保留直接字面量、递归处理当前字面量并产生 readonly 对象或元组；完整规则见 [`26-typeOperators.md`](./26-typeOperators.md)。

计算属性 key 已经扩大为宽 `string` 或 `number` 时，对象字面量按 T30 推导为字典。对应索引域的条目值使用 T04 最小公共上界和 T21 规范联合，不使用 `any` 或 `unknown` 兜底：

```ts
const inferDictionary = (key: string) => {
  const text = { [key]: "value" };
  // { [key: string]: string }

  const mixed = { [key]: "value", count: 1 };
  // { [key: string]: string | number }
};
```

宽数值 key 只合并数值属性名对应的条目值；`count` 等非数值字符串成员保留独立固定成员类型。单个字面量 key 仍产生固定属性；有限字面量联合产生 T26 定义的精确对象联合或固定存在位布局。没有上下文的 `{}` 保持精确空对象；存在索引签名上下文时，`{}` 直接创建对应原生空字典。完整分流、缺失读取和来源视图规则见 [`18-dictionaryTypes.md`](./18-dictionaryTypes.md)。

## 基础表达式推导

- 小节结论：已定

基础表达式按其语言类型直接推导：

| 表达式           | 无上下文推导                               |
| ---------------- | ------------------------------------------ |
| `true` / `false` | 布尔字面量类型                             |
| 字符串字面量     | 字符串字面量类型                           |
| 数字字面量       | 数字字面量类型，默认数值类型由数值规范定义 |
| `null`           | `null`                                     |
| `undefined`      | `undefined`                                |

表达式语句可以忽略表达式结果；这不改变表达式本身的推导类型。

## 条件表达式推导

- 小节结论：已定

条件表达式根据是否存在上下文类型采用不同流程。

存在上下文类型时，checker 使用上下文类型分别检查两个分支：

```ts
const mode: string = flag ? "on" : "off";
// mode: string
```

无上下文类型时，checker 先分别推导两个分支类型，再使用 T04 的最小公共上界规则合并：

```ts
const mode = flag ? "on" : "off";
// mode: "on" | "off"

const value = flag ? "on" : 1;
// value: "on" | 1
```

条件表达式不会退化为 `any` 或 `unknown`。如果公共上界需要联合类型，但当前位置或当前语言版本不支持对应联合表达，则产生诊断。

`never` 分支被另一侧吸收：

```ts
const value = flag ? fail("missing") : "ready";
// value: "ready"
```

条件表达式合并不执行对象裁剪、数值提升、隐藏装箱或运行时类型检查。

## 函数返回值推导

- 小节结论：已定

显式返回类型优先。函数声明了返回类型时，checker 使用该返回类型检查每个 `return` 语句和可达的函数末尾：

```ts
function read(flag: boolean): string {
  if (flag) {
    return "ok";
  }

  return; // 编译错误：undefined 不能赋给 string
}
```

可达的函数末尾和 `return;` 形成无值完成路径。显式返回类型为 `void`、`undefined` 或包含 `undefined` 的联合类型时，该路径合法；其他值返回类型产生诊断。`void` 返回位置还允许 `return undefined;`，但这不建立两种类型之间的赋值兼容。

没有显式返回类型时，checker 收集所有源码级可达的有值 `return expression` 的静态表达式类型，并使用 T04 的最小公共上界规则合并。静态结果类型与表达式能否正常完成是两个独立事实；嵌套子表达式终止求值时，不能把外层表达式已经确定的静态类型改写为 `never`。

候选合并结果只有一个布尔、字符串或数字字面量成员时，按 T20 widening 到对应基础类型；包含多个不同字面量成员或表达式本身已经形成字面量联合时保留联合。显式返回类型和上下文函数类型优先，不执行该默认 widening。

```ts
function read(flag: boolean) {
  if (flag) {
    return "ok";
  }

  return "missing";
}
// () => "ok" | "missing"
```

没有有值 `return expression`，只有可达函数末尾或无值 `return;` 的函数，返回类型推导为 `void`：

```ts
function log(message: string) {
  console.log(message);
}
// (message: string) => void
```

只要存在至少一个有值 `return expression`，所有无值 `return;` 和可达函数末尾都按 `undefined` 参与公共上界。显式 `return undefined;` 属于有值返回，因此只有该形式的函数推导为 `undefined`，而不是 `void`：

```ts
function read(flag: boolean) {
  if (flag) {
    return "ok";
  }

  return;
}
// () => "ok" | undefined

function missing() {
  return undefined;
}
// () => undefined
```

`throw`、无限循环和不包含 `return expression` 的其他终止分支不增加返回类型成员。`return expression` 的静态类型为 `never` 时形成 `never` 返回候选；所有有值返回候选均为 `never` 时，函数返回类型推导为 `never`。

为保持 TypeScript 的函数推导语义，没有有值返回候选且所有路径均不能正常完成时按函数形式区分：命名函数声明推导为 `void`，函数表达式和箭头函数推导为 `never`。希望命名函数声明公开稳定的 `never` 返回契约时，应显式标注返回类型。

```ts
function declarationThrow() {
  throw new Error("failed");
}
// () => void

const expressionThrow = () => {
  throw new Error("failed");
};
// () => never

function declarationReturn() {
  return fail("failed");
}
// () => never
```

外层返回表达式具有普通静态类型时，该类型仍参与推导，即使某个必经子表达式使求值不能完成：

```ts
function returnsNumber(value: never): number {
  return 1;
}

function nestedReturn() {
  return returnsNumber(fail("failed"));
}
// () => number；函数体的正常完成状态为“不能完成”
```

实现内部证明出的不返回状态可以用于控制流和后端优化，但不能反向改写函数的语言返回类型。具体规则由 T16 定义。

直接或互相递归的函数形成调用强连通分量。该分量必须具有足够的显式返回类型或上下文函数类型，使所有递归返回依赖得到唯一类型；checker 不通过无界固定点迭代猜测返回类型，也不退化为 `any`、`unknown` 或隐式 `void`。递归值入口、递归函数组和泛型增长检测由 [`19-recursiveTypes.md`](./19-recursiveTypes.md) 定义。

`async` 函数、`Promise` 包装和 `await` 解包规则由 T59 定义；生成器函数返回规则由 T60 定义；相关标准库类型边界由 T49 定义。

## 数组字面量推导

- 小节结论：已定

数组字面量在无上下文类型时默认推导为数组类型，不默认推导为元组。checker 先应用 T34 的整组数值字面量规则；其他元素分别形成候选类型，再由 T04 求零成本公共类型或规范联合。数组创建后不会因后续写入重新计算元素类型。

```ts
const values = [1, 2, 3];
// values: i32[]

values.push(4); // 合法

const mixed = [1, "x"];
// mixed: (i32 | string)[]
```

默认数组保留 JavaScript/TypeScript 用户对数组可变长度容器的直觉。元组表达固定长度和固定位置类型，必须由上下文类型、显式注解或 T40 定义的 `as const` 触发；完整规则见 [`22-tupleTypes.md`](./22-tupleTypes.md)：

```ts
const point: [i32, i32] = [x, y];
// point: [i32, i32]
```

空数组没有元素候选类型。无上下文类型时，checker 必须要求显式注解，不能推导为 `any[]`、`unknown[]` 或 `never[]`：

```ts
const values = []; // 编译错误：缺少数组元素类型

const typed: i32[] = []; // 合法
```

默认推导为数组不代表采用 JavaScript 动态数组实现。Nxts 数组使用编译期固定元素类型、稠密存储、紧凑原生标量数组、边界检查和逃逸分析获得比 JavaScript 数组更稳定的性能。具体的元素类型、联合和写入规则由 [`21-arrayTypes.md`](./21-arrayTypes.md) 定义，空洞与索引行为由[数组语义](../semantics/6-arraySemantics.md)定义。编译器不得为了优化把具有数组语义的值隐式改写为元组或固定布局对象；需要固定长度或固定字段布局时，程序必须显式表达。

## 对象字面量上下文推导

- 小节结论：已定

对象字面量存在上下文类型时，checker 按目标对象形状检查属性集合、属性类型、可选属性和写权限规则。

```ts
type Point = {
  x: i32;
  y: i32;
};

const point: Point = { x: 1, y: 2 }; // 合法
const extra: Point = { x: 1, y: 2, z: 3 }; // 编译错误：对象形状不同
```

精确对象上下文不采用 TypeScript 新鲜对象字面量特例。对象字面量、变量赋值、函数参数和函数返回值使用同一套精确形状规则。

无上下文类型时，对象字面量由自身属性集合推导对象形状；属性表达式按对象属性默认 widening 规则处理：

```ts
const config = {
  mode: "on",
};
// config: { mode: string }
```

可选属性不能通过省略自动从无上下文对象字面量中推导出来；需要可选属性时必须提供上下文类型或显式注解：

```ts
type Options = {
  mode?: string;
};

const options: Options = {}; // 合法
const inferred = {}; // 推导为空对象形状，是否支持裸 {} 由对象规范定义
```

`readonly` 不由普通对象字面量默认推导产生；它来自上下文类型、显式类型注解或 `as const`。

接口上下文是独立的结构契约检查，不要求源对象与接口具有相同精确形状。源表达式先得到自己的具体对象类型，再按 T29 检查并形成接口视图；这不会反向改变源变量的推导类型：

```ts
interface OptionsView {
  cache?: string;
}

const raw = {}; // 精确空对象形状
const options: OptionsView = raw; // 合法：可选成员可以缺失
options.cache = "memory"; // 合法：存储语义由 T29 定义
```

若接口存在源对象未提供的必选成员，仍然编译错误。接口转换可能生成固定大小的 `InterfacePack`，但不执行运行时字段扫描、对象复制或堆分配。

## 空值初始化推导

- 小节结论：已定

`null` 和 `undefined` 可以单独用于变量初始化。没有上下文类型时，checker 推导为对应的单独空值类型，不猜测后续会赋入的普通类型。

```ts
let empty = null;
// empty: null

empty = "value"; // 编译错误

let missing = undefined;
// missing: undefined

missing = 1; // 编译错误
```

需要后续赋入其他类型时，必须显式声明联合类型：

```ts
let name: string | null = null;
name = "Nxts"; // 合法

let value: i32 | undefined = undefined;
value = 1; // 合法
```

该规则不退化到 `any` 或 `unknown`，也不把 `null` 与 `undefined` 自动合并。

## 泛型调用推导

- 小节结论：已定

T05 只定义普通值级泛型函数调用的推导边界。checker 可以从实参类型、显式类型参数、上下文返回类型和泛型约束中推导类型参数，但不能为了推导成功引入 `any`、`unknown`、隐式转换、对象裁剪或运行时检查。

显式类型参数优先于推导：

```ts
function id<T>(value: T): T {
  return value;
}

const text = id<string>("on");
// text: string
```

没有显式类型参数时，checker 从实参中收集候选类型。多个候选不能无条件使用 T04 构造联合；泛型规范根据 TypeScript 的候选优先级、声明位置、约束和 widening 规则决定结果：

```ts
function choose<T>(left: T, right: T): T {
  return left;
}

function pair<T>(left: T, right: T): T[] {
  return [left, right];
}

const selected = choose("on", "off");
// T 推导为 "on" | "off"

const modes = pair("on", "off");
// T 推导为 string，modes 为 string[]
```

不同基础类别的候选不能仅为完成推导而自动合成为联合。精确字面量保留、容器 widening、回调候选顺序和约束候选由 [`24-generics.md`](./24-generics.md) 定义。

静态类型真实为 `never` 的实参可以提供泛型候选。所有候选均为 `never` 时推导对应类型参数为 `never`；同时存在普通候选时，`never` 按 T04 底类型规则被普通候选吸收。表达式能否正常完成仍按 T16 独立传播，不改变泛型调用的静态结果类型。

```ts
const onlyNever = id(fail("failed"));
// onlyNever: never

const mixed = pair(1, fail("failed"));
// mixed: 1；调用不能正常完成
```

如果无法推导某个类型参数，必须要求显式类型参数或产生诊断：

```ts
type Factory = <T>() => T;

const useFactory = (make: Factory) => {
  const value = make(); // 编译错误：无法推导 T
  const text = make<string>(); // 合法
};
```

简单 `extends` 约束、默认类型参数、部分显式类型参数、候选优先级、方差和约束求解由泛型规范定义。T05 只规定：约束不满足时必须报错，不能通过动态顶层类型或隐式转换绕过。

T05 的普通值级推导不隐式执行条件类型、`infer`、分布式条件类型或映射类型。用户可以在显式类型别名和其他合法类型位置使用 [T41 高级类型](./27-advancedTypes.md)；这些运算由独立的静态类型计算器处理，不能以 `any` 或隐式 `unknown` 作为失败兜底。

值级语言能力仍使用对应规范定义的静态入口。例如 `await Promise<T>` 得到 `T` 由 T59 定义，并与 T41 的 `Awaited<T>` 使用同一完成值规则：

```text
await Promise<T> => T
```

此类值级提取不能仅因用户定义了相似条件类型而自动获得运行时能力。用户级类型模式负责静态结果；Promise 状态、thenable 识别和 `await` lowering 仍由 T59 明确开放。

## `satisfies`

- 小节结论：已定

Nxts 不支持 `satisfies`。该能力只提供“按目标契约检查，同时保留源表达式推导结果”的开发体验，不增加新的值、类型构造或运行时能力；显式类型注解已经提供目标契约检查。为避免给上下文推导、对象精确形状、readonly、泛型和重载增加另一套组合入口，Nxts 将其排除在有效表达式之外。

parser 和 Babel AST converter 可以识别并保留该语法节点，以便在 `satisfies` 位置产生明确诊断。checker 不为该节点创建可继续传播的有效类型，不执行目标类型参与的上下文推导，也不生成赋值兼容或表示转换；该表达式不得进入 Typed IR。

```ts
const config = {
  mode: "on",
} satisfies Config;
// 编译错误：Nxts 不支持 satisfies
```

需要表达目标契约时，使用显式类型注解：

```ts
const config: Config = {
  mode: "on",
};
```

## 下游规范事项

本规范的普通推导规则已经确定。以下内容由对应能力规范继续细化：

| 能力               | 下游规范职责                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| 数值类型与字面量   | 数字字面量默认类型、上下文原生数值推导、越界和负数字面量。                                                      |
| 数组与元组         | 数组元素公共类型、元组上下文检查、只读数组和固定布局容器。                                                      |
| 函数、异步与生成器 | `void` 返回细节由函数和特殊类型规范定义；`async` / `Promise` 包装由 T59 定义；生成器返回规则由 T60 定义。       |
| 递归类型           | 递归值入口、递归函数 SCC、泛型惰性实例化和无界增长诊断由 T31 定义。                                             |
| 泛型               | `extends` 约束、默认类型参数、部分显式类型参数、方差和约束求解。                                                |
| 类型级能力         | `as const` 由 T40 定义；条件类型、`infer`、映射和模板字符串类型由 T41 定义；`satisfies` 的拒绝边界由 T42 定义。 |
