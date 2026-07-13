# 字符串语义

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-21
- 文档顺序：2

## 目标

定义普通字符串的 UTF-16 值、索引、比较、格式化、拼接、模板求值和长度失败等用户可观察行为。

静态类型规则见 [`9-stringTypes.md`](../types/9-stringTypes.md)，语法接受范围见 [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)，物理表示见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，runtime 算法见 [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md)，公开 API 见 [`10-string.md`](../../stdlib/10-string.md)。

## 字面量语法

普通字符串字面量使用 JavaScript/TypeScript 的单引号、双引号和 cooked 转义语义：

```ts
const single = "text";
const double = "text";
const escaped = "\n\t\x41\u4F60\u{1F600}";
```

完整接受与拒绝矩阵由 [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md) 定义。类型级模板字符串类型由 [T41 高级类型](../types/27-advancedTypes.md) 定义。

## 值语义

- 字符串不可变。
- `length` 使用 UTF-16 code unit 计数。
- 索引行为按 UTF-16 code unit 定义。
- 超出范围的索引返回 `undefined`，不产生 trap / panic。
- 允许通过转义序列表示未配对的 UTF-16 代理 code unit。
- 相等和普通大小比较按 UTF-16 code unit 值定义。

```ts
"😀".length === 2;
```

## 静态类型边界

`string` 的基础值身份、只读成员、索引结果、运算分类和模板插值要求由 [`9-stringTypes.md`](../types/9-stringTypes.md) 定义。`String(value)`、`toString()` 与大小写方法由 [`10-string.md`](../../stdlib/10-string.md) 定义。

## 运行时表示

内部编码不能改变本规范的 UTF-16 值语义，存储对象也不赋予 `string` 用户可观察身份。Latin-1/UTF-16 布局由 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) 定义，存储选择、子串、哈希和缓存由 [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md) 定义。

## 长度与索引

- 小节状态：T13 已定稿

`length` 的值是 UTF-16 code unit 数量。有效索引返回由对应单个 code unit 组成的字符串，包括未配对代理项；越界返回 `undefined`：

```ts
function read(text: string, index: i32) {
  const char = text[index];
  // string | undefined
}
```

UTF-16 代理对的两个位置分别返回两个单 code unit 字符串。索引静态类型和允许的索引类型由 [`9-stringTypes.md`](../types/9-stringTypes.md) 定义；单字符缓存与无包装实现由 [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md) 定义。

## 字符串比较

- 小节状态：T13 已定稿

字符串比较按完整 UTF-16 code unit 序列执行：

| 运算符               | 语义                            |
| -------------------- | ------------------------------- |
| `===`、`!==`         | 判断完整序列相等或不等。        |
| `<`、`<=`、`>`、`>=` | 按 code unit 值执行字典序比较。 |

```ts
"abc" === "abc"; // true
"10" < "2"; // true
```

规范等价但 code unit 序列不同的字符串仍不相等：

```ts
"\u00E9" === "e\u0301"; // false
```

比较不执行跨类型转换、Unicode 规范化、大小写折叠或区域化排序。静态接受范围见 [`9-stringTypes.md`](../types/9-stringTypes.md)；动态比较和混合编码算法见 [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md)。

## 静态字符串转换

- 小节状态：T13 已定稿

静态转换的接收者规则由 [`9-stringTypes.md`](../types/9-stringTypes.md) 定义，公开 `String(value)` 与 `toString()` 能力由 [`10-string.md`](../../stdlib/10-string.md) 定义。本规范只固定这些入口产生的文本和不读取 `Symbol.toPrimitive`、`valueOf` 或可变原型的可观察边界。

## `+` 拼接

- 小节状态：T13 已定稿

`+` 的静态运算分类和允许拼接的操作数由 [`9-stringTypes.md`](../types/9-stringTypes.md) 定义。字符串拼接不执行 JavaScript 式 `ToPrimitive`，也不读取 `Symbol.toPrimitive`、`valueOf` 或可变原型。

```ts
const count = "count: " + 10;
const enabled = "enabled: " + true;
const missing = "value: " + undefined;
const objectText = "value: " + objectValue;
```

`+` 保持从左到右求值和左结合。每个子表达式根据其静态操作数独立确定运算类别：

```ts
1 + 2 + "3"; // "33"
"1" + 2 + 3; // "123"
```

### 基础值格式

字符串拼接中的基础值格式是语言可观察行为，不受目标平台、系统区域设置或运行时环境影响：

| 类型或值            | 输出规则                                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `number`            | 完整采用 JavaScript Number 的默认十进制字符串规则。                                                      |
| `f64`               | 与 `number` 使用相同的默认十进制格式。                                                                   |
| `f32`               | 生成能够按 `f32` 规则还原为同一值的最短十进制文本，普通形式与指数形式的选择沿用 JavaScript Number 风格。 |
| 固定宽度整数        | 输出数学值的完整十进制文本，不使用指数形式。                                                             |
| `usize`、`isize`    | 按当前编译目标上的数学值输出完整十进制文本，不使用指数形式。                                             |
| `boolean`           | 分别输出 `"true"` 或 `"false"`。                                                                         |
| `null`、`undefined` | 分别输出 `"null"` 或 `"undefined"`。                                                                     |
| 浮点 `NaN`          | 输出 `"NaN"`。                                                                                           |
| 浮点正负无穷        | 分别输出 `"Infinity"` 或 `"-Infinity"`。                                                                 |
| 浮点 `0`、`-0`      | 均输出 `"0"`。                                                                                           |

`f32` 格式化必须直接基于 binary32 值，不能先扩宽为 `f64` 后按 binary64 精度生成文本。所有默认格式只使用 ASCII 数字、`-`、`.`、`e` 和必要的指数符号，不使用千位分隔符，也不受小数点区域格式影响。区域化和指定进制、精度的格式化 API 由 T49 定义，不能改变普通 `+` 的默认输出。

### 拼接求值与失败顺序

拼接必须保留源代码从左到右的求值顺序。按左结合语义，当前前缀已经超过字符串上限时先抛出 `RangeError`，后续表达式不再求值。

常量折叠、扁平拼接、格式化缓冲区、单次最终分配和零装箱规则由 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) 与 [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md) 定义。循环中的重复拼接诊断由 [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md) 定义。

## 长度边界

- 小节状态：T13 已定稿

字符串长度在语言层使用 `i32`，跨平台最大值固定为 `2^31 - 1` 个 UTF-16 code unit。运行时内部可以使用无符号字段存储已验证的非负长度，但不能改变公开类型或放宽语言上限。

| 场景                         | 结果                                         |
| ---------------------------- | -------------------------------------------- |
| 编译期可证明结果超过上限     | 编译错误。                                   |
| 动态创建、拼接或解码超过上限 | 在分配或写入结果前抛出 `RangeError`。        |
| 长度加法或乘法发生整数溢出   | 视为超过上限，在分配前抛出 `RangeError`。    |
| 长度合法但物理内存不足       | 进入运行时 OOM 路径，不伪装成 `RangeError`。 |

失败时不能出现整数回绕、静默截断或部分可观察结果。checked 长度计算、分配和检查消除规则由 [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md) 与 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) 定义。

T13 固定超长字符串的错误类别和触发边界；`RangeError` 的创建、传播、栈展开和 ABI 由 T61 同步异常规范统一定义。物理内存不足的处理由运行时内存模型定义，不属于可恢复的字符串长度错误。

超过普通字符串上限的文本必须通过分段、流式或映射能力处理，不能通过放宽单个 `string` 的长度字段绕过上限。此类能力的总长度可以使用 `i64` 或 `u64`，但每个实际 `string` 片段仍遵守 T13 上限。

## 模板字符串

- 小节状态：T13 已定稿

Nxts 支持无插值模板和普通插值模板字符串：

```ts
const multiline = `first
second`;
const message = `count: ${count}, enabled: ${enabled}`;
```

无插值模板产生普通 `string`，使用 JavaScript cooked template 的转义和换行语义。普通插值模板的静态要求由 [`9-stringTypes.md`](../types/9-stringTypes.md) 定义。

插值表达式严格从左到右求值，并使用与 `+` 相同的基础值格式和长度失败边界。普通模板不创建用户可观察的 raw 数组或模板对象。非法转义和 AST 保留规则由 [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md) 定义，IR 与 lowering 规则由 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md) 和 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) 定义。

### Tagged template

Tagged template 不属于当前语言能力：

```ts
html`<div>${value}</div>`; // 编译错误
```

`TaggedTemplateExpression` 必须产生明确的不支持诊断，不得改写为普通函数调用或字符串拼接。未来若支持，必须完整定义 cooked/raw 模板对象身份、插值原值传递、调用类型、缓存、GC 根和模块初始化，不能用每次分配模板数组或提前字符串化插值近似 JavaScript 行为。

## 编译器与运行时职责

| 职责            | 权威文档                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 静态类型检查    | [`9-stringTypes.md`](../types/9-stringTypes.md)                                                                                       |
| 语法与 AST 保留 | [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)                                                                                    |
| Typed IR        | [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)                                                                              |
| lowering 与优化 | [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)                                                         |
| 物理布局与 ABI  | [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)、[`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) |
| runtime 与 GC   | [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md)、[`1-gcTypeDescriptors.md`](../../runtime/gc/1-gcTypeDescriptors.md) |
| 公开 API 与诊断 | [`10-string.md`](../../stdlib/10-string.md)、[`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md)             |

哈希算法和缓存方式不是语言可观察行为；哈希值不能作为稳定序列化格式。

## 依赖边界

| 相关能力           | T13 固定内容                         | 相关能力负责内容                                |
| ------------------ | ------------------------------------ | ----------------------------------------------- |
| T20 字面量类型     | 字符串和常量模板的运行时值           | 字面量保留、widening 与联合归一化               |
| T23 空值联合       | 索引结果为 `string \| undefined`     | tag、优化布局与 ABI                             |
| T34 数组           | 数组使用静态字符串转换               | `join`、嵌套数组和循环数组行为                  |
| T45–T47 表示与 ABI | 双编码、不可变、长度和无隐藏分配约束 | 精确布局、GC 描述和跨模块 ABI                   |
| T48 FFI            | 内部字符串不是 UTF-8 指针            | 编码、所有权和外部调用转换                      |
| T49 标准库         | 方法不得改变 T13 基础语义            | 方法签名、构建器和显式格式化 API                |
| T50–T51 表达式     | 字符串操作数和结果规则               | 通用运算符、成员访问和索引入口                  |
| T53 调用与构造     | tagged template 当前拒绝             | tagged template、`String` 调用和构造边界        |
| T60 迭代器         | UTF-16 code unit 是底层值序列        | 字符串迭代是否以及如何按 JS code point 语义暴露 |
| T61 异常           | 超长字符串触发 `RangeError`          | 创建、传播、栈展开和异常 ABI                    |

## 诊断与测试

静态接受与拒绝测试由 [`9-stringTypes.md`](../types/9-stringTypes.md) 和 [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md) 定义。本规范的可观察行为测试至少覆盖：

| 场景                                                 | 预期结果                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `"😀".length`                                        | 返回 `2`。                                                           |
| 索引代理对的两个位置                                 | 分别返回对应单个代理 code unit 字符串。                              |
| 负数和超长索引                                       | 返回 `undefined`，不 trap。                                          |
| Latin-1、UTF-16 及混合编码比较                       | 结果只取决于 UTF-16 code unit。                                      |
| `"10" < "2"` 与规范等价但编码序列不同的文本          | 分别返回 `true` 与不相等。                                           |
| `number`、`f32`、`f64`、整数、特殊浮点值和 `-0` 拼接 | 输出符合基础值格式表。                                               |
| 连续 `+` 和普通插值模板                              | 保持从左到右求值。                                                   |
| 前缀长度超过上限且后续表达式有副作用                 | 先抛出 `RangeError`，后续表达式不求值。                              |
| 总长度等于和超过 `2^31 - 1`                          | 边界值允许；超过时在分配前报错，使用边界测试运行时避免实际巨额分配。 |
| Debug 与 Release                                     | 产生相同字符串值、错误顺序和边界行为。                               |

生成代码与性能测试由 [`1-stringRuntime.md`](../../runtime/objects/1-stringRuntime.md)、[`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) 和 [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md) 定义。
