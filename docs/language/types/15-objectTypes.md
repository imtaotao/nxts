# 对象类型

- 覆盖能力：T26、T27
- 规范状态：已定稿
- 文档顺序：15

## 目标与边界

本规范定义普通精确对象的静态类型语法、属性模型、初始化、兼容和只读视图。

| 内容                                             | 权威规范                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| 对象身份、属性存在性、`in`、枚举和展开行为       | [对象语义](../semantics/4-objectSemantics.md)                           |
| `Object.hasOwn`、`Object.keys` 和默认 `toString` | [对象标准库](../../stdlib/4-object.md)                                  |
| 对象描述符、反射查询和扩展状态                   | [对象运行时](../../runtime/objects/3-objectRuntime.md)                  |
| 固定字段、存在位和枚举描述符布局                 | [类型运行时表示](../../compiler/representation/1-typeRepresentation.md) |
| 接口契约与接口视图                               | [`17-interfaces.md`](./17-interfaces.md)                                |
| 字典和对象字典视图                               | [`18-dictionaryTypes.md`](./18-dictionaryTypes.md)                      |
| 类型转换                                         | [`28-typeConversions.md`](./28-typeConversions.md)                      |

## 设计原则

- 普通属性访问必须允许降低为固定字段访问。
- 一项能力如果迫使所有对象采用动态表示，则不属于普通对象模型。
- 显式反射可以承担局部成本，但不能降低普通字段访问性能。
- 支持的 JavaScript / TypeScript 能力保持可观察语义；无法满足固定形状的动态能力静态拒绝。

## 精确对象形状

对象类型使用 TypeScript 风格语法：

```ts
type User = {
  id: i64;
  name: string;
  nickname?: string;
};
```

全部属性名和属性类型必须在编译期确定。静态形状可以来自显式声明或对象字面量推导：

```ts
const point = {
  x: 1,
  y: 2,
};

point.x = 3;
point.label = "A"; // 编译错误
delete point.x; // 编译错误
```

创建后可以修改已有可写属性。直接成员操作不能新增字段、删除必需或只读字段，也不能重定义属性。可写可选属性可以删除。

动态键值集合使用 T30 字典。精确对象进入允许的字典位置时可以形成零复制字典视图，但原变量的精确形状不会扩大。

当前普通对象属性键以字符串为边界。类型描述符可以为未来静态 symbol 键预留扩展，但不能为普通对象引入动态属性表。

对象类型字面量归一化为精确对象形状；接口声明归一化为独立结构契约：

```text
对象类型字面量 -> 精确对象形状
接口声明       -> 结构接口契约
精确对象 + 接口契约 -> 静态 witness 与接口视图
```

接口视图保留具体对象身份，但不是精确对象类型或调用 ABI。

## 裸 `{}` 的边界

表达式 `{}` 是合法空对象字面量，推导为精确空形状对象：

```ts
const first = {};
const second = {};

first === second; // false
```

类型位置的裸 `{}` 不支持：

```ts
let value: {}; // 编译错误
type Empty = {}; // 编译错误
```

Nxts 不采用 TypeScript 将 `{}` 解释为“除 `null` 和 `undefined` 外任意值”的语义。需要对象时声明实际形状，需要动态值时使用 `unknown` 边界。

## 对象成员

普通对象支持数据属性、属性简写和对象方法简写：

```ts
const name = "Nxts";
const service = {
  name,
  version: 1,
  run() {
    return this.version;
  },
};
```

对象方法属于静态形状。接收者、函数身份、捕获和调用规则分别由 T56、T32、T58 和 T53 定义。

普通对象不支持 getter、setter 或自定义属性描述符。需要计算、校验或观察行为时使用显式方法。

## 计算属性名与表示分流

计算属性名根据 key 的静态类型选择固定对象或字典：

```ts
const value = {
  ["name"]: "Nxts",
  [0]: "first",
};

const key: string = readKey();
const dynamic = { [key]: "value" }; // 字符串字典
```

| key 的静态类型             | 结果类别                           |
| -------------------------- | ---------------------------------- |
| 单个字符串或数值常量       | 规范化为固定属性。                 |
| 有限字符串或数值字面量联合 | 精确对象联合或等价固定存在位形状。 |
| 宽 `string`                | T30 字符串字典。                   |
| 宽 `number`                | T30 数值索引字典。                 |
| `symbol`                   | 当前编译错误。                     |

数值常量按 T13 的规范字符串格式形成属性名，不执行运行时隐式转换。

只要字面量包含无法收窄为有限集合的计算 key，整个字面量就使用字典能力：

- 宽字符串 key 覆盖其他字符串条目并求统一值类型。
- 宽数值 key 只覆盖数值属性名，非数值字符串成员保留固定前缀。
- 宽 key 不能初始化显式固定对象目标。
- 字典不能隐式转换为精确对象形状。

该分流必须由 checker 写入 Checked HIR，运行时不能根据写入值猜测 shape transition。

## 属性初始化

必选属性在对象创建完成前必须初始化：

```ts
type User = {
  id: i64;
  name: string;
};

const user: User = {}; // 编译错误
```

可选属性可以省略，读取类型为 `T | undefined`：

```ts
type Options = {
  value?: string;
};

const options: Options = {};
options.value = "enabled";
```

可选属性和必需的 `T | undefined` 不同：

```ts
type OptionalValue = {
  value?: string;
};

type RequiredValue = {
  value: string | undefined;
};

const a: OptionalValue = {}; // 合法
const b: RequiredValue = {}; // 编译错误
const c: RequiredValue = { value: undefined }; // 合法
```

省略、显式 `undefined`、删除和重新添加的可观察行为由[对象语义](../semantics/4-objectSemantics.md)定义。

## 精确结构兼容

没有显式继承关系时，源类型和目标类型必须具有相同属性集合；声明顺序不影响兼容：

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
const b: PointB = a; // 合法
```

对应属性类型、可选性和写权限必须兼容。额外属性不会自动丢弃：

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

const point: PointA = labeled; // 编译错误
```

对象字面量、变量赋值、函数参数和返回值统一执行精确形状检查，不采用 TypeScript 新鲜对象字面量特例：

```ts
function draw(point: PointA) {}

draw({ x: 1, y: 2, label: "A" }); // 编译错误

const value = { x: 1, y: 2, label: "A" };
draw(value); // 编译错误
```

需要丢弃属性时必须显式创建目标对象：

```ts
const point: PointA = {
  x: labeled.x,
  y: labeled.y,
};
```

该操作语义上创建独立对象身份。编译器可以在身份不可观察时消除分配，但不能把不同布局的源对象重新解释为目标对象。

显式类继承提供受控的派生到基类兼容，不属于普通对象偶然结构兼容。

## `readonly` 属性

`readonly` 是浅层静态写权限，不冻结对象，也不改变对象布局：

```ts
type ReadonlyPoint = {
  readonly x: i32;
  readonly y: i32;
};

const point: ReadonlyPoint = { x: 1, y: 2 };
point.x = 3; // 编译错误
```

可变对象可以零成本形成对应只读视图：

```ts
type MutablePoint = {
  x: i32;
  y: i32;
};

const mutable: MutablePoint = { x: 1, y: 2 };
const readonlyPoint: ReadonlyPoint = mutable;
```

只读视图与可变变量引用同一个对象。反向获得写权限编译错误，类型断言也不能提升权限。

`readonly` 不递归：

```ts
type User = {
  readonly profile: {
    name: string;
  };
};

const updateUser = (user: User) => {
  user.profile = { name: "new" }; // 编译错误
  user.profile.name = "new"; // 合法
};
```

`const` 限制变量重新绑定，`readonly` 限制属性写入。Nxts 不支持动态冻结 API。

## 对象类型断言

T43 不支持普通 `expression as Type`，包括对象只读视图和接口视图。目标类型通过注解、参数、返回值或普通赋值建立：

```ts
const view: ReadonlyPoint = mutable;
```

以下写法均编译错误：

```ts
const readonlyView = mutable as ReadonlyPoint;
const point = labeled as PointA;
const writable = readonlyPoint as MutablePoint;
```

不同对象形状之间的转换必须显式构造目标对象。

## 不支持的动态能力

- 直接成员操作新增字段、删除必需字段或重定义属性。
- 未形成 T30 字典视图时附加动态属性。
- 运行时计算属性名扩大精确形状。
- getter、setter 和 `Object.defineProperty`。
- 动态冻结、密封和可扩展状态。
- 非空原型的 `Object.create` 和 `Object.setPrototypeOf`。
- `__proto__`、可修改的 `constructor.prototype` 和动态 mixin。
- JavaScript `Proxy` 的透明拦截。
- 依赖 shape transition、hidden class 或 JIT 缓存失效的行为。

当前标准库不声明 `Proxy`。架构可以未来增加显式代理类型，但不能让普通对象预留 Proxy tag、隐藏字段、动态表或运行时分支。

## Checker 职责

checker 必须：

- 规范化属性身份、类型、可选性和写权限。
- 推导对象字面量的精确形状。
- 检查必需属性初始化和统一精确兼容。
- 检查只读单向兼容和可选属性写入。
- 按计算 key 类型决定固定对象、对象联合或字典。
- 拒绝不受支持的动态属性、描述符、原型和代理能力。

Checked HIR 必须记录已经确定的对象类别和语义属性身份；后续阶段不能重新执行 shape 推断。

## 与 TypeScript 的类型差异

| 主题            | TypeScript                  | Nxts                       |
| --------------- | --------------------------- | -------------------------- |
| 裸 `{}` 类型    | 表示非 nullish 顶层对象范围 | 类型位置拒绝。             |
| 对象兼容        | 通常允许额外属性            | 要求精确属性集合。         |
| 新鲜字面量      | 具有额外属性检查特例        | 所有边界统一精确检查。     |
| 普通 `as`       | 允许部分对象断言            | 不支持。                   |
| 动态属性        | 可通过宽结构和 JS 行为描述  | 必须显式使用字典能力。     |
| getter / setter | 支持                        | 普通对象拒绝，类单独支持。 |

这些差异缩小 TypeScript strict 的接受范围，不引入更宽松兼容。

## 诊断与类型测试

| 场景                             | 预期                            |
| -------------------------------- | ------------------------------- |
| 类型位置裸 `{}`                  | 编译错误。                      |
| 表达式 `{}`                      | 精确空形状对象。                |
| 相同属性集合、不同声明顺序       | 类型相同。                      |
| 缺少必需属性                     | 编译错误。                      |
| 包含额外属性                     | 在所有赋值边界编译错误。        |
| 可选属性省略                     | 合法，读取为 `T \| undefined`。 |
| 必需 `T \| undefined` 省略       | 编译错误。                      |
| 可变对象到 readonly              | 零成本允许。                    |
| readonly 到可变                  | 编译错误。                      |
| 宽字符串计算键                   | 推导为字符串字典。              |
| 宽数字计算键                     | 推导为数值索引字典。            |
| getter、setter、Proxy 或动态原型 | 编译错误。                      |

## 下游依赖

- T29 定义接口契约、witness 和接口视图，不改变精确对象兼容。
- T30 定义字典、对象字典视图和动态扩展。
- T36、T45 和 T47 定义类前缀、物理布局与跨模块校验。
- T49 定义对象标准 API。
- T50、T51、T52 和 T54 定义 `in`、索引、展开和 `for...in` 表达式入口。
