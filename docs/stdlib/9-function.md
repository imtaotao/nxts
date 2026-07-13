# 函数内建能力

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：9
- 覆盖能力：T32、T33

## 目标与边界

本规范是普通函数值公开属性和内建能力白名单的唯一权威来源。函数的静态签名见 [`20-functionTypes.md`](../language/types/20-functionTypes.md)，可观察调用行为见 [`13-functionSemantics.md`](../language/semantics/13-functionSemantics.md)。

## 公开属性

普通函数值只提供两个不可写、不可删除且不可枚举的内建属性：

```ts
interface FunctionMetadata {
  readonly name: string;
  readonly length: number;
}
```

`name` 保持 JavaScript 的名称推导直觉。函数别名不改变原名称：

```ts
function load(): void {}
const save = (): void => {};
const alias = save;

load.name; // "load"
save.name; // "save"
alias.name; // "save"
```

`length` 等于第一个默认参数之前的普通形参数量。可选参数计数，显式 `this`、rest 参数以及第一个默认参数之后的参数不计数：

```ts
function first(a: i32, b?: i32): void {}
function second(a: i32, b = 0, c: i32): void {}
function third(a: i32, ...rest: i32[]): void {}

first.length; // 2
second.length; // 1
third.length; // 1
```

ABI 适配或重载入口选择不改变原函数的 `name` 和 `length`。

## 不支持能力

函数值不是普通对象或字典，不提供：

- `call`、`apply` 和 `bind`。
- 自定义动态属性。
- `prototype`、`caller` 和 `callee`。
- `Function` 动态构造器或可修改的 `Function.prototype`。

需要保留接收者时使用箭头函数；需要参数转发时使用类型化参数、rest 与 spread。最终内建声明和 intrinsic 身份由 T49 定稿。
