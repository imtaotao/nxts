# 对象标准库

- 来源能力：T26、T27
- 规范状态：部分定稿
- 文档顺序：4

## 目标与边界

本规范是 `Object` 静态方法和普通对象默认方法的公开 API 权威来源。T26–T27 已确定的行为保持定稿；最终声明集合和 intrinsic 身份由 T49 定稿。

## `Object.hasOwn`

`Object.hasOwn(object, key)` 检查底层实际对象的自身字符串属性，不包含类继承成员或固定根成员：

```ts
type Options = {
  value?: string | undefined;
};

const a: Options = {};
const b: Options = { value: undefined };

Object.hasOwn(a, "value"); // false
Object.hasOwn(b, "value"); // true
```

| key 与自身形状关系 | 处理                   |
| ------------------ | ---------------------- |
| 必需自身属性       | 可折叠为 `true`。      |
| 可选自身属性       | 检查存在状态。         |
| 继承或不存在属性   | 可折叠为 `false`。     |
| 动态字符串         | 查询描述符和存在状态。 |

接口值查询底层具体对象，联合值按当前成员查询，类值只检查实例自身属性。静态 key 的控制流事实由 T24 定义；宽字符串只返回 `boolean`。

## `Object.keys`

`Object.keys(object)` 返回新的 `string[]`，包含底层实际对象当前存在且可枚举的自身字符串属性：

```ts
const value = {
  name: undefined,
};

Object.keys(value); // ["name"]
```

结果顺序由[对象语义](../language/semantics/4-objectSemantics.md)定义。接口契约和静态基类视图不会隐藏额外实际成员；类方法和固定根成员不进入结果。

每次调用语义上创建新数组。静态属性名复用共享字符串值，不为每个 key 重建字符串。编译器只有在结果身份和可变性不可观察时才能消除数组或融合循环。

返回数组的更精确静态类型由 T49 确定。

## `Object.values` 与 `Object.entries`

字典和支持反射的对象可以使用：

```ts
Object.values(value);
Object.entries(value);
```

两者只包含当前存在的自身可枚举成员，并分别创建新的值数组或 `[string, value]` 条目数组。接口和基类视图按底层实际对象枚举，不裁剪额外成员。

字典结果值类型是索引值类型与索引域之外固定可枚举成员类型的规范联合。成员类型本身允许 `undefined` 时保留；不因 key 可能缺失额外加入 `undefined`。

最终泛型签名由 T49 确定。

### 数组与元组

数组和元组只暴露当前实际存在的稠密索引，不暴露容量、缓冲区或方法成员：

| 调用                    | 结果                                |
| ----------------------- | ----------------------------------- |
| `Object.keys(value)`    | 按升序返回十进制索引字符串数组。    |
| `Object.values(value)`  | 返回元素浅拷贝数组。                |
| `Object.entries(value)` | 返回 `[string, element]` 条目数组。 |

每次调用创建新的结果数组；身份和可变性不可观察时可以融合后续循环。

## `Object.create(null)`

只有存在字典上下文类型时，`Object.create(null)` 才是原生空字典构造入口：

```ts
const dict: { [key: string]: i32 } = Object.create(null);
```

无上下文字典类型时无法推导值类型，产生编译错误。`Object.create(nonNullPrototype)` 不属于该入口。

## 默认 `toString`

普通对象和没有显式类覆盖的类实例返回 `"[object Object]"`。调用不枚举、反射或拼接字段。

普通对象不能用实例属性覆盖该固定默认能力。类可以按 T36 显式实现同签名方法。

## 不支持的 API

当前不支持：

- `Object.freeze`、`Object.seal`、`Object.preventExtensions` 及状态查询。
- `Object.setPrototypeOf`。
- 无字典上下文的 `Object.create(null)` 和非空原型 `Object.create`。
- `Object.defineProperty` 和属性描述符 API。
- `hasOwnProperty`、`valueOf`、`isPrototypeOf`、`propertyIsEnumerable`。
- `__proto__`。
- `Proxy`。

`Object.create(null)` 只作为 T30 字典构造能力存在，不创建普通对象。

## T49 待确认项

- `Object.keys` 返回类型是否保留有限键联合。
- `Object.values`、`Object.entries` 的标准签名。
- `Object.hasOwn` 与默认 `toString` 的 intrinsic 身份。
- 支持 API 的 ES 版本边界。
