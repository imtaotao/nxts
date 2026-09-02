# 函数类型

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-22
- 文档顺序：20
- 覆盖能力：T32、T33

## 目标

定义普通函数、箭头函数、方法、纯调用签名接口和函数重载的静态类型，确定参数形式、参数数量、严格方差、返回兼容、接收者、重载解析及实现签名，使常见 TypeScript 函数写法能够直接迁移，同时拒绝依赖动态参数模型的不安全调用。

函数返回推导见 [`5-typeInference.md`](./5-typeInference.md)，公共函数兼容见 [`3-typeCompatibility.md`](./3-typeCompatibility.md)，`void` 与 `never` 的特殊返回规则见 [`11-specialTypes.md`](./11-specialTypes.md)，接口方法与调用签名入口见 [`17-interfaces.md`](./17-interfaces.md)。

默认参数、rest、接收者和身份语义见 [`13-functionSemantics.md`](../semantics/13-functionSemantics.md)，公开内建能力见 [`9-function.md`](../../stdlib/9-function.md)，函数值表示见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，调用 ABI 见 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)。

## 核心原则

| 原则           | 约束                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| 精确静态签名   | 每个函数值始终具有确定的参数、返回值和接收者契约，不退化为动态参数数组。                |
| 严格安全方差   | 参数严格逆变，返回值协变；方法不采用 TypeScript 的双变兼容例外。                        |
| 调用点确定     | 直接调用的参数数量和类型在编译期检查，不在运行时查询函数形参数量。                      |
| 身份与入口分离 | 函数身份不因 ABI 适配改变；同一函数可以具有按需生成的静态类型化调用入口。               |
| 无隐藏动态成本 | 隐式适配不得装箱、堆分配、复制对象或执行运行时类型检查。                                |
| 局部付费       | rest 数组、闭包环境和间接调用只影响实际使用对应能力的函数，普通直接调用不承担额外成本。 |
| 重载静态化     | 重载候选、上下文类型和实现契约在编译期解析，运行时只保留已选中的类型化入口。            |
| TS 静态子集    | 接受的源码保持 TypeScript 可解析和可检查；不安全或动态的 TypeScript 能力可以被拒绝。    |

## 支持范围

T32 支持以下单一调用签名形式：

```ts
function add(left: i32, right: i32): i32 {
  return left + right;
}

const subtract = function (left: i32, right: i32): i32 {
  return left - right;
};

const multiply = (left: i32, right: i32): i32 => left * right;

type BinaryOperation = (left: i32, right: i32) => i32;

interface Comparator {
  (left: i32, right: i32): i32;
}
```

对象、接口和类中的普通方法属于支持范围。类方法覆盖和 `super` 调用由 T36、T56 继续定义，但必须继承本节的签名和接收者规则。

以下能力不由普通函数类型隐式开放：

| 能力                              | 规则                                  |
| --------------------------------- | ------------------------------------- |
| 多个调用签名和函数重载            | 由本文“函数重载”一节定义。            |
| 元组 rest 与元组参数展开          | 由 [`T35`](./22-tupleTypes.md) 定义。 |
| 泛型函数和类型参数推导            | 由 T37 定义。                         |
| 构造签名、函数构造器和 `new` 调用 | 由 T36 定义；普通函数不可作为构造器。 |
| 闭包捕获、逃逸和 GC 环境          | 由 T58 定义。                         |
| `async` 函数与 Promise            | 由 T59 定义。                         |
| 生成器函数                        | 由 T60 定义。                         |

## 函数签名模型

单一函数签名由以下静态部分组成：

```text
FunctionSignature {
  receiver
  orderedParameters
  returnType
}
```

函数声明参数先保留以下源码形式：

```text
Required
Optional
Defaulted
Rest
```

建立规范函数类型时，默认值表达式属于实现信息，不形成独立类型标记：

| 默认参数位置       | 规范函数参数                                                 |
| ------------------ | ------------------------------------------------------------ |
| 后面不存在必选参数 | 可选位置，调用方可以省略，也可以显式传入 `undefined`。       |
| 后面仍存在必选参数 | 必须保留位置，参数类型允许 `undefined`，由默认值处理该输入。 |

参数名称、默认值表达式、函数体、捕获集合、函数的 `name` 值和普通类型别名名称不参与函数类型身份。接收者类型、参数顺序、规范化后的必选、可选和 rest 形式、参数类型以及返回类型参与身份判断。

尾部默认参数与同类型可选参数具有相同的外部调用类型。二者仍保留不同的函数体内类型和 `Function.length` 元数据：可选参数在函数体内为 `T | undefined`，默认参数完成初始化后为 `T`。

可选参数与“必选参数的类型包含 `undefined`”不是同一签名：

```ts
type Optional = (value?: i32) => void;
type RequiredUndefined = (value: i32 | undefined) => void;

function check(optional: Optional, required: RequiredUndefined): void {
  optional(); // 合法
  required(); // 编译错误：仍缺少必选参数槽位
  required(undefined); // 合法
}
```

## 参数规则

### 必选参数

调用方必须提供每个必选参数。缺失必选参数在编译期报错，不由运行时填充 `undefined`：

```ts
function save(id: i32, name: string): void {}

save(1, 'Ada'); // 合法
save(1); // 编译错误
```

直接调用不接受多余实参：

```ts
save(1, 'Ada', true); // 编译错误
```

该规则检查源码调用点。函数值兼容中允许较少形参的实现忽略目标回调提供的尾部参数，见“参数数量兼容”；两种规则不能混用。

### 可选参数

可选参数使用 TypeScript 语法，只能位于所有必选参数之后、rest 参数之前：

```ts
function lookup(id: i32, cacheKey?: string): string {
  return '';
}
```

调用方可以省略可选参数或显式传入 `undefined`。函数体内参数类型为 `T | undefined`，使用前必须按 T06 收窄。`null` 是普通独立值，不触发省略语义。

### 默认参数

默认参数的外部类型允许调用方省略尾部位置或显式传入 `undefined`；传入 `null` 不属于省略：

```ts
function connect(host = 'localhost', port = 8080): void {}

connect();
connect(undefined, 9000);
```

默认参数可以位于必选参数之前，但调用方必须保留对应参数位置。该位置在规范函数类型中接受 `T | undefined`，而不是位于必选参数之前的可选标记：

```ts
function open(mode = 'read', path: string): void {}

open(undefined, 'data.txt'); // 合法
open('data.txt'); // 编译错误：缺少 path
```

进入函数体后，默认参数的静态类型为 `T`，不包含因省略产生的 `undefined`。默认值检查和调用方补位使用普通分支，不生成动态参数对象。

默认表达式的可见性、求值顺序和副作用由 [`13-functionSemantics.md`](../semantics/13-functionSemantics.md) 定义。

### rest 参数

rest 参数使用 `...values: T[]`，只能位于参数列表末尾，不能同时标记为可选或带默认值：

```ts
function sum(initial: i32, ...values: i32[]): i32 {
  return initial;
}
```

函数体中的 rest 参数类型为可变 `T[]`。独立数组身份和可消除条件见 [`13-functionSemantics.md`](../semantics/13-functionSemantics.md)；普通非 rest 函数不得因此承担数组创建成本。

## 参数数量兼容

函数赋值按目标函数所有合法调用检查安全性。函数的最小实参数量是最后一个必选参数的位置加一；没有必选参数时为零。源函数的最小实参数量不能大于目标函数保证提供的最小实参数量：

```ts
type Visit = (value: string, index: i32) => void;

const consumeValue = (value: string): void => {};
const visit: Visit = consumeValue; // 合法，忽略 index

const consumeBoth = (value: string, index: i32): void => {};
const valueOnly: (value: string) => void = consumeBoth; // 编译错误
```

兼容检查还必须逐位置满足参数逆变。源函数没有声明的尾部参数可以被忽略；源函数声明但目标调用可能省略的位置，必须是源函数的可选、默认或 rest 位置。必选参数绝不因函数赋值而自动变成 `undefined`。

参数数量兼容不得把源函数的必选槽位隐式变成 `undefined`。对应类型化入口由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义；普通精确签名调用不经过参数数量适配。

## 严格方差

给定源函数和目标函数：

```text
source: (SourceParam) -> SourceReturn
target: (TargetParam) -> TargetReturn
```

源函数兼容目标函数时，参数按逆变检查，返回值按协变检查：

```text
TargetParam -> SourceParam
SourceReturn -> TargetReturn
```

例如，能够处理所有 `Entity` 的函数可以用于只会传入 `User` 的位置：

```ts
interface Entity {
  id: i32;
}

interface User extends Entity {
  name: string;
}

const handleEntity = (value: Entity): void => {};
const handleUser: (value: User) => void = handleEntity; // 合法
```

反向赋值不安全，因为目标调用方可以传入没有 `name` 的普通 `Entity`。普通函数、对象方法、接口方法和类方法统一使用严格逆变；Nxts 不保留 TypeScript 的方法参数双变例外。

返回值方向相反：

```ts
const createUser = (): User => ({ id: 1, name: 'Ada' });
const createEntity: () => Entity = createUser; // 合法
```

目标调用方只要求 `Entity`，源函数返回更具体的 `User` 是安全的。反向赋值仍然不安全。

## 返回值兼容

函数体返回检查和无注解返回推导由 T05 定义。`void`、`undefined` 和 `never` 必须继承 T15、T16 的特殊规则：

- `(): T` 不能隐式兼容到 `(): void`。
- `(): void` 与 `(): undefined` 不互相隐式兼容。
- 已有 `(...P) => never` 函数不能直接兼容到需要返回值载荷的函数类型。

普通返回协变还受表示转换边界约束：

| 表示关系                                         | 类型结果                       |
| ------------------------------------------------ | ------------------------------ |
| ABI 表示相同                                     | 允许。                         |
| 静态接口打包、联合注入或有界重打包               | 允许无失败、无分配的静态适配。 |
| 需要装箱、堆分配、对象复制、运行时检查或可能失败 | 编译错误，要求显式转换或包装。 |

具体入口、物理签名和 LLVM lowering 由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)、[`1-irContracts.md`](../../compiler/ir/1-irContracts.md) 与 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) 定义。

## 方法与接收者

方法和函数属性是不同成员类别：

```ts
interface Service {
  run(value: i32): i32;
  transform: (value: i32) => i32;
}
```

| 成员形式                    | 调用模型                                           |
| --------------------------- | -------------------------------------------------- |
| 方法 `run(...)`             | 具有静态接收者，通过成员调用传入接收者。           |
| 函数属性 `transform: (...)` | 对象字段保存独立函数值，读取字段后按普通函数调用。 |

提取方法后的函数类型保留接收者要求，缺少接收者的裸调用产生编译错误：

```ts
const run = service.run;
run(1); // 编译错误：缺少接收者

const boundRun = (value: i32): i32 => service.run(value);
boundRun(1); // 合法
```

显式 `this` 伪参数使用 TypeScript 语法，参与函数类型身份和兼容检查，但不属于源码实参数量，也不计入 `Function.length`：

```ts
function format(this: Formatter, value: string): string {
  return value;
}
```

箭头函数使用词法 `this`。没有接收者声明的普通函数不能使用隐式动态 `this`。方法绑定、接收者捕获和调用行为见 [`13-functionSemantics.md`](../semantics/13-functionSemantics.md)，函数公开能力白名单见 [`9-function.md`](../../stdlib/9-function.md)。

## 纯调用签名接口

只包含一个调用签名且不包含普通属性、方法或构造签名的接口，归一化为对应函数契约：

```ts
interface Parser {
  (source: string): Node;
}

type EquivalentParser = (source: string) => Node;
```

`Parser` 与 `EquivalentParser` 使用相同的函数类型身份、兼容规则和运行时表示。接口名称不创建函数品牌、接口对象、witness 或包装。

多个调用签名形成本文定义的重载函数契约。同时包含调用能力和普通成员的混合可调用对象不属于有效函数类型：

```ts
interface InvalidParser {
  (source: string): Node;
  readonly version: string;
}
```

该设计不影响普通对象包含函数属性；需要函数与元数据组合时使用明确对象：

```ts
interface ParserObject {
  parse(source: string): Node;
  readonly version: string;
}
```

## 函数重载

函数重载用于表达多个静态调用签名共享一个逻辑实现，尤其用于保留参数类型与返回类型之间的对应关系：

```ts
function findUser(id: i32): User | undefined;
function findUser(name: string): User[];
function findUser(query: i32 | string): User | undefined | User[] {
  if (typeof query === 'number') {
    return findById(query);
  }

  return findByName(query);
}
```

调用方只能观察公开重载：

```ts
const user = findUser(1); // User | undefined
const users = findUser('Ada'); // User[]
findUser(true); // 编译错误：没有匹配重载
```

实现体只有一份。重载系统不根据运行时类型遍历候选，也不自动复制业务逻辑。

### 重载集合模型

普通函数、方法和纯调用签名接口共用同一种重载表示：

```text
OverloadSet {
  receiver?
  orderedSignatures
  implementation?
}
```

普通函数没有接收者；实例方法和静态方法额外记录 T32 定义的接收者类别和方法槽位。除此之外，候选解析、函数兼容、返回验证、复杂度预算和 ABI 入口规则完全共用。

重载签名的源码顺序参与语义，因为 TypeScript 在普通候选同样适用时可能依据声明顺序选择结果。规范类型身份必须保留能够影响解析结果的签名顺序；不能为了去重而任意重排重载集合。

### 支持的声明形式

普通函数使用连续重载签名和一个紧随其后的实现：

```ts
function parse(value: string): TextNode;
function parse(value: i32): NumberNode;
function parse(value: string | i32): TextNode | NumberNode {
  // 唯一实现
}
```

函数签名组和实现必须具有相同名称、导出可见性和函数类别。默认值只能出现在实现参数中；重载签名使用可选参数表达可省略性。实现前后不能混入其他同名声明。

单个接口内的同名方法签名按成员名收集为一个重载集合，可以被其他接口成员隔开，但必须保留各签名的源码顺序：

```ts
interface Store {
  find(id: i32): User | undefined;
  readonly version: string;
  find(name: string): User[];
}
```

同组方法必须具有一致的实例或静态类别、接收者要求和可选标记。接口仍不支持声明合并；不能通过另一个同名接口声明或模块扩充追加重载。

只包含多个调用签名且没有普通成员的接口归一为重载函数契约，不产生接口 witness 或包装对象：

```ts
interface Parser {
  (value: string): TextNode;
  (value: i32): NumberNode;
}
```

箭头函数、函数表达式和对象字面量不增加独立的重载声明语法。它们可以在自身单一签名能够满足目标重载契约时作为实现值；需要表达参数与返回关联时，使用普通重载函数声明。

类方法的声明位置、覆盖和唯一实现由 T36 定义；构造器重载由 T36 定义；泛型重载由 T37 定义；异步函数与生成器重载分别由 T59、T60 定义。这些能力必须复用本节的有序重载集合和静态入口，不能建立第二套运行时重载模型。

### TypeScript 重载解析

在 Nxts 已支持的非泛型静态类型范围内，重载候选收集、声明顺序、字面量特化、可选参数、rest 参数和回调上下文类型与 TypeScript 严格模式保持一致。

解析过程只使用实参、接收者和上下文参数类型，不根据运行时值选择候选。返回类型不能单独用于区分参数完全相同的调用签名。

```ts
function read(value: 'config'): Config;
function read(value: string): Config | Text;

const exact = read('config'); // Config

function readPath(path: string): Config | Text {
  return read(path);
}
```

TypeScript 对普通适用候选可能使用声明顺序，因此工具链应提示重载按照具体到宽泛排列，但不能用一套不同于 TypeScript 的固定参数、可选参数或 rest 优先算法改变调用结果。

### 回调上下文类型

候选中的函数参数可以为箭头函数和函数表达式提供上下文类型：

```ts
function observe(kind: 'number', callback: (value: i32) => void): void;
function observe(kind: 'text', callback: (value: string) => void): void;

observe('number', (value) => {
  // value: i32
});
```

checker 按 TypeScript 的候选顺序传播支持范围内的上下文类型。若候选解析仍不能为参数提供确定类型，必须要求显式注解，不能使用 `any`、`unknown` 或运行时类型表兜底：

```ts
transform((value: i32) => value);
```

泛型候选推导和上下文返回类型由 T37 继续定义；T33 不通过非泛型特例提前实现 `infer` 或条件类型。

### 实现签名

实现签名必须能够接收每个公开重载允许传入的参数，并能够容纳全部重载结果。实现参数可以比单个重载更宽，但不能比任一重载更窄：

```ts
function parse(value: i32): NumberNode;
function parse(value: string): TextNode;
function parse(value: i32 | string): NumberNode | TextNode {
  // 合法实现签名
}
```

实现签名不属于公开调用集合。即使实现参数还包含其他类型，调用方、实现内部递归调用、`typeof` 函数值和模块导出都只能观察公开重载：

```ts
function parse(value: i32): NumberNode;
function parse(value: string): TextNode;
function parse(value: i32 | string | boolean): NumberNode | TextNode {
  // boolean 只属于私有实现签名
}

parse(true); // 编译错误
```

`typeof parse` 保留有序重载集合。[T41](./27-advancedTypes.md) 规定 `ReturnType<typeof parse>`、`Parameters<typeof parse>` 和条件 `infer` 只读取最后一个公开重载；实现签名不能泄漏。

### 返回关联验证

TypeScript 只检查各重载结果能够进入实现声明的宽返回类型，不验证某类参数最终返回了哪一个联合成员。Nxts 原生调用方会依据选中重载使用确定的返回类型和 ABI，因此 checker 还必须验证参数与返回值之间的关联。

```ts
function find(value: i32): User;
function find(value: string): User[];
function find(value: i32 | string): User | User[] {
  if (typeof value === 'number') {
    return findByName('wrong'); // 编译错误：i32 重载要求 User
  }

  return findById(1); // 编译错误：string 重载要求 User[]
}
```

每个 `return` 表达式必须兼容当前控制流路径仍可能对应的全部公开重载返回类型。

条件表达式、确定赋值和局部 SSA 合并不得无条件丢失关联。以下写法必须能够通过：

```ts
function find(value: i32): User | undefined;
function find(value: string): User[];
function find(value: i32 | string): User | undefined | User[] {
  const result =
    typeof value === 'number' ? findById(value) : findByName(value);

  return result;
}
```

条件表达式和穷尽局部赋值必须能够保留有限路径关联；值经由存储、未知调用、闭包、别名写入或循环合并而失去可证明关联时，若无法重新收窄则编译报错。完整来源分析由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义，不得因证明失败插入运行时检查或隐藏失败路径。

### 重叠重载安全

多个重载可能接受同一个运行时参数元组。一个实现不能根据调用方的静态类型改变 JavaScript 可观察行为，因此所有重叠契约必须能够同时成立。

当一个重载的参数域包含于另一个重载时，更具体重载的返回类型必须兼容更宽重载的返回类型：

```ts
function load(kind: 'user'): User;
function load(kind: string): Entity;
```

该声明只有在 `User` 兼容 `Entity` 时合法。宽 `string` 变量在运行时也可能包含 `"user"`，因此宽重载必须能够接收真实的 `User` 结果。

正确表达不相交结果时，宽重载应返回所有可能结果的联合：

```ts
function load(kind: 'user'): User;
function load(kind: string): User | Config;
```

参数域互相重叠但无法判断包含关系时，checker 必须证明重叠部分的结果同时满足全部适用重载；返回契约互不兼容时拒绝声明。参数完全相同但返回类型互不兼容的重载因此属于编译错误，不能仅依赖声明顺序取得不同承诺。

这项检查是 TypeScript 严格子集差异，目的是避免错误返回布局、隐藏运行时检查和静态入口改变同一函数的行为。

### 重载函数值兼容

重载函数作为值时保留整个有序重载集合：

```ts
const parser = parse;

parser(1); // NumberNode
parser('text'); // TextNode
```

赋给单一函数类型时，按 TypeScript 规则选择兼容签名，并按 T32 选择对应类型化入口：

```ts
const numberParser: (value: i32) => NumberNode = parse;
```

重载集合之间的兼容与 TypeScript 保持一致：目标集合中的每个签名必须由源函数的兼容签名覆盖；源函数可以包含额外重载，进入目标视图后额外签名不可见。每对签名继续使用 T32 的参数逆变、返回协变和 ABI 适配边界。

```ts
interface Parser {
  (value: i32): NumberNode;
  (value: string): TextNode;
}

interface FullParser {
  (value: i32): NumberNode;
  (value: string): TextNode;
  (value: boolean): BooleanNode;
}

function narrow(fullParser: FullParser): Parser {
  const parser: Parser = fullParser; // 合法，boolean 重载被目标视图隐藏
  return parser;
}
```

兼容转换不能创建新函数身份。单签名函数视为只包含一个签名的重载集合，不需要独立兼容算法。

### 重载实现边界

重载解析只存在于编译期；调用点只能观察选中的公开签名，运行时不遍历候选。重载入口和跨模块元数据由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义，候选索引、返回关联和确定性复杂度预算由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义。

## 函数内建属性

函数值的静态成员集合只包含只读 `name: string` 与 `length: number`。完整行为和不支持的函数对象 API 由 [`9-function.md`](../../stdlib/9-function.md) 定义。

## 函数身份

函数类型兼容和重载视图不创建新函数身份。创建、别名和严格相等的可观察规则由 [`13-functionSemantics.md`](../semantics/13-functionSemantics.md) 定义。

## 运行时模型

函数类型要求固定大小函数值、稳定身份和精确类型化入口，不允许通用动态调用器。物理表示见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，runtime 契约见 [`2-functionRuntime.md`](../../runtime/values/2-functionRuntime.md)。

## 跨模块 ABI

导出函数必须保留规范静态签名和有序公开重载，且不得泄漏实现签名。稳定指纹、物理入口和链接验证由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义。

## 编译器职责

| 阶段                       | 唯一职责来源                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------- |
| 语法接受范围               | [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)                                 |
| 参数作用域与名称绑定       | T57                                                                                |
| 候选解析、返回关联和复杂度 | [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)   |
| Checked HIR 与调用节点     | [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)                           |
| 函数值布局                 | [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) |
| runtime 身份与描述符       | [`2-functionRuntime.md`](../../runtime/values/2-functionRuntime.md)                |
| 优化与适配入口消除         | [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)      |
| 物理调用和跨模块链接       | [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)                                  |

## 与 TypeScript 和 JavaScript 的差异

| 场景                        | TypeScript / JavaScript                                       | Nxts                                                |
| --------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| 普通直接调用参数数量        | TypeScript 拒绝缺失必选参数和多余实参。                       | 保持一致。                                          |
| 回调形参数量兼容            | 允许较少形参实现忽略尾部参数。                                | 保持安全子集，并使用静态类型化入口。                |
| 方法参数方差                | TypeScript 保留双变例外。                                     | 所有方法严格逆变。                                  |
| 方法提取                    | TypeScript 通常允许裸调用，JavaScript 运行时可能丢失 `this`。 | 保留静态接收者要求，缺少接收者时编译错误。          |
| `call` / `apply` / `bind`   | 标准函数 API。                                                | 不提供；使用直接调用、箭头函数和 rest / spread。    |
| `arguments`                 | JavaScript 创建动态类数组对象并包含严格模式特殊规则。         | 不创建，也不形成特殊绑定。                          |
| 函数动态属性和可调用对象    | JavaScript 函数也是动态对象，TypeScript 可描述混合成员。      | 函数不是字典；拒绝动态属性和混合可调用对象。        |
| `name`、`length` 和严格相等 | 提供对应可观察行为。                                          | 保持对应行为，以静态描述符和稳定身份实现。          |
| 返回协变                    | TypeScript 主要按静态类型擦除检查。                           | 还要求相同 ABI 或无失败、无分配的有界静态表示适配。 |
| 重载解析                    | 声明顺序、特化签名和上下文类型共同决定候选。                  | 支持范围内保持一致，运行时只保留已选入口。          |
| 重载实现返回关联            | 不验证参数与具体联合返回成员的对应关系。                      | 使用控制流来源证明每个公开重载的返回契约。          |
| 重叠重载                    | 可以依赖顺序获得互不兼容的返回承诺。                          | 要求重叠参数域的返回契约能够同时成立。              |

这些差异只缩小 Nxts 接受的源码范围。通过 Nxts 检查的函数源码在具备 Nxts 类型声明时仍应通过 TypeScript 严格检查；Nxts 不以兼容为由引入 JavaScript 动态调用模型。

## 诊断要求

| 场景                                        | 诊断必须说明                                                   |
| ------------------------------------------- | -------------------------------------------------------------- |
| 缺失必选参数或直接调用存在多余实参          | 期望数量、实际数量以及可选、默认或 rest 边界。                 |
| 可选参数位于必选参数之前                    | 参数顺序规则和可使用默认参数的替代方式。                       |
| 默认值引用自身、后续参数或函数体局部声明    | 非法引用名称和初始化顺序。                                     |
| 函数赋值参数方向不安全                      | 失败参数位置、目标可能传入的类型和源函数实际接受的类型。       |
| 函数赋值缺少源函数必需参数                  | 目标调用可能省略的槽位以及源函数为何仍要求该槽位。             |
| 返回协变需要禁止的表示转换                  | 是否涉及装箱、分配、复制、动态检查或可能失败。                 |
| 提取方法后缺少接收者                        | 原接收者类型，并建议使用明确箭头函数。                         |
| 使用 `call`、`apply`、`bind` 或函数动态属性 | 该成员不属于 Nxts 函数值能力，并给出直接调用或普通对象写法。   |
| 混合可调用对象                              | 调用签名与普通成员不能共用函数对象，建议改为带方法的普通接口。 |
| 没有适用重载或实现未覆盖公开签名            | 实参类型、主要候选和失败参数位置。                             |
| 重载实现返回关联失败                        | 当前活动重载、返回表达式类型和丢失关联的位置。                 |
| 重叠重载返回契约冲突                        | 重叠参数域、冲突返回类型和安全宽重载写法。                     |
| 重载解析复杂度预算耗尽                      | 触发调用、候选规模和主要高成本关系检查。                       |

## 验收用例

实现至少覆盖以下测试：

| 类别     | 用例                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 基础形式 | 函数声明、函数表达式、箭头函数、方法和函数类型语法。                                     |
| 参数     | 必选、可选、默认、默认求值顺序、前置默认、rest、缺失和多余实参。                         |
| 兼容     | 严格逆变、返回协变、安全形参数量兼容、方法双变拒绝和必选槽位拒绝。                       |
| 特殊返回 | `void`、`undefined`、`never` 的允许与拒绝矩阵。                                          |
| 接收者   | 直接方法调用、方法提取拒绝、箭头绑定和显式 `this` 伪参数。                               |
| 接口     | 单一与重载调用签名归一化、同名方法重载和混合可调用对象拒绝。                             |
| 重载     | TS 候选顺序、上下文回调、实现签名隐藏、返回关联、重叠安全和实现覆盖矩阵。                |
| 元数据   | 声明、箭头、别名、默认参数、可选参数和 rest 的 `name` / `length`。                       |
| 身份     | 不同创建不相等、别名相等、不同 ABI 入口仍保持同一身份。                                  |
| 性能边界 | 普通直接调用无函数对象；允许适配无分配无检查；禁止适配不得生成隐藏运行时代码。           |
| 跨模块   | 签名指纹稳定、调用约定不匹配拒绝、适配入口复用以及 `void` / `undefined` / `never` 保真。 |

## 下游依赖

| 规范     | 必须继承或继续确定的内容                                                               |
| -------- | -------------------------------------------------------------------------------------- |
| T35 元组 | 元组 rest、参数展开和固定长度参数包不能引入动态实参数组。                              |
| T36 类   | 方法覆盖、静态侧、构造器和继承分派继承严格逆变与接收者规则。                           |
| T37–T38  | 泛型函数实例化和方差使用规范化函数签名，不得通过泛型恢复双变参数。                     |
| T41      | `ReturnType` 等类型工具必须读取公开重载集合，不能泄漏私有实现签名。                    |
| T45–T47  | 固定函数值布局、寄存器和返回槽位、签名指纹、跨模块入口及适配器缓存。                   |
| T52–T53  | spread、赋值和调用表达式检查使用 T32 的参数数量、求值顺序和接收者契约。                |
| T56      | `this`、`super`、方法提取和类接收者初始化细化 T32 的静态接收者模型。                   |
| T58      | 捕获变量、环境布局、逃逸、GC、副作用失效和闭包优化保持 T32 的函数身份与调用 ABI。      |
| T59–T61  | async、Promise、生成器和异常完成扩展函数控制流，但不得改变同步普通函数的精确调用边界。 |
