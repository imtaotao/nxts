# 布尔与 Truthiness 语义

- 覆盖能力：T07
- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：10

## 目标与边界

本规范定义 `boolean`、条件位置、逻辑非和逻辑短路的用户可观察行为。静态类型和收窄规则见 [`../types/7-basicTypes.md`](../types/7-basicTypes.md)。

## 布尔值

`boolean` 只有 JavaScript 的 `true` 与 `false` 两个值。比较、相等和逻辑非产生普通布尔值，不产生包装对象。

## 条件 Truthiness

条件位置使用 JavaScript truthiness：

- `false`、数值零、`NaN`、空字符串、`null` 和 `undefined` 为 falsy。
- 其他已支持值按对应 JavaScript 值行为判断。
- truthiness 不把源值转换或存储为 `boolean`。
- 对象、数组、类实例和函数引用始终 truthy。

条件适用于 `if`、`while`、`for` 条件和条件表达式。

## 逻辑非

`!value` 先判断值的 truthiness，再返回相反的布尔值。输入只求值一次，不改变输入值的表示或身份。

## `&&` 与 `||`

逻辑运算符保持 JavaScript 值选择和短路：

- `left && right` 先求值 `left`；左侧 falsy 时直接返回左值，否则求值并返回右值。
- `left || right` 先求值 `left`；左侧 truthy 时直接返回左值，否则求值并返回右值。
- 左侧只求值一次。
- 被短路的右侧不求值。
- 左侧异常直接传播。

`??` 使用空值判断而非 truthiness，见 [`3-nullishSemantics.md`](./3-nullishSemantics.md)。

## 性能语义

truthiness、`!` 和短路相对等价手写控制流不得引入装箱、堆分配、对象裁剪或通用动态类型。静态已知 truthiness 可以常量折叠，但必须保留操作数求值和异常顺序。

## 语义测试

至少覆盖所有 falsy 基础值、truthy 引用值、`!` 单次求值、`&&`/`||` 右侧短路、左侧异常，以及静态常量折叠不删除副作用。

## 依赖关系

- T08–T14 定义各基础值的具体 truthiness。
- T44 定义显式动态值检查，不改变普通 truthiness。
- T50 完成逻辑与条件表达式规则。
