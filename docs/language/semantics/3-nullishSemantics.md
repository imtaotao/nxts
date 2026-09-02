# 空值与缺失值语义

- 覆盖能力：T14
- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：3

## 目标与边界

本规范定义 `null`、`undefined`、空值合并、可选链和缺失值的用户可观察行为。静态赋值、收窄与结果类型见 [`../types/10-nullAndUndefined.md`](../types/10-nullAndUndefined.md)；物理表示见 [`../../compiler/representation/1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)。

## 值语义

Nxts 同时保留并严格区分两个单例值：

```ts
undefined === null; // false
```

- `null` 表示显式提供的空值。
- `undefined` 表示未提供或不存在。
- 读取未初始化变量在静态阶段被禁止，不能观察为 `undefined`。

## 严格比较

空值只参与 `===` 与 `!==`，结果保持 JavaScript 严格相等语义：

```ts
null === undefined; // false
null !== undefined; // true
```

静态类型已经证明比较结果时，编译器可以常量折叠，但必须保留两个操作数的求值顺序、副作用与错误传播。空值比较不执行隐式转换。

## `typeof`

`typeof` 保持 JavaScript 的可观察结果：

```ts
typeof undefined === 'undefined'; // true
typeof null === 'object'; // true
```

`typeof` 不执行用户代码，也不把 `null` 改写为独立的 `"null"` 结果。未绑定名称由静态名称绑定拒绝，不提供 JavaScript 的动态查询特例。

## 空值合并

`left ?? right` 按以下顺序执行：

1. `left` 只求值一次。
2. `left` 为 `null` 或 `undefined` 时才求值并返回 `right`。
3. 其他左值直接返回，`false`、`0`、`NaN` 与空字符串不触发右侧。
4. 左侧求值失败时直接传播错误，不求值右侧。

```ts
0 ?? 10; // 0
false ?? true; // false
'' ?? 'default'; // ""
null ?? 'value'; // "value"
```

左侧静态确定非空或确定为空时允许消除条件分支，但不得删除左侧求值或改变副作用顺序。`??` 不执行 truthiness 判断、隐式转换或动态类型分派。

`??=` 的单次读取、条件判断与写回顺序由 T50 和 T52 定义，并继承本节的空值判断。

## 可选链

成员、索引与调用位置的可选链共享以下行为：

```ts
user?.name;
items?.[getIndex()];
callback?.(createValue());
```

1. 可选段左侧只求值一次。
2. 左侧为 `null` 或 `undefined` 时，该段短路并产生 `undefined`。
3. 短路时不求值属性 key、索引表达式或调用参数，后续连续链段也不执行。
4. 左侧为其他值时执行普通访问或调用，不使用 truthiness 判断。

可选链不吞掉普通访问或调用产生的错误。静态证明左侧非空时可以消除空值检查，但必须保留普通操作及其求值顺序。

## 默认参数与解构默认值

省略参数与显式传入 `undefined` 都触发默认参数；`null` 是显式值，不触发默认值：

```ts
function run(count = 10) {
  return count;
}

run(); // 10
run(undefined); // 10
run(null); // 类型不接受 null 时编译错误
run(0); // 0
```

解构默认值采用相同原则：来源缺失或值为 `undefined` 时使用默认值，值为 `null` 时不使用。默认值表达式的具体求值环境与顺序由 T32 和 T52 定义。

可选参数不使用额外的“已省略”运行时状态，也不为普通调用传递隐藏实参数量。

## 可选属性缺失

对象属性缺失与属性存在但值为 `undefined` 是不同的可观察状态：

```ts
const absent: { value?: string } = {};
const present: { value?: string } = { value: undefined };

absent.value; // undefined
present.value; // undefined
Object.hasOwn(absent, 'value'); // false
Object.hasOwn(present, 'value'); // true
```

读取结果相同，但存在性、枚举、删除和重新添加行为必须保持差异。具体对象行为见 [`4-objectSemantics.md`](./4-objectSemantics.md)。

## `arguments` 边界

Nxts 不隐式创建 JavaScript `arguments` 对象，不支持 `arguments.length`、`arguments.callee` 或 `arguments.caller`。

`arguments` 不是保留字，显式声明时是普通标识符。需要接收可变数量参数时使用类型化 rest 参数。该限制避免为每次普通调用物化动态实参数组或保留不可优化的参数别名语义。

## 性能语义

空值操作相对等价手写判断不得增加装箱、堆分配或通用动态分派：

- 空值测试只检查 T45 规范表示中已有的判别信息，不创建新的动态状态。
- 标量与引用空值联合都不能仅为检查分配包装对象。
- 已建立的稳定非空事实可以复用，避免重复检查。
- 重新赋值、闭包捕获与别名调用使事实失效的规则由 T06 和 T58 定义。

具体 niche、状态和机器宽度由[类型运行时表示](../../compiler/representation/1-typeRepresentation.md)唯一确定。这些约束保证未使用空值能力的代码不承担运行时成本，常见空值路径可接近等价 Go 分支的成本。

## 语义测试

至少覆盖：

| 场景                           | 预期结果                           |
| ------------------------------ | ---------------------------------- |
| 两个空值严格比较               | 身份和结果保持区分。               |
| `??` 左侧具有副作用或抛错      | 只求值一次并保持错误顺序。         |
| 可选索引与可选调用短路         | key、参数及后续链段不求值。        |
| 省略参数和显式 `undefined`     | 都触发默认值；`null` 不触发。      |
| 可选属性缺失与显式 `undefined` | 读取相同，存在性与枚举结果不同。   |
| 使用隐式 `arguments`           | 未声明名称报错；显式同名变量合法。 |
| 已证明非空的 `??` 与可选链     | 保留求值语义并允许消除空值分支。   |

## 依赖关系

- T06 定义收窄事实的稳定性。
- T23 与 T45 定义空值联合的物理表示和零成本边界。
- T26、T27 与 T34 定义对象属性和数组元素中的缺失状态。
- T32、T50–T53 定义参数、表达式、赋值、访问与调用的完整求值顺序。
- T58 定义闭包和可能修改别名的调用如何使非空事实失效。
