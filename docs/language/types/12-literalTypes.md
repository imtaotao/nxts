# 字面量类型

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-24
- 文档顺序：12

## 目标

定义布尔、数字和字符串字面量作为静态类型时的身份、推导、widening、兼容和联合归一化规则，并保证精确信息不改变运行时表示。

## 支持范围

T20 支持以下字面量类型：

```ts
type Direction = "left" | "right";
type Status = 200 | 404;
type Enabled = true;
```

| 类别                | 支持范围                                         |
| ------------------- | ------------------------------------------------ |
| 布尔字面量          | `true`、`false`。                                |
| 字符串字面量        | 单引号、双引号，以及没有插值项的普通模板字符串。 |
| 数字字面量          | `number`、原生整数和原生浮点基础上的有限规范值。 |
| `null`、`undefined` | 是独立空值类型，不归类为字面量类型。             |
| `unique symbol`     | 由 T18 定义的声明身份单例类型，不归 T20。        |
| bigint 字面量       | T19 不支持。                                     |
| 模板字符串类型      | T41 已定稿；运行时模板字符串由 T13 定义。        |

`NaN`、`Infinity` 和 `-Infinity` 没有对应字面量类型，表达式按 T08、T10 推导为基础数值类型。它们仍可以作为显式数值上下文中的特殊常量使用。

## 语义身份与规范化

字面量类型的规范身份由“基础类型 + 规范值”组成：

```text
BooleanLiteral(boolean, true)
StringLiteral(string, UTF16("ready"))
NumericLiteral(i32, 1)
NumericLiteral(f64, 1.0)
NumericLiteral(number, 1.0)
```

不同引号、转义写法或无插值模板产生相同 UTF-16 code unit 序列时，是同一字符串字面量类型。数字分隔符、进制和指数等源码拼写不直接参与类型身份；checker 先按目标或默认基础类型解析，再使用该基础类型中实际可表示的规范值判断相等。

基础类型是数字字面量身份的一部分。默认推导得到的 `1` 以 `i32` 为基础，`1.0` 以 `f64` 为基础，因此二者即使数学值相同也不是同一 Nxts 类型。上下文指定 `number`、其他原生整数或原生浮点类型时，按对应类型的范围与精度直接构造字面量候选，不先创建默认类型再转换。

静态类型系统将 `-0` 与 `0` 规范为相同的零字面量类型，与 TypeScript 一致。对 `number`、`f32` 和 `f64`，Typed IR 仍必须在实际常量值中保留负零符号；类型规范化不能把运行时 `-0` 改写为 `0`。整数上下文中的 `-0` 就是整数零。

## 字面量产生边界

以下来源可以产生或保留字面量类型：

- 直接布尔、字符串和数字字面量语法。
- 没有插值项的普通模板字符串。
- 直接负数字面量语法，例如 `-1`。
- 已保留字面量类型的 `const` 别名。
- 条件表达式、控制流收窄和泛型推导按各自规则保留的有限字面量集合。
- 显式字面量类型注解和上下文类型。

普通算术、字符串拼接、函数调用和优化器常量传播不自动产生新的源码级字面量类型：

```ts
const sum = 1 + 1; // i32，不是 2
const text = "a" + "b"; // string，不是 "ab"
```

优化器仍可把这些表达式折叠为常量，但优化结果不能反向改变 checker 类型或诊断。具体运算符若需要产生字面量结果，必须由 T50 明确列入静态规则，不能依赖优化级别。

## 负数字面量

Babel AST 保持 JavaScript / TypeScript 语法结构：`-1` 是一元负号节点和正数字面量操作数。checker 在字面量候选阶段识别直接负数字面量，并在选择默认类型或执行上下文范围检查前应用符号：

```ts
const min: i32 = -2147483648; // 合法
const tooSmall: i32 = -2147483649; // 编译错误
```

该顺序保证有符号整数最小值不因其正幅值暂时越界而被错误拒绝。负数不能采用无符号上下文，只有 `-0` 可以按无符号零接受。

`-value`、`-(1)` 和其他非直接负数字面量形式按普通一元运算检查，即使优化器之后能证明结果为常量，也不据此形成负数字面量类型。负数字面量的源码范围需要覆盖负号和数值部分，用于诊断和常量折叠。

## 保留与 widening

widening 只丢弃静态精确信息，不执行运行时转换：

| 字面量类型      | widening 目标                                                 |
| --------------- | ------------------------------------------------------------- |
| `true`、`false` | `boolean`。                                                   |
| 字符串字面量    | `string`。                                                    |
| 整数字面量      | 当前候选的原生整数类型；无上下文默认规则见 T08。              |
| 浮点字面量      | 当前候选的 `f32`、`f64` 或 `number`；无上下文默认规则见 T08。 |

各使用位置按以下规则处理：

| 场景                              | 规则                                                  |
| --------------------------------- | ----------------------------------------------------- |
| `const` 直接初始化与 `const` 别名 | 保留字面量类型。                                      |
| `let`                             | widening 到对应基础类型。                             |
| 可写对象属性                      | 默认 widening；`const` 只限制对象绑定，不使属性只读。 |
| 普通数组元素                      | 先 widening，再计算元素公共类型。                     |
| 显式基础类型上下文                | 直接使用上下文基础类型。                              |
| 显式字面量上下文                  | 保留并检查精确值和数字基础类型。                      |
| 条件表达式                        | 无上下文时保留不同字面量联合；有上下文时按目标检查。  |

```ts
const mode = "on"; // "on"
const alias = mode; // "on"
let mutable = "on"; // string

const config = { mode: "on" }; // { mode: string }
const modes = ["on", "off"]; // string[]
const selected = flag ? "on" : "off"; // "on" | "off"
```

`readonly` 上下文中的精确属性类型可以保留字面量，但 T20 不通过普通对象字面量自行推导 `readonly`。`as const` 的支持范围和递归只读行为由 [T40](./26-typeOperators.md) 定义。

## 函数返回推导

函数返回推导先按 T05 收集和合并候选，再应用以下 widening 规则：

- 合并结果只有一个布尔、字符串或数字字面量成员时，返回类型 widening 到对应基础类型。
- 合并结果包含多个不同字面量成员时，保留字面量联合。
- 一个返回表达式本身已经产生多成员字面量联合时，同样保留该联合。
- 显式返回类型和上下文函数类型优先，不执行额外 widening。

```ts
function single() {
  return "ready";
}
// () => string

function multiple(flag: boolean) {
  if (flag) return "ready";
  return "failed";
}
// () => "ready" | "failed"

const choose = (flag: boolean) => (flag ? 1 : 2);
// (flag: boolean) => 1 | 2
```

该规则与 TypeScript 6.0 的普通函数推导一致。`true | false` 在联合归一化后为 `boolean`，因此返回两个布尔字面量不会保留冗余联合。

## 赋值兼容与联合归一化

字面量类型可以零成本赋给对应基础类型。基础类型不能赋给字面量类型，除非源表达式的静态类型已经是该字面量，或控制流规则已经证明对应有限成员：

```ts
const ready: "ready" = "ready";
const text: string = ready;

const requireReady = (unknownText: string) => {
  const invalid: "ready" = unknownText; // 编译错误
};
```

联合归一化遵守以下规则：

```text
"a" | "a"       => "a"
"a" | string    => string
true | false     => boolean
1(i32) | i32     => i32
1(i32) | 1(f64)  => 保留两个不同基础类型的成员
```

同一基础类型下的多个不同字面量默认保留为联合，不因数量增加自动 widening。联合成员排序、复杂度预算和跨基础类型运行时表示由 T21 定义；官方编译器至少支持 65535 个简单规范成员，复杂度超限时必须明确报错，不能静默改成基础类型并扩大接受范围。

同一基础表示下的字面量联合不需要额外运行时 tag。`"on" | "off"` 仍存储普通字符串，`1 | 2` 仍存储对应原生数值；分支判断直接比较现有值。

## 泛型推导

字面量实参可以为直接捕获值类型的泛型参数提供精确候选：

```ts
function identity<T>(value: T) {
  return value;
}

const value = identity("ready"); // "ready"
```

多个候选按 T04、T05 计算公共类型，不能使用 `any`、`unknown` 或隐藏转换兜底。参数约束、可变容器位置和上下文返回类型是否要求 widening 由 T37 结合本节的基础关系定义。

字面量泛型实例的实现共享与收益驱动专门化由 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) 定义，不改变本节的静态推导结果。

## 运行时与优化边界

字面量类型必须与对应基础类型共享值表示，不增加 tag、字段、装箱或 GC 成本。具体布局见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，常量事实见 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)，实现共享见 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)，公开签名编码见 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)。

## 编译器职责

| 阶段职责                        | 权威来源                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------- |
| 语法节点、原始文本和源码范围    | [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)                            |
| 数值解析与常量提交              | [`6-constantEvaluation.md`](../../compiler/frontend/6-constantEvaluation.md)  |
| 类型驻留、widening 和控制流成员 | 本规范、T02、T05、T06                                                         |
| Checked HIR 常量事实            | [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)                      |
| lowering 与代码共享             | [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) |
| 跨模块字面量身份                | [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)                             |

## 与 TypeScript 的兼容性

布尔和字符串字面量、`const` 保留、`let` / 对象 / 数组 widening、函数返回以及泛型直接捕获规则保持 TypeScript 行为。Nxts 的主要差异是数字字面量还携带 `i32`、`f64`、`number` 等基础类型身份；不同原生数值表示不因数学值相同而成为同一类型。

该差异会拒绝 TypeScript 中依赖统一 `number` 世界的部分写法，但不会引入 TypeScript 无法解析的语法或更宽松的类型关系。`as const`、模板字符串类型和 bigint 字面量分别由 [T40](./26-typeOperators.md)、[T41](./27-advancedTypes.md) 和 T19 定义，不能从 T20 的普通字面量支持中隐式获得。

## 诊断与测试

至少覆盖以下场景：

| 场景                                       | 预期                                              |
| ------------------------------------------ | ------------------------------------------------- |
| `const`、`let`、可写对象属性和数组元素     | 分别按保留或 widening 规则推导。                  |
| `1`、`1.0` 和显式原生数值上下文            | 基础类型身份正确，范围和精度规则由 T08–T10 验证。 |
| `-2147483648` 与相邻越界值                 | 先应用符号再检查 `i32` 范围。                     |
| `0`、`-0`                                  | 静态类型归一，浮点运行时符号保持。                |
| 单字面量与多字面量函数返回                 | 分别 widening 和保留联合。                        |
| 重复字面量、基础类型吸收和 `true \| false` | 按联合归一化规则处理。                            |
| 算术或字符串拼接常量                       | 可以优化折叠，但静态结果保持基础类型。            |
| 字面量泛型候选                             | 保留精确候选且不强制复制机器码。                  |
| 跨模块公开字面量签名                       | 规范基础类型和值保持一致。                        |
