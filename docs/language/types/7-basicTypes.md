# 基础类型

- 覆盖能力：T07
- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：7

## 目标与边界

本规范汇总基础值类型范围，并定义 `boolean` 的静态类型规则。truthiness 与逻辑求值行为见 [`../semantics/10-booleanSemantics.md`](../semantics/10-booleanSemantics.md)；机器布局见 [`../../compiler/representation/1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)。

## 跨类型原则

- Nxts 是 JavaScript / TypeScript strict 的静态可编译子集。
- 已接受的 JavaScript 功能保持其可观察行为。
- 无法完整保持语义或静态编译边界的能力在编译期拒绝。
- 原生性能扩展类型必须具有确定类型身份和表示需求。
- 性能最终目标是等价 Go 程序级别，不能用统一动态值换取表面兼容。

## 类型清单

| 分类                | 类型                      | 当前状态   | 详细设计                                               |
| ------------------- | ------------------------- | ---------- | ------------------------------------------------------ |
| JavaScript 基础类型 | `boolean`                 | 已定稿     | 本文档                                                 |
| 数值类型            | `number`                  | 已定稿     | [`8-nativeNumericTypes.md`](./8-nativeNumericTypes.md) |
| 字符串类型          | `string`                  | 已定稿     | [`9-stringTypes.md`](./9-stringTypes.md)               |
| 空值类型            | `null`、`undefined`       | 已定稿     | [`10-nullAndUndefined.md`](./10-nullAndUndefined.md)   |
| 静态特殊类型        | `void`、`never`           | 已定稿     | [`11-specialTypes.md`](./11-specialTypes.md)           |
| 字面量类型          | 布尔、数字和字符串字面量  | 已定稿     | [`12-literalTypes.md`](./12-literalTypes.md)           |
| Nxts 原生数值类型   | 定宽整数、浮点、平台整数  | 已定稿     | [`8-nativeNumericTypes.md`](./8-nativeNumericTypes.md) |
| 动态顶层类型        | `any`                     | 永久不支持 | [`11-specialTypes.md`](./11-specialTypes.md)           |
| 显式动态值类型      | `unknown`                 | 已定稿     | [`11-specialTypes.md`](./11-specialTypes.md)           |
| 身份基础类型        | `symbol`、`unique symbol` | 已定稿     | [`11-specialTypes.md`](./11-specialTypes.md)           |
| 大整数类型          | `bigint`                  | 当前不支持 | [`11-specialTypes.md`](./11-specialTypes.md)           |

## `boolean`

`boolean` 是严格二值类型。`true` 和 `false` 字面量类型可以零成本兼容到 `boolean`，其他基础类型不能隐式兼容：

```ts
let flag: boolean = true;
let invalid: boolean = 1; // 编译错误
```

比较和相等运算的结果类型为 `boolean`：

```ts
const same = value === null;
const ordered = count > 0;
```

比较本身不授权隐藏数值转换、装箱或对象裁剪。具体操作数边界由对应类型与 T50 定义。

## 条件位置

控制流条件接受 T07 语义规范定义的 truthy/falsy 值，不要求静态类型必须是 `boolean`：

```ts
function read(value: string | null | undefined) {
  if (value) {
    value; // string
  }
}
```

checker 只执行保守收窄：

- 真分支可以排除 `null` 与 `undefined`。
- 不推导“非零 number”或“非空 string”等值范围类型。
- `if`、`while`、`for` 条件和条件表达式使用相同入口规则。
- 循环稳定性和分支合并由 [`6-typeNarrowing.md`](./6-typeNarrowing.md) 定义。

一元 `!` 接受条件兼容表达式，结果类型为 `boolean`，并可以按否定后的 truthiness 参与控制流分析。

## 逻辑表达式的类型边界

`&&` 与 `||` 不是只接受并返回 `boolean` 的运算符。它们的结果类型来自 JavaScript 值选择语义：

```ts
const name = input || "anonymous";
const user = ready && currentUser;
```

`&&`、`||`、`??` 的完整结果类型由 T50 定义。`??` 是空值合并，不属于布尔运算。

## Checker 职责

checker 必须：

1. 检查 `boolean` 与字面量的兼容。
2. 把比较和 `!` 的结果标记为 `boolean`。
3. 验证条件位置是否属于支持的值类型。
4. 产生保守 truthiness 收窄事实。
5. 为逻辑表达式保留 T50 所需的左右值类型。

checker 不选择 `boolean` 的机器宽度、ABI 传递方式或 LLVM 类型。

## 诊断与类型测试

| 场景                            | 结果                        |
| ------------------------------- | --------------------------- |
| `let value: boolean = true`     | 接受。                      |
| 数字或字符串赋给 `boolean`      | 拒绝。                      |
| 比较表达式                      | 推导为 `boolean`。          |
| `if (maybeValue)`               | 接受并按空值规则保守收窄。  |
| `if (count)` 且 `count: number` | 接受，不推导非零类型。      |
| `!maybeValue`                   | 接受，结果为 `boolean`。    |
| `left && right`                 | 接受，结果类型由 T50 确定。 |

## 依赖关系

- T03–T06 定义兼容、类型格、推导和控制流收窄。
- T08–T14 定义数值、字符串与空值的条件行为基础。
- T45 与 T47 定义布尔布局和跨模块 ABI。
- T50 定义比较、逻辑和条件表达式。
