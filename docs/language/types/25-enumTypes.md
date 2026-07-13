# 枚举类型

- 覆盖能力：T39
- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：25

## 目标与边界

本规范定义 `enum` 与 `const enum` 的声明、成员值、类型身份、兼容、推导、收窄和联合规则。枚举表达具有有限合法值集合的名义标量类型。

其他职责的唯一归属如下：

| 职责                     | 规范文档                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 可观察值与无枚举对象语义 | [`../semantics/8-enumSemantics.md`](../semantics/8-enumSemantics.md)                                             |
| 检查转换与成员遍历 API   | [`../../stdlib/6-enum.md`](../../stdlib/6-enum.md)                                                               |
| 标量、联合与容器布局     | [`../../compiler/representation/1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) |
| Typed IR 契约            | [`../../compiler/ir/1-irContracts.md`](../../compiler/ir/1-irContracts.md)                                       |
| 分支与常量优化策略       | [`../../compiler/optimizer/1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)           |
| 跨模块契约               | [`../../compiler/abi/1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)                                             |

## 核心原则

| 原则         | 要求                                                             |
| ------------ | ---------------------------------------------------------------- |
| 封闭值域     | 安全源码不能构造声明成员集合以外的值。                           |
| 名义身份     | 不同枚举即使成员和值相同也不是同一类型。                         |
| 静态命名空间 | 枚举名用于类型引用和静态成员解析，不是普通值。                   |
| 标量上位类型 | 数字枚举以 `i32` 为上位类型，字符串枚举以 `string` 为上位类型。  |
| 零普通成本   | 类型身份不能迫使普通值包装、分配或重复验证。                     |
| TS 严格子集  | 保留常用 TypeScript 语法，通过拒绝动态枚举对象能力缩小接受范围。 |

## 支持的声明

Nxts 接受普通枚举和常量枚举：

```ts
enum State {
  Idle,
  Running,
}

const enum Priority {
  Low = 1,
  High = 2,
}
```

两者具有相同的类型身份和成员规则。`const enum` 只用于兼容 TypeScript 源码，不是优化开关。

### 声明完整性

同一作用域内的同名枚举只能声明一次。不支持：

- 同名枚举声明合并。
- `namespace` 与枚举合并。
- 模块增强或跨文件追加成员。
- 扩充已导入枚举。
- `declare enum` 与 `declare const enum`。

标准库、runtime 和宿主的可信声明由工具链元数据提供，不开放用户可伪造的 ambient 枚举。

### 声明顺序

类型位置可以向前引用枚举，成员值位置必须遵循 TypeScript 声明顺序：

```ts
function read(value: State): State {
  return value;
}

const initial = State.Idle; // 编译错误

enum State {
  Idle,
}
```

完整名称绑定和 ESM 顺序由 T55、T57 定义。

## 静态成员命名空间

枚举名只允许可在编译期解析的成员访问：

```ts
enum HttpStatus {
  Ok = 200,
  "not-found" = 404,
}

const ok = HttpStatus.Ok;
const missing = HttpStatus["not-found"];
```

成员名可以是标识符、静态属性关键字或字符串字面量。以下形式编译错误：

- 方括号计算名称，包括固定字符串形式的声明名和 `[dynamicName]`。
- 数字成员名称。
- 同一声明中的重复名称。
- `__proto__`。

`__proto__` 在 JavaScript 枚举对象上具有原型相关特殊行为；Nxts 不生成该对象，接受它会为相同源码定义不同结果，因此拒绝。

`Enum.Member` 和 `Enum["Member"]` 都解析为静态成员常量。裸枚举名、动态索引、数字反向映射和对象反射不属于类型系统可接受的枚举操作。

类型位置的 `typeof Enum` 与 `keyof typeof Enum` 由 T40 定义静态命名空间类型，不要求运行时对象。

## 枚举类别

### 数字枚举

数字枚举使用 `i32` 作为底层上位类型：

```ts
enum Status {
  Idle, // 0
  Running, // 1
  Stopped = 10,
  Failed, // 11
}
```

规则如下：

- 首个省略初始化器的成员值为 `0`。
- 后续省略初始化器的值为前一个规范值加 `1`。
- 显式值必须在常量检查后得到合法 `i32`。
- 自动递增超出 `i32` 时编译错误，不回绕。
- 负数和 TypeScript 支持的整数进制字面量按 T08–T09 处理。
- `-0`、`NaN`、无穷、浮点结果和非整数不能成为成员值。

`i64` 等其他底层枚举属于保留扩展；当前超出 `i32` 的值编译错误。

### 字符串枚举

字符串枚举的每个成员必须有静态字符串值：

```ts
enum Mode {
  Fast = "fast",
  Safe = "safe",
}
```

允许字符串字面量、先前的字符串枚举成员，以及 TypeScript 接受且 Nxts 能在编译期折叠的字符串常量表达式。运行时函数调用、可变值和结果类型不确定的表达式均编译错误。

### 混合枚举

同一枚举不能混合数字与字符串成员：

```ts
enum Invalid {
  Numeric = 1,
  Text = "text",
}
// 编译错误
```

需要异构值时使用显式联合类型。

## 成员初始化

所有成员值必须在编译期完全确定。普通枚举可以引用 TypeScript 允许且 Nxts 能证明的外部数字常量：

```ts
const base = 100;

enum Code {
  None,
  Success = base,
  Created = Success + 1,
}
```

数字初始化器可以包含：

- `i32` 字面量。
- 已完成求值的先前枚举成员。
- 可证明的编译期数字常量。
- 括号、一元负号及 T09 已支持的 `+`、`-`、`*`、`/`、`%`。

常量运算遵循普通 `i32` 规则：加、减、乘按已定规则回绕；除零、取模零、`i32.MIN / -1` 与 `i32.MIN % -1` 编译错误。当前不能使用位运算和移位。

`const enum` 初始化器还必须属于 TypeScript `const enum` 接受的常量表达式；外部 `const` 即使能被 Nxts 求值也不能使用。

以下情况编译错误：

| 场景                     | 原因                        |
| ------------------------ | --------------------------- |
| 随机值、时间或普通调用   | 依赖运行时执行。            |
| 可变变量                 | 不能进入稳定静态契约。      |
| 数字与字符串混合         | 没有单一底层类型。          |
| 浮点或超范围值           | 不是合法 `i32`。            |
| 自动递增溢出             | 超出 `i32`。                |
| 无效整数除法             | 除零、取模零或 `MIN / -1`。 |
| 后置成员或循环引用       | 不能形成有限常量结果。      |
| 运行时字符串表达式       | 不能形成静态字符串成员。    |
| `boolean`、`bigint` 等值 | 不属于支持的底层类型。      |

## 重复值与空枚举

### 重复值别名

不同成员名可以具有相同规范值：

```ts
enum HttpStatus {
  Ok = 200,
  Success = 200,
}
```

重复值成员是同一个枚举值的静态别名：

- 两个成员类型互相兼容。
- 联合、收窄与穷尽检查按不同规范值计算，只覆盖一次。
- 首次声明名称是规范诊断名称。
- 其他别名保留在源码诊断和可选工具元数据中。
- 成员名不形成独立运行时 tag。

### 空枚举

空枚举是合法的不可构造名义类型：

```ts
enum Empty {}

const values: Empty[] = [];
```

为保持 TypeScript strict 子集，`Empty` 不隐式等同于 `never`，`Empty | T` 也不归一为 `T`。控制流和优化器可以在类型检查后利用其不可构造事实，诊断仍保留枚举名称。

## 类型身份与成员类型

每个枚举声明建立独立名义身份：

```text
EnumType
├─ TypeId
├─ BackingKind: I32 | String | Empty
├─ CanonicalMembers: ordered unique values
├─ Aliases: source names -> canonical values
└─ StaticNamespace: source names -> member types
```

`TypeId` 由绑定后的声明符号确定，不由名称文本或成员结构推导。不同模块的同名枚举也不兼容。透明类型别名不创建新枚举身份。

每个规范成员形成所属枚举的精确下位类型：

```ts
const exact = State.Idle; // State.Idle
const general: State = exact;
```

重复值别名共享同一个规范成员类型。

## 兼容与转换

枚举可以零成本进入对应底层上位类型：

```ts
const code: i32 = State.Idle;
const text: string = Mode.Fast;
```

反方向不成立，即使底层字面量恰好等于成员值：

```ts
const first: State = 0; // 编译错误

function parseState(raw: i32) {
  const second: State = raw; // 编译错误
}
```

不同枚举之间不能经共同底层类型隐式互转。普通 `as` 也不能把数字、字符串、其他枚举、联合或动态值伪造为枚举。底层值进入枚举必须使用 [`../../stdlib/6-enum.md`](../../stdlib/6-enum.md) 定义的受信检查转换。

## 运算符与结果类型

枚举可以使用对应底层类型的能力，但产生新值的运算不返回枚举：

```ts
const next = State.Idle + 1; // i32
const ordered = State.Idle < 10; // boolean
const label = "mode:" + Mode.Fast; // string
```

| 操作                          | 结果                                         |
| ----------------------------- | -------------------------------------------- |
| 同一枚举的 `===`、`!==`       | 比较规范值并参与收窄。                       |
| 枚举与对应底层值比较          | 合法，结果为 `boolean`。                     |
| 数字枚举算术和大小比较        | 使用 `i32` 能力，结果为 `i32` 或 `boolean`。 |
| 字符串拼接、比较和只读能力    | 使用 `string` 能力，结果不恢复枚举。         |
| 不同枚举直接比较或运算        | 编译错误。                                   |
| `++`、`--` 和复合赋值写回枚举 | 编译错误。                                   |
| 位运算和移位                  | 按 T50 当前边界编译错误。                    |

改变枚举状态必须赋值另一个声明成员，不能把普通底层运算结果写回封闭枚举。

## 推导与 widening

```ts
const constantState = State.Idle; // State.Idle
let mutableState = State.Idle; // State
const states = [State.Idle, State.Running]; // State[]

function currentState() {
  return State.Idle;
}
// 返回 State
```

规则如下：

- `const` 绑定和单个直接泛型捕获保留精确成员。
- mutable 变量、普通数组、函数推导返回和多个枚举候选 widening 到所属枚举。
- 枚举不会自动 widening 到 `i32` 或 `string`。
- 显式成员联合可以保留部分成员精度。
- `as const` 对象和元组由 T40 定义。

多个泛型候选来自同一枚举时 widening 到完整枚举；单个候选可以保留成员类型。

## 控制流与穷尽检查

严格相等、严格不等与 `switch` 可以按规范成员值收窄：

- 每个不同规范值只覆盖一次。
- 重复值别名不能形成第二个可区分分支。
- 对应的底层字面量可以作为 `case`，但诊断优先显示成员名。
- 不属于枚举的底层常量 `case` 编译错误。
- 覆盖全部成员后，防御性 `default` 中的枚举值类型为 `never`。

普通 `switch` 没有显式 `never` 位置时不强制穷尽。显式返回类型、`assertNever` 或其他 `never` 位置可以暴露遗漏成员。

精确成员可以作为对象判别字段：

```ts
type Token =
  | { kind: TokenKind.Text; text: string }
  | { kind: TokenKind.Number; value: i32 };
```

宽 `kind: TokenKind` 不能区分对象联合成员，重复值别名也不能区分不同对象类型。联合状态下不能通过字段写入切换成员，必须替换完整对象。

## 与联合类型组合

同一枚举的成员联合按规范值归一：

- 覆盖全部不同值时可归一为完整枚举。
- 只覆盖部分值时保留成员联合。
- 重复值别名去重。
- 空枚举保持名义身份。

枚举与底层上位类型组成联合时被吸收：

```ts
type Numeric = State | i32; // i32
type Textual = Mode | string; // string
```

不同枚举组成的联合保留静态名义成员。底层值重叠时，控制流不能从运行时值恢复来源枚举，必须保留所有具有该值的候选。数字枚举与字符串枚举的联合仍保留两类成员。

枚举与 `null`、`undefined` 的类型构造遵循 T14、T21、T23；具体 niche 与状态布局不进入类型关系。

## 容器与泛型

枚举可以作为对象字段、数组和元组元素、字典键、`Map` / `Set` 键及闭合泛型实参。

可变容器遵循不变规则：

```ts
const states: State[] = [];
const numbers: i32[] = states; // 编译错误
```

只读容器仅在 T03、T38 和 T45 的协变及表示门槛都满足时，才可形成零复制上位视图：

```ts
const view: readonly i32[] = states;
```

泛型实例化不能丢失 checker 中的枚举 `TypeId`。`Record<Enum, V>`、映射类型和枚举键类型计算由 T40–T41 定义；有限枚举键集合可以形成固定对象类型。

## Flags 边界

普通枚举不承担 flags 语义。当前位运算和移位未开放，组合结果也通常不属于封闭成员集合。

T50 可以在原生整数位运算确定后定义独立 flags 或 bitset 类型，但不得借此允许任意整数进入普通枚举。

## Checker 职责

checker 必须：

1. 建立枚举名义身份、成员下位类型、规范值和别名关系。
2. 常量求值成员初始化器并检查顺序、循环、范围和类别。
3. 执行底层单向兼容、禁止伪造、运算结果和 widening。
4. 按规范值完成联合归一、收窄、判别与显式穷尽检查。
5. 在 Checked HIR 中保留枚举 `TypeId` 与受信转换节点。

checker 不生成枚举对象、选择机器布局、分支策略、GC 描述或跨模块二进制格式。

## 与 TypeScript / JavaScript 的差异

| 场景                     | TypeScript / JavaScript    | Nxts                         |
| ------------------------ | -------------------------- | ---------------------------- |
| 普通 `enum`              | 生成可变运行时对象         | 静态命名空间与标量常量。     |
| `const enum`             | 通常内联，受工具链选项影响 | 与普通枚举类型规则相同。     |
| 数字底层                 | JavaScript `number`        | 固定 `i32`。                 |
| number 赋给数字枚举      | TypeScript 允许部分宽赋值  | 全部拒绝，必须验证。         |
| 运行时数字初始化器       | 普通枚举可以接受           | 拒绝。                       |
| 浮点、超 `i32` 与混合值  | 可以接受部分形式           | 拒绝。                       |
| 反向映射和对象反射       | 由运行时枚举对象提供       | 不支持，使用显式标准库入口。 |
| 声明、namespace、ambient | 支持部分合并与声明形式     | 应用源码拒绝。               |
| flags 数字枚举           | 可借助位运算表达           | 留给独立扩展。               |

通过 Nxts checker 的枚举源码，在提供 Nxts 内建声明后应继续通过 TypeScript strict 检查。Nxts 只缩小接受范围。

## 诊断与类型测试

至少覆盖：

- 普通与 `const enum` 的同类型规则。
- 数字自动值、负值、字符串常量及合法重复值。
- 混合、浮点、超范围、无效除法、后置引用和循环初始化器。
- 空枚举保持名义身份且不可构造。
- 不同枚举赋值、底层反向赋值与 `as Enum` 均拒绝。
- `const`、mutable、数组、返回和泛型 widening。
- 算术、拼接、严格比较和写回限制。
- 成员 `switch`、重复别名、判别联合与 `never` 位置。
- 同枚举成员联合、不同枚举联合及底层吸收。
- 可变容器拒绝和只读视图表示门槛。
- 动态枚举名访问、裸枚举值和对象反射拒绝。
- TypeScript strict 对照样例。

## 依赖关系

| 相关能力          | 本规范使用的结论                         |
| ----------------- | ---------------------------------------- |
| T03–T06           | 兼容、公共上界、推导、控制流与穷尽检查。 |
| T08–T14、T20      | `i32`、字符串、字面量、运算与空值类型。  |
| T21、T23          | 联合归一和空值联合表示约束。             |
| T26、T30、T34–T35 | 对象、字典、数组和元组类型关系。         |
| T37–T38           | 泛型实例化、代码共享前提与方差。         |
| T40–T41           | 静态命名空间和枚举键类型计算。           |
| T43–T44           | 普通断言拒绝与受信转换分类。             |
| T45–T49           | 表示、GC、ABI、FFI 与标准库入口。        |
| T50、T55、T57     | 位运算边界、模块顺序与名称绑定。         |
