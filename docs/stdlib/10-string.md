# 字符串标准库

- 来源能力：T13、T41、T49
- 规范状态：部分定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：10

## 目标与边界

本规范是字符串公开构造、转换和实例方法的唯一权威来源。当前只记录已经确认的能力；完整 ES2020 方法白名单、格式化与构建器名称由 T49 定稿。

## `String(value)`

`String` 是显式转换函数，不是构造器。它支持已确定的基础值格式、普通对象默认文本、数组转换和具有静态 `toString(): string` 的类值。`String(null)` 与 `String(undefined)` 分别返回 `"null"` 和 `"undefined"`。

不支持 `new String(value)`、基础字符串装箱对象、`Symbol.toPrimitive` 或可变原型回退。联合或泛型无法唯一确定转换时必须先收窄。

## `toString`

`string.toString()` 返回原字符串且不分配。数值、boolean、数组、普通对象和类实例的 `toString` 能力按 [`9-stringTypes.md`](../language/types/9-stringTypes.md) 的静态分派表开放。

普通对象固定返回 `"[object Object]"`，不枚举字段。函数和 symbol 当前没有通用 `toString`。

## 大小写

`toUpperCase()` 与 `toLowerCase()` 使用和类型级 `Uppercase<T>` / `Lowercase<T>` 相同的工具链固定 Unicode 非区域化规则。返回值静态类型可以保留相应大小写类型结果，runtime 必须实际转换内容；不能只改变静态类型。

区域化大小写、规范化、指定进制或精度格式化的最终 API 尚待 T49 定稿。

## 性能扩展边界

返回原字符串的转换不得分配。动态格式化只为最终字符串分配；性能敏感的重复构建将由独立标准模块提供线性构建能力，名称尚待定稿。

返回原始 `u16` code unit 的无分配 API、显式 UTF-8 编解码和流式文本能力仍为待确认项，不隐式改变普通索引与 `string` 上限。
