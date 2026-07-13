# Symbol 标准库

- 来源能力：T18
- 规范状态：部分定稿
- 最后更新：2026-07-28
- 文档顺序：8

## 目标与边界

本规范定义当前 symbol 公开入口和明确拒绝的 API。构造行为与类型规则已定稿，最终内建声明归 T49。

## `Symbol`

当前只提供可调用、不可构造的 `Symbol`：

```ts
const token = Symbol("token");
const numbered = Symbol(1);
const anonymous = Symbol();
```

候选签名为：

```ts
Symbol(description?: string | number): symbol
```

`const` 直接初始化时，checker 可以推导新的 `unique symbol`。调用的值行为见 [`../language/semantics/11-specialValueSemantics.md`](../language/semantics/11-specialValueSemantics.md)。

## 当前不提供

- `Symbol.for` 与 `Symbol.keyFor`。
- `Symbol.iterator`、`Symbol.asyncIterator` 及其他 well-known symbols。
- `.description`、`.toString()`、`.valueOf()` 和 symbol 包装对象。
- `Object.getOwnPropertySymbols` 与 `Reflect.ownKeys` 的 symbol 分支。

静态迭代能力由 T60 独立定义，不依赖自定义 JavaScript symbol 协议。

## 扩展边界

未来可以增加 well-known symbol、全局 registry 和静态 symbol 属性键，但不得要求未使用这些能力的普通对象预留动态表、协议分派或实例元数据。

## T49 待确认项

- `Symbol` 的内建声明载体。
- 描述参数是否沿用候选 `string | number`。
- 调试描述保留策略和构建选项。
