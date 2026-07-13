# 类型运算符

- 任务编号：T40、T42
- 规范状态：已定稿
- 文档顺序：26

## 目标与边界

本规范定义 `keyof`、类型位置的 `typeof`、索引访问类型 `T[K]` 和 `as const`。这些能力用于从已知静态类型和值绑定中查询或保留类型信息，不建立运行时类型对象、反射系统或动态类型运算。

性能是类型运算符设计的第一优先级。普通类型运算必须在 checker 中完全消解，不能向 Typed IR、ABI 或最终程序增加类型描述符、分配、隐藏参数、动态分派或初始化代码。只有值级源码本身要求动态字段访问、有限键分派、字典查询或 spread 时，程序才承担对应值操作的固有成本。

规范化、缓存和复杂度实现见 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)，阶段消解契约见 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)，跨模块静态配方见 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)。

以下能力由其他规范定义：

| 能力                                        | 规范归属     |
| ------------------------------------------- | ------------ |
| 类型身份、兼容、类型格和推导                | T02–T05      |
| 控制流收窄和穷尽检查                        | T06          |
| 基础值、原生数值、字符串和字面量            | T07–T13、T20 |
| 特殊类型、联合、交叉和空值                  | T15–T23      |
| 对象、接口、字典和递归类型                  | T26–T31      |
| 函数、数组、元组、类、泛型和枚举            | T32–T39      |
| 条件类型、`infer`、映射类型和模板字符串类型 | T41          |
| `satisfies`                                 | T42          |
| 普通类型断言和表示转换                      | T43–T44      |
| 标准类型的完整公开成员集合                  | T49          |
| 值级成员访问和索引访问                      | T51          |
| 模块解析和模块命名空间                      | T55          |
| 别名写入和调用副作用造成的事实失效          | T58          |

## 核心原则

| 原则        | 要求                                                                              |
| ----------- | --------------------------------------------------------------------------------- |
| 纯静态      | 类型运算结果只存在于 parser、binder、checker 和编译元数据中。                     |
| TS 严格子集 | 语法和常用结果优先保持 TypeScript strict；Nxts 可以因既定静态边界而拒绝更多程序。 |
| 实际能力    | 运算结果只能暴露 Nxts 类型真实支持的键、成员和写权限。                            |
| 安全读取    | 数组、元组和字典的动态索引结果必须反映缺失或越界产生的 `undefined`。              |
| 不恢复能力  | 类型运算不能恢复 symbol 键、类原型、枚举对象、未支持标准 API、`any` 或动态反射。  |
| 确定计算    | 递归、泛型和大型键集合使用规范 TypeId、缓存及确定的工作预算。                     |
| 明确失败    | 无法完成静态计算时编译错误，不扩大为 `string`、`unknown` 或其他兜底类型。         |

## 支持的语法

T40 支持以下 TypeScript 语法：

```ts
type UserKeys = keyof User;
type ConfigType = typeof config;
type UserName = User["name"];

const fixed = {
  mode: "fast",
  retries: 3,
} as const;
```

运算可以组合：

```ts
type StateKeys = keyof typeof State;
type StateValues = (typeof State)[StateKeys];
```

类型级 `typeof` 与运行时一元 `typeof` 是不同语法入口：

```ts
type StaticType = typeof value;
const runtimeKind = typeof value;
```

前者产生类型，不求值；后者产生运行时字符串并由 T50 定义。

## 键域

Nxts 当前类型运算键域由字符串和数字组成：

```text
TypeKey = StringKey | NumberKey
```

symbol 值仍可用于身份比较，但 symbol 属性键和相关元编程协议尚未开放，因此 T40 不产生或接受 symbol 键。未来增加 symbol 属性键时必须扩展类型键域、对象布局、字典、模块元数据和 ABI，不能只修改 `keyof` 的显示结果。

固定数值属性在运行时继续按 T26、T30 规范化为 JavaScript 字符串属性键。类型级公开键保留 TypeScript 可表达的数值或字符串键种类；该种类进入类型运算摘要，但不改变字段偏移、值布局或运行时属性名。数值键和等价数值字符串在索引解析时可以命中同一规范属性，但同一对象形状不能声明两个运行时规范名相同的独立字段。

数组和元组的元素索引使用 Nxts 已确定的 `i32`，不是宽 `number`。普通字符串或数值字典继续使用 T30 的 `string`、`number` 键域。

## `keyof`

`keyof T` 计算类型 `T` 可由对应静态视图安全访问的公开键集合。结果是规范字面量联合、宽字符串或数字键域、`never`，或者尚未实例化的符号类型运算。

### 固定对象

固定对象返回全部静态成员名称：

```ts
type User = {
  readonly id: i32;
  name?: string;
  run(): void;
};

type UserKey = keyof User;
// "id" | "name" | "run"
```

成员是否必选、可选、可写或 readonly 不影响键是否存在于类型形状中。对象方法与函数值属性都按其公开属性名参与键集合。

裸 `{}` 不是有效 Nxts 对象类型，因此不通过 `keyof {}` 建立 TypeScript 的非空顶层类型语义。精确空对象形状只在已有规范允许的具体推导位置存在，其 `keyof` 结果为 `never`。

### 接口和类实例

接口的 `keyof` 返回公开契约成员，包括继承后展开的属性和方法：

```ts
interface Named {
  name: string;
}

interface User extends Named {
  id: i32;
}

type UserKey = keyof User;
// "name" | "id"
```

类实例类型只返回 public 实例字段、方法和访问器。private、protected、静态成员、默认 `constructor` 和内部类描述信息不属于实例 `keyof`：

```ts
class Service {
  public name = "service";
  private token = "secret";

  run(): void {}
}

type ServiceKey = keyof Service;
// "name" | "run"
```

类型运算不能绕过访问控制。private 和 protected 成员即使具有运行时字段，也不能经 `keyof` 或索引访问类型泄漏为公共契约。

### 联合与交叉

联合类型只保留所有成员都能安全访问的公共键：

```ts
type Left = {
  id: i32;
  name: string;
};

type Right = {
  id: i32;
  enabled: boolean;
};

type CommonKey = keyof (Left | Right);
// "id"
```

概念规则为各联合成员键集合的交集。不能因为运行时值只会是一个成员，就把只存在于部分成员上的键加入未收窄联合的公开结果。

交叉类型先按 T22 完成规范化，再对最终具体类型求键：

```ts
type Combined = {
  name: string;
} & {
  age: i32;
};

type CombinedKey = keyof Combined;
// "name" | "age"
```

规范化为 `never` 的交叉按特殊类型规则处理。T40 不自行执行新的交叉分配、对象合并或运行时字段组合。

### 字典

字典键集合与 TypeScript 的索引签名方向保持一致：

```ts
type StringTable = {
  [key: string]: i32;
};

type NumberTable = {
  [key: number]: i32;
};

type StringKey = keyof StringTable;
// string | number

type NumberKey = keyof NumberTable;
// number
```

字符串字典包含 `number`，因为数值键会按 JavaScript 规则规范化为字符串。数值字典只包含数值键域；显式声明的非数值固定成员可以额外形成字符串字面量键。

宽索引签名已经覆盖的固定键不重复扩大结果。readonly 只改变写权限，不改变可读取键域。

### 数组

数组键集合由元素索引、`length` 和该数组类型实际支持的公开方法组成：

```ts
type MutableArrayKey = keyof string[];
// i32 | "length" | 已支持的数组方法名

type ReadonlyArrayKey = keyof (readonly string[]);
// i32 | "length" | 已支持的只读数组方法名
```

规则如下：

- 元素索引键为 `i32`。
- `length` 始终存在；readonly 数组不能写入它。
- mutable 数组包含 T34 已支持的原地修改方法。
- readonly 数组不包含原地修改方法。
- `copyWithin`、ES2020 之后的方法和其他未支持 API 不进入结果。
- `Symbol.iterator` 不进入结果；静态迭代由 T60 定义。

类型成员集合最终由 T34 与 T49 的公开标准声明共同确定，T40 不自行增加数组方法。

### 元组

元组包含固定位置字符串键、动态 `i32` 索引、`length` 和实际支持的数组成员：

```ts
type Entry = [string, i32];
type EntryKey = keyof Entry;
// i32 | "0" | "1" | "length" | 已支持的数组方法名
```

元组标签只用于可读性和工具展示，不是属性键：

```ts
type Point = [x: i32, y: i32];
// "x" 和 "y" 不属于 keyof Point
```

optional 和 rest 元组按 T35 的长度形状增加实际可能位置。readonly 元组不包含原地修改方法。mutable 固定元组即使能够取得某个数组方法的成员类型，调用仍须满足 T35 的固定长度和逐位置安全规则。

### 基础值和函数

基础值返回其实际公开成员：

| 输入                           | `keyof` 结果                                       |
| ------------------------------ | -------------------------------------------------- |
| `string` 及字符串字面量        | `i32`、`"length"` 和已支持字符串成员名             |
| `number`、原生数值及数字字面量 | 对应数值类型实际支持的成员名                       |
| `boolean` 及布尔字面量         | 对应布尔类型实际支持的成员名                       |
| 函数类型                       | `never`；与 TypeScript 调用签名的 `keyof` 结果一致 |
| 数字枚举值类型                 | 对应 `i32` 的公开成员键                            |
| 字符串枚举值类型               | 对应 `string` 的公开成员键                         |

普通函数不因 JavaScript `Function.prototype` 获得 `call`、`apply`、`bind`、`prototype` 或动态属性键。虽然 T32 允许显式读取内建 `name`、`length`，TypeScript 不把它们加入普通调用签名的 `keyof`；Nxts 保持相同类型级结果。显式索引访问类型仍可查询这两个已知属性。

### 特殊类型

| 输入        | 结果                     |
| ----------- | ------------------------ |
| `unknown`   | `never`                  |
| `null`      | `never`                  |
| `undefined` | `never`                  |
| `never`     | `string \| number`       |
| `void`      | 编译错误                 |
| `any`       | 不存在，语言不支持 `any` |

`keyof never` 表示空联合的通用字符串和数字键约束，保持 TypeScript 的集合代数方向，但不包含尚未支持的 symbol。该结果不为 `never` 创建运行时值。

`void` 只能位于 T15 允许的结果位置，不能借类型运算进入普通类型位置。

### 类静态侧

`keyof typeof ClassName` 返回类构造器类型声明的 public 静态成员和继承后可见的静态成员：

```ts
class Service {
  static version = 1;
}

type ServiceStaticKey = keyof typeof Service;
// "version"
```

TypeScript 还会加入 `"prototype"`，Nxts 因 T36 不开放类原型对象而将其排除。内建 `name`、`length` 与 TypeScript 一样可以被显式读取和索引查询，但不加入类静态 `keyof`。private 和 protected 静态成员不能通过类型运算绕过访问控制。

### 枚举静态命名空间

`keyof typeof EnumName` 返回枚举源码成员名称：

```ts
enum State {
  Idle,
  Running,
}

type StateKey = keyof typeof State;
// "Idle" | "Running"
```

重复值别名仍具有不同静态名称，因此都进入键集合；空枚举的静态键结果为 `never`。该计算使用 T39 的静态命名空间，不要求或生成运行时枚举对象。

## 类型查询

类型位置的 `typeof value` 取得值绑定在查询位置的静态类型：

```ts
const config = {
  host: "localhost",
  port: 8080,
};

type Config = typeof config;
// { host: string; port: i32 }
```

类型查询复用 T05 已经完成的推导和 widening，不重新分析初始化器，也不会因为查询本身恢复已经丢失的字面量、元组或 readonly 信息。

### 合法操作数

类型查询只接受 TypeScript 类型查询语法能够表达的绑定名称和静态属性链：

```ts
type ConfigType = typeof config;
type HostType = typeof config.host;
```

任意调用、构造、算术、逻辑、条件或其他一般表达式不能作为类型查询操作数：

```text
type First = typeof createConfig();
type Second = typeof (left || right);
// 两处均编译错误
```

需要函数返回类型时使用 T41 决定的 `ReturnType<typeof fn>`。类型别名、接口和其他只有类型空间绑定的名称不能作为查询目标：

```ts
interface User {}
type Invalid = typeof User;
// 编译错误：User 没有值绑定
```

未声明名称产生普通名称绑定错误。类型位置的 `typeof undeclaredName` 不继承 JavaScript 运行时 `typeof` 对未声明名称的特殊行为。

### 控制流类型

类型查询读取准确源码位置已经建立的控制流类型：

```ts
function read(value: string | i32) {
  if (typeof value === "string") {
    type Current = typeof value;
    // string
  }
}
```

类型别名建立后结果保持不变，后续赋值或事实失效不会回写已经建立的别名。属性查询使用该位置仍然有效的属性事实；对象、别名、闭包或调用造成的失效由 T06、T58 决定。

### 声明顺序和循环

纯类型查询可以向前引用已经由 binder 建立、且类型能够无循环求解的后置值声明：

```ts
type Config = typeof config;

const config = {
  port: 8080,
};
```

该查询不读取运行时值，不触发暂时性死区或模块初始化。值位置仍遵循 T57 的声明顺序。

类型查询、类型注解和初始化器形成无基础类型的循环时编译错误：

```ts
type State = typeof state;
const state: State = createState();
// 编译错误：循环类型查询
```

显式声明的合法递归类型继续复用 T31 的符号回边，不因包含 `typeof` 就展开为无限结构。

### 函数与重载

函数查询保留公开函数签名、泛型参数、接收者和有序重载集合：

```ts
function parse(value: string): string;
function parse(value: i32): i32;
function parse(value: string | i32) {
  return value;
}

type Parse = typeof parse;
```

实现签名不进入查询结果。[T41](./27-advancedTypes.md) 规定 `ReturnType` 和条件 `infer` 使用最后一个公开重载；T40 只负责保留 T33 已定义的有序公开重载类型。

### 类构造器

`typeof ClassName` 产生 T36 已定义的类构造器类型：

```ts
class User {
  static version = 1;

  constructor(readonly name: string) {}
}

type UserClass = typeof User;
```

结果包含：

- 名义实例结果。
- 公开构造签名及重载。
- public 静态成员和继承关系。
- 内建只读 `name`、`length`。
- 运行时类身份能力。

结果不包含可访问 `.prototype`，也不能绕过 private、protected、确定初始化或构造兼容规则。

### 枚举命名空间

`typeof EnumName` 产生 T39 的编译期静态命名空间类型：

```ts
enum State {
  Idle,
  Running,
}

type StateNamespace = typeof State;
type Idle = StateNamespace["Idle"];
```

该类型只允许继续参与 `keyof`、索引访问和 T41 的类型级运算。它不能作为变量、属性、参数、返回值或普通泛型存储实参：

```ts
const enumObject: typeof State = State;
// 编译错误：不存在运行时枚举对象
```

`typeof State.Idle` 直接得到精确成员类型 `State.Idle`。

### 模块查询

T40 保留 TypeScript 的静态模块类型查询：

```ts
type ApiModule = typeof import("./api");
```

规则如下：

- 模块说明符必须是静态字符串。
- 结果只包含 T55 判定为公开可见的导出。
- 查询本身不执行动态 `import()`，不创建 Promise，也不初始化模块。
- 仅用于类型的查询不应强制保留运行时模块命名空间对象。
- 模块路径解析、循环、条件导出和命名空间对象值语义由 T55 定义。

动态模块说明符和一般 `import(expression)` 不因支持该类型语法而获得支持。

## 索引访问类型

索引访问类型 `T[K]` 计算类型 `T` 使用类型键 `K` 读取时的静态结果。它不执行值级字段访问；值级求值顺序、边界检查、异常和 lowering 由 T51 定义。

### 固定属性

```ts
type User = {
  id: i32;
  name: string;
  nickname?: string;
};

type Id = User["id"];
// i32

type Identity = User["id" | "name"];
// i32 | string

type Nickname = User["nickname"];
// string | undefined
```

规则如下：

- 必选属性返回声明读取类型。
- 可选属性加入缺失产生的 `undefined`。
- readonly 不改变读取结果。
- 方法返回对应函数类型。
- 键联合逐键查询并规范化结果联合。
- 不存在的固定键编译错误。

数值键和可规范化为同一属性的数值字符串按 T26、T30 解析到同一字段。静态键类型仍须属于目标类型允许的键域。

### 联合与交叉目标

未收窄联合只能查询全部成员都支持的键：

```ts
type Left = {
  id: i32;
  name: string;
};

type Right = {
  id: i32;
  enabled: boolean;
};

type Id = (Left | Right)["id"];
// i32

type Name = (Left | Right)["name"];
// 编译错误
```

公共键在不同成员上具有不同读取类型时，结果为规范联合。T40 不为类型查询生成运行时 tag 分派。

交叉目标先按 T22 规范化。对象成员冲突已经归一为具体类型或 `never` 后，再执行索引访问。

### 字典

动态字典索引反映键缺失：

```ts
type Table = {
  [key: string]: i32;
};

type Value = Table[string];
// i32 | undefined
```

该规则比 TypeScript 默认类型级索引更严格，并与 T30 的值读取保持一致。已知固定成员优先使用成员自身的类型和可选性：

```ts
type Config = {
  mode: string;
  [key: string]: string;
};

type Mode = Config["mode"];
// string

type Dynamic = Config[string];
// string | undefined
```

readonly 字典具有相同读取结果。写权限不能由索引访问类型推导恢复。

### 数组

```ts
type Item = string[][i32];
// string | undefined

type Length = string[]["length"];
// i32
```

动态元素索引加入越界产生的 `undefined`。固定公开成员返回 T34、T49 声明的方法或属性类型。不存在于 Nxts 数组 API 的键编译错误。

readonly 数组不能查询只属于 mutable 数组的原地修改方法。索引访问类型不会因为某个值级循环能够证明边界而删除 `undefined`；值级控制流收窄由 T06、T51 处理。

### 元组

固定位置返回精确位置类型：

```ts
type Entry = [string, i32];

type First = Entry[0];
// string

type Second = Entry["1"];
// i32
```

规则如下：

- 可选位置结果包含 `undefined`。
- 已知越界位置编译错误。
- 宽 `i32` 返回所有可能位置类型的规范联合，并包含 `undefined`。
- 键联合按每个位置分别计算。
- `length` 复用 T35 的固定字面量或 optional、rest 长度类型。
- 数组成员键返回该元组实际支持的方法类型。

```ts
type AnyEntry = Entry[i32];
// string | i32 | undefined

type Invalid = Entry[2];
// 编译错误
```

### 基础值、函数和枚举值

```ts
type Character = string[i32];
// string | undefined

type StringLength = string["length"];
// i32

type FunctionName = (() => void)["name"];
// string
```

基础值和字面量只允许查询其实际成员。数字枚举值复用 `i32` 成员，字符串枚举值复用 `string` 成员；运算结果不会恢复枚举身份。

函数只允许 `"name"`、`"length"`。不能通过索引访问类型恢复 `call`、`apply`、`bind`、`prototype` 或动态属性。

### 类静态侧与枚举命名空间

```ts
class Service {
  static version = 1;
}

type Version = (typeof Service)["version"];
// i32
```

类静态索引遵守 T36 的可见性、继承和静态成员规则。`.prototype` 编译错误。

枚举静态命名空间只接受已声明成员名称：

```ts
enum State {
  Idle,
  Running,
}

type Idle = (typeof State)["Idle"];
// State.Idle

type AnyState = (typeof State)[keyof typeof State];
// State
```

重复值别名得到同一个规范成员类型。宽 `string`、动态名称和反向数值映射不能索引枚举命名空间。

### 特殊类型

| 查询           | 结果     |
| -------------- | -------- |
| `never[K]`     | `never`  |
| `unknown[K]`   | 编译错误 |
| `null[K]`      | 编译错误 |
| `undefined[K]` | 编译错误 |
| `void[K]`      | 编译错误 |
| `any[K]`       | 不存在   |

`never[K]` 只表示该类型运算没有可产生的值，不创建运行时索引入口。

## 泛型类型运算

### 读取约束

泛型键必须通过 `keyof` 或等价约束证明能够索引目标：

```ts
function get<T, K extends keyof T>(value: T, key: K): T[K] {
  return value[key];
}
```

无约束 `K` 不能索引 `T`。泛型定义保留符号 `keyof T` 和 `T[K]`；闭合实例化时替换类型参数、规范化键和结果，并复用缓存。

实例化后的实现路径必须明确：

| 键形状                | 值级实现                     |
| --------------------- | ---------------------------- |
| 单个固定键            | 直接字段、方法或固定元素访问 |
| 有限键联合            | 有界键分派和对应固定访问     |
| 宽 `string`、`number` | 目标必须具有对应字典索引签名 |
| `i32` 数组或元组索引  | 对应边界检查或固定位置分派   |
| 无法归入以上类别      | 编译错误                     |

固定实例不携带运行时类型描述符。有限动态键只承担源码实际要求的键比较和结果联合构造；字典键只承担普通哈希查询成本。

### 写入约束

读取类型联合不能直接作为所有可能属性的写入类型。写入必须保证值对运行时可能命中的每个键都安全：

```ts
type User = {
  name: string;
  age: i32;
};

function set<T, K extends keyof T>(target: T, key: K, value: T[K]): void {
  target[key] = value;
}
```

固定单键实例化可以接受：

```ts
set(user, "age", 20);
```

宽联合键和值不能只因分别属于读取联合就视为相关：

```ts
function update(user: User, key: "name" | "age", value: string | i32): void {
  set(user, key, value);
  // 编译错误：key 与 value 可能不匹配
}
```

TypeScript 可能接受部分此类泛型调用。Nxts 要求固定键、可证明的控制流相关性，或者对所有目标位置都安全的公共写入类型。完整左值和赋值检查由 T52 定义。

### 表示和代码共享

泛型类型运算不构成运行时反射。闭合实例必须选择固定访问、有界分派或字典操作，不能传递 `keyof` 集合、类型描述符，不能把 `T[K]` 擦除为 `unknown`，也不能以装箱或字符串反射换取代码共享。具体 IR 与共享边界见 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md) 和 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)。

## `as const`

`as const` 是字面量推导控制，不是 T43 的普通类型断言。它保留直接字面量的精确类型，并为当前对象、数组和元组字面量建立 readonly 类型。

### 支持的操作数

支持 TypeScript const assertion 能够直接作用的以下表达式：

- 字符串、数字和布尔字面量。
- 合法负数等直接字面量形式。
- 对象字面量。
- 数组和元组字面量。
- 枚举成员。
- 仅用于分组的括号。

不支持 bigint。普通变量、属性读取、函数调用、构造、条件表达式、逻辑表达式和一般计算结果不能整体使用 `as const`：

```ts
function readConfig() {
  return {
    mode: "fast",
  };
}

const first = readConfig() as const;
// 编译错误
```

需要保留条件分支字面量时，在各直接字面量分支上分别使用：

```ts
const mode = flag ? ("fast" as const) : ("safe" as const);
// "fast" | "safe"
```

### 字面量保留

```ts
const config = {
  mode: "fast",
  retries: 3,
  flags: [true, false],
} as const;
```

推导结果概念上为：

```ts
type Config = {
  readonly mode: "fast";
  readonly retries: 3;
  readonly flags: readonly [true, false];
};
```

规则如下：

- 不执行普通字符串、数字和布尔字面量 widening。
- 数字字面量继续保留 T08–T12 确定的基础类型身份。
- 对象字面量自身属性变为 readonly。
- 嵌套对象字面量递归应用同一规则。
- 数组字面量产生 readonly 字面量元组。
- 元组位置递归保留直接字面量。
- 枚举成员保留精确成员类型。
- 方法和函数值保留其原有函数签名。

`as const` 不改变运行时值、求值顺序、对象身份或基础表示。

### 既有引用

递归只穿过当前字面量语法树，不深度冻结已经存在的引用：

```ts
const values = [1, 2];

const config = {
  values,
  nested: {
    mode: "fast",
  },
} as const;
```

结果概念上为：

```ts
type Config = {
  readonly values: i32[];
  readonly nested: {
    readonly mode: "fast";
  };
};
```

因此属性引用不能替换，但被引用的 mutable 数组仍可修改：

```ts
config.values = [];
// 编译错误

config.values.push(3);
// 合法

config.values.length = 0;
// 合法，清空既有数组
```

类实例、接口视图、函数、数组、字典和其他既有引用同样保留原静态类型。T40 不建立深度不可变对象图。

### Spread

对象或数组 spread 先按 T52 形成结果字面量，再由 `as const` 处理结果的直接属性和位置：

```ts
const base = {
  mode: "fast",
};

const config = {
  ...base,
  retries: 3,
} as const;
```

`base.mode` 已经 widening 为 `string`，因此 spread 结果为 `readonly mode: string`；`as const` 不恢复来源已经丢失的 `"fast"`。来源本身使用 `as const` 时可以保留精度。

spread 创建、复制或合并值的成本属于 spread 本身。`as const` 不增加复制。数组 spread 的固定长度、optional 和 rest 结果复用 T35、T52。

### 计算属性与字典

固定计算键产生 readonly 固定属性：

```ts
const key = "mode";

const config = {
  [key]: "fast",
} as const;
// { readonly mode: "fast" }
```

宽计算键产生 readonly 字典：

```ts
function createTable(key: string) {
  return {
    [key]: "value",
  } as const;
}
```

结果概念上具有 readonly 字符串索引签名和值字面量 `"value"`；动态读取仍为 `"value" | undefined`。该视图不能写入或删除。运行时表示继续使用 T30 已选择的字典，不执行冻结。

### 显式类型和 readonly

`as const` 先产生精确 readonly 表达式类型，再使用 T03 的普通兼容规则检查外层注解、参数和泛型约束。它不能取消目标类型检查，也不能把 readonly 反向转换为 mutable：

```ts
type MutableConfig = {
  mode: string;
};

const config: MutableConfig = {
  mode: "fast",
} as const;
// 编译错误：readonly 不能进入 mutable
```

该规则比 TypeScript 更严格，并保持 T03、T26 已定稿的写权限单向关系。需要可写对象且只保留某个值的字面量类型时，可以只对该直接值使用：

```ts
const config = {
  mode: "fast" as const,
};

config.mode = "fast";
// 合法
```

外层 readonly 注解可以接收 `as const` 表达式。变量最终公开类型由显式注解决定；表达式中更窄但未被注解保留的信息不能通过后续 `typeof` 恢复。

### 泛型推导

普通泛型调用只有在实参自身携带精确 readonly 类型时才能保留：

```ts
function identity<T>(value: T): T {
  return value;
}

const config = identity({
  mode: "fast",
} as const);
// { readonly mode: "fast" }
```

T37 的 `const` 类型参数可以为直接字面量提供相同方向的推导：

```ts
function define<const T>(value: T): T {
  return value;
}

const config = define({
  mode: "fast",
});
// { readonly mode: "fast" }
```

已经由普通变量 widening 的值不会因进入 `const` 泛型或 `as const` 的外层结构恢复内部精度。

### 不支持与 `satisfies` 组合

T42 已确定 Nxts 不支持 `satisfies`，因此 TypeScript 中合法的组合在 Nxts 中仍为编译错误：

```ts
const config = {
  mode: "fast",
} as const satisfies ReadonlyConfig;
// 编译错误：Nxts 不支持 satisfies
```

parser 可以保留完整语法树并在 `satisfies` 位置产生诊断，但 checker 不执行目标契约检查，也不为整体表达式产生有效类型。`as const` 的独立规则不因该无效组合而改变，无效表达式不得进入 Typed IR。

## 规范化与组合

类型运算按以下顺序规范化：

1. 解析类型和值绑定。
2. 展开透明别名并保留名义身份。
3. 应用已经有效的控制流类型。
4. 规范化联合、交叉、可选和递归回边。
5. 求取键集合或索引结果。
6. 展平、去重并吸收结果联合。
7. 驻留规范结果并记录缓存。

组合运算不能因书写方式不同产生不同结果：

```ts
type Keys = keyof typeof config;
type Values = (typeof config)[Keys];
```

相同输入 TypeId、操作符和规范键类型必须得到相同结果 TypeId。源码别名和成员名称只用于诊断展示，不能影响缓存命中或跨模块摘要。

## 递归类型

递归输入复用 T31 的符号类型图：

```ts
interface Node {
  value: string;
  next: Node | null;
}

type NodeKey = keyof Node;
// "value" | "next"

type Next = Node["next"];
// Node | null
```

`keyof` 只读取当前层成员，不递归展开属性类型。索引访问只沿源码明确书写的链继续计算。遇到已经访问的规范节点时使用符号回边，不复制递归对象图。

`as const` 只递归当前有限字面量语法；既有引用立即停止，因此不会仅因引用图循环而递归遍历运行时对象。

递归查询产生无界新类型链时报告复杂度错误，不能截断为 `unknown`、`never` 或宽基础类型。

## 复杂度边界

T40 不设置 `1024` 等较小统一成员上限；简单 `keyof` 沿用 T21 至少 `65535` 个简单成员的容量要求。集合算法、递归缓存和确定性工作预算由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义。超限不能删除成员、扩大结果、改用动态类型或生成运行时反射。

## 编译器表示

类型运算可以在 parser 和 checker 中保留专用节点；闭合结果必须在 Checked HIR 前替换为规范普通类型。开放泛型只允许在静态模块配方中保留符号运算。节点模型和提交条件由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 与 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md) 定义。

## 性能要求

类型运算自身运行时成本必须为零：不生成键数组、运行时枚举、值读取、冻结、复制、边界检查、类型描述符、初始化依赖或动态分派。值级 `value[key]` 和 spread 只承担源码本身要求的固定字段、有界分派、字典、数组或元组成本。

可执行 IR 禁止项见 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)，实现回归与预算诊断见 [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md)。未使用动态键的普通对象不能预留字典、描述符或分支。

## 跨模块契约

导出的闭合运算结果和开放泛型配方必须能由静态模块元数据确定，且纯类型查询不能建立运行时初始化依赖。摘要字段、失效条件和链接校验由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义；普通 import 的副作用依赖仍由 T55 决定。

## 编译器职责

| 阶段                      | 唯一职责来源                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------ |
| 语法接受范围              | [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)                                   |
| 值/类型空间绑定与模块查询 | T57、T55                                                                             |
| 运算求值、驻留和复杂度    | [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)     |
| 控制流位置类型            | T06、T58                                                                             |
| Checked HIR 消解          | [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)                             |
| 泛型闭合实例与代码共享    | T37 及 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) |
| 静态配方与依赖摘要        | [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)                                    |
| 预算与零成本诊断          | [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md)         |

## 与 TypeScript 的兼容性

Nxts 保持 TypeScript 的 `keyof`、类型查询、索引访问和 `as const` 语法，以及固定对象、接口、公共联合键、控制流类型查询、固定属性读取和 const literal 的主要类型方向。

主要差异如下：

| 场景                      | TypeScript strict            | Nxts                           |
| ------------------------- | ---------------------------- | ------------------------------ |
| symbol 键                 | 支持                         | 当前拒绝                       |
| 数组索引键                | `number`                     | `i32`                          |
| 数组键集合                | 取决于完整标准库声明         | 只包含已支持 API               |
| 字典类型索引              | 通常得到声明值类型 `V`       | 动态键得到 `V \| undefined`    |
| 数组类型索引              | `T[][number]` 通常为 `T`     | `T[][i32]` 为 `T \| undefined` |
| 类静态键                  | 包含 `prototype`             | 不开放 `prototype`             |
| 枚举静态侧                | 具有运行时对象               | 仅为编译期命名空间             |
| readonly 对象赋给 mutable | TypeScript 常允许            | 拒绝增加写权限                 |
| 泛型联合键写入            | 部分相关性不足的调用仍可接受 | 必须证明每个可能键安全         |
| `any`                     | 可以参与类型运算             | 永久不支持                     |
| 无法完成复杂计算          | 受 TypeScript 实现限制       | 确定预算超限并明确报错         |

这些差异缩小 Nxts 接受范围或产生更安全的读取结果。通过 Nxts checker 的源码在提供原生类型和标准库声明后仍必须通过 TypeScript strict 检查；Nxts 不能通过类型运算接受 TypeScript 无法解析的语法或更宽松的值关系。

## 诊断与测试

### `keyof`

至少覆盖：

| 场景                            | 预期                                 |
| ------------------------------- | ------------------------------------ |
| 必选、可选、readonly 和方法成员 | 全部进入固定对象键集合               |
| 固定数值与数值字符串属性键      | 保留 TS 键种类并命中同一运行时属性   |
| 接口继承                        | 展开 public 契约键                   |
| 类实例                          | 只包含 public 实例成员               |
| 对象联合                        | 只保留全部成员公共键                 |
| 对象交叉                        | 先规范化再取得最终键集合             |
| 字符串字典                      | `string \| number`                   |
| 数值字典                        | `number` 及明确固定字符串键          |
| mutable 与 readonly 数组        | 使用各自实际 API 键集合              |
| 元组                            | 固定位置、`i32`、`length` 和实际方法 |
| 类静态侧                        | public 声明静态成员，无 `prototype`  |
| 枚举静态侧                      | 成员名联合，空枚举为 `never`         |
| 特殊类型                        | 按本规范得到结果或明确错误           |
| symbol 和未支持 API             | 编译错误                             |

### 类型查询

至少覆盖：

- 普通 const、mutable、函数、重载、类和属性链查询。
- 查询位置的控制流收窄。
- 类型位置无循环前向引用。
- 未声明名称和类型空间名称错误。
- 调用、构造、逻辑和条件表达式错误。
- 循环查询诊断包含依赖路径。
- 枚举命名空间不能进入值存储位置。
- 静态模块字符串查询不产生动态 import。

### 索引访问类型

至少覆盖：

- 必选、可选、readonly、方法和键联合。
- 联合目标公共键与非公共键错误。
- 字典动态键加入 `undefined`，固定键保持精确。
- 数组 `i32` 索引和固定成员。
- 元组固定位置、数值字符串、optional、rest、宽索引和越界错误。
- 字符串索引和函数 `name`、`length`。
- 类可见性、无 `prototype`。
- 枚举成员、别名、全成员联合和动态名称错误。
- `never` 结果及其他特殊类型错误。

### `as const`

至少覆盖：

- 基础字面量和枚举成员精度。
- 嵌套对象递归 readonly。
- 数组产生 readonly 元组。
- 既有引用保持原可变性。
- 对象与数组 spread 不恢复来源已 widening 信息。
- 固定计算键与宽 readonly 字典。
- 普通变量、调用和整体条件表达式错误。
- readonly 到 mutable 注解、参数和泛型约束错误。
- 普通泛型显式 const assertion 与 `const` 类型参数。
- 不生成冻结、复制或写入状态。

### 泛型与复杂度

至少覆盖：

- `K extends keyof T` 的固定键、有限键和字典实例。
- 无约束键错误。
- 固定键 setter 接受，宽异构联合 setter 拒绝。
- 递归 `keyof` 和索引访问复用回边。
- `65535` 个简单键成员能够规范化。
- 复杂度超限结果确定且不退化。
- 相同实例化缓存命中并得到相同 TypeId。
- 类型运算不进入 Typed IR 或运行时 ABI。

## 依赖边界

| 相关能力               | T40 已确定内容                                  | 对应能力负责内容                        |
| ---------------------- | ----------------------------------------------- | --------------------------------------- |
| T02–T06 公共类型规则   | 运算使用规范 TypeId、兼容、推导和位置控制流类型 | 通用关系、widening、CFG 和事实失效入口  |
| T07–T23 基础与组合类型 | 基础成员键、特殊类型、联合公共键和交叉后查询    | 基础操作、联合/交叉规范化及运行时表示   |
| T26–T31 对象声明       | 固定键、接口/类可见性、字典读取和递归查询       | 形状、写权限、索引签名、回边和对象布局  |
| T32–T39 函数与复合类型 | 函数、数组、元组、类、泛型和枚举的类型运算结果  | 各类型实际成员、约束、布局和 ABI        |
| T41 高级类型           | T40 结果可以作为后续类型运算输入                | 条件类型、`infer`、映射和模板字符串类型 |
| T42 `satisfies`        | 不接受 `as const satisfies T` 组合              | 语法识别、拒绝诊断和不进入 Typed IR     |
| T43–T44 转换           | `as const` 不是普通断言或表示转换               | 品牌断言、普通 `as` 拒绝和显式表示转换  |
| T45–T47 表示与 ABI     | 类型运算运行时零成本，导出闭合结果或开放配方    | 精确布局、GC、元数据格式和链接校验      |
| T49 标准库             | 类型运算只暴露已支持成员                        | 公开成员名称、签名和 intrinsic 身份     |
| T51–T52 访问与赋值     | 提供静态键和读取/写入类型                       | 值级求值、左值、分派、边界和异常        |
| T55 模块               | 静态模块查询不执行 import                       | 解析、可见性、命名空间和初始化          |
| T58 副作用             | 类型查询使用查询位置仍有效的事实                | 别名、闭包、调用和写入失效算法          |
