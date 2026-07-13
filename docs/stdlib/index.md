# 标准库

本目录定义内建类型、标准模块、intrinsic 身份、公开 API 和性能专用能力。

标准库是字符串、数组、对象等公开方法的存在性、签名和 API 专属可观察行为的唯一权威来源。语言规范只定义这些值的核心行为和类型约束，runtime 私有入口不构成公开 API。

## 已确认子规范

- [`1-standardLibraryTypes.md`](./1-standardLibraryTypes.md)：T49 全局类型工具、内建身份和遮蔽规则；完整标准环境仍待定稿。
- [`2-array.md`](./2-array.md)：T34 已确认的数组 API；模块路径与 intrinsic 身份由 T49 定稿。
- [`3-classBuiltins.md`](./3-classBuiltins.md)：T36 已确认的类内建能力；最终白名单和声明由 T49 定稿。
- [`4-object.md`](./4-object.md)：T26–T27 已确认的对象 API；最终声明集合由 T49 定稿。
- [`5-numeric.md`](./5-numeric.md)：T08–T12 已确认的数值转换和整数运算 API；最终名称由 T49 定稿。
- [`6-enum.md`](./6-enum.md)：T39 已确认的枚举检查转换与成员遍历；最终名称由 T49 定稿。
- [`7-dynamic.md`](./7-dynamic.md)：T44 已确认的动态打包与受信类型检查；最终名称由 T49 定稿。
- [`8-symbol.md`](./8-symbol.md)：T18 已确认的 symbol 入口与扩展边界；最终声明由 T49 定稿。
- [`9-function.md`](./9-function.md)：T32–T33 已确认的函数内建属性与能力白名单；最终声明由 T49 定稿。
- [`10-string.md`](./10-string.md)：T13/T41 已确认的字符串转换、大小写与性能扩展边界；完整白名单由 T49 定稿。
