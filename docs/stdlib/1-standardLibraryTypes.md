# 标准库类型边界

- 任务编号：T49
- 规范状态：讨论中
- 实现状态：未实现
- 最后更新：2026-09-02
- 文档顺序：1

## 目标与边界

本规范定义标准模块、根环境符号、intrinsic 身份、优化 API 和宿主能力如何进入编译器。它是标准环境名单和 `builtinId` 的权威来源。

逐类公开方法的行为以本目录叶子文档为唯一来源，本文件不复制方法契约。核心类型身份由 [`language/types`](../language/types/index.md) 定义。词法绑定由 [`4-nameBinding.md`](../compiler/frontend/4-nameBinding.md) 定义：binder 只消费 `BindEnv`，不定白名单。内建能力准入由 [`1-builtinCapabilities.md`](../architecture/1-builtinCapabilities.md) 定义。

具体公开 API 名称、模块路径和根环境名单待定。

## 已确认规则

| 规则     | 当前方案                                                                                 |
| -------- | ---------------------------------------------------------------------------------------- |
| 识别方式 | 编译器按绑定后的符号身份识别 intrinsic，不按标识符文本，不为静态标准库调用做动态模块查找 |
| 传入方式 | host 把根环境写成 `BindEnv` 交给 `bindFile` / `bindProgram`                              |
| 环境符号 | `declNodeId` 为 `null`，带 `builtinId`；用户声明 `builtinId` 为 `null`                   |
| 遮蔽     | 本地或导入的同名符号遮蔽环境符号，且不获得内建语义                                       |
| 空环境   | binder 不打开 `global`；未传入的根名称按未解析处理                                       |
| 性能诊断 | 绑定标准库符号身份；未启用性能采样时不得增加运行时插桩                                   |

parser 不维护内建名称表。checker 先消费绑定结果，再按 `builtinId` 解释语义。

## 内建类型工具

以下工具只存在于类型空间，不要求 import，不生成全局对象属性、runtime 符号或初始化代码。具体计算由 [`27-advancedTypes.md`](../language/types/27-advancedTypes.md) 定义。

| 分类       | 工具                                                                |
| ---------- | ------------------------------------------------------------------- |
| 函数与构造 | `ReturnType`、`Parameters`、`ConstructorParameters`、`InstanceType` |
| 异步       | `Awaited`                                                           |
| 联合       | `Exclude`、`Extract`、`NonNullable`                                 |
| 对象       | `Partial`、`Required`、`Readonly`、`Pick`、`Omit`、`Record`         |
| 推导控制   | `NoInfer`                                                           |
| 接收者     | `ThisParameterType`、`OmitThisParameter`                            |
| 字符串     | `Uppercase`、`Lowercase`、`Capitalize`、`Uncapitalize`              |

这些名称是否进入 `BindEnv` 的 type 空间、以及对应 `builtinId` 编码待定。局部同名类型可以遮蔽它们，但不会获得内建语义：

```ts
type ReturnType<T> = T;
```

能由条件类型和映射类型表达的工具复用统一类型计算器。重载提取、原生 Promise、推导屏蔽和 Unicode 大小写等具有稳定特殊语义的工具可以使用编译器静态 intrinsic，但不能依赖 `any`。

## 根环境

`BindEnv` 的形状已由名称绑定规范确定：`{ name, space, builtinId }[]`。

| 项                                                | 状态 |
| ------------------------------------------------- | ---- |
| 值空间根名称，例如构造器或全局函数                | 待定 |
| 类型空间根名称，含上表工具                        | 待定 |
| `undefined` 是否进入环境                          | 待定 |
| 根名称由 prelude 自动提供，还是必须从核心模块导入 | 待定 |
| `builtinId` 字符串编码                            | 待定 |

playground 或其他 host 可以传入演示用名单，不构成本规范白名单。

## 标准模块

`std/array`、`std/numeric` 等路径和公开导出名称待定。叶子文档里的 import 示例只说明绑定方式，不锁定最终路径。

| 领域   | 行为来源                                     | 本文件状态                                  |
| ------ | -------------------------------------------- | ------------------------------------------- |
| 数组   | [`2-array.md`](./2-array.md)                 | 模块路径、性能 API 名称、intrinsic 身份待定 |
| 类内建 | [`3-classBuiltins.md`](./3-classBuiltins.md) | 可继承白名单和声明载体待定                  |
| 对象   | [`4-object.md`](./4-object.md)               | 最终声明集合和签名待定                      |
| 数值   | [`5-numeric.md`](./5-numeric.md)             | 模块路径、公开名称、结果承载类型待定        |
| 枚举   | [`6-enum.md`](./6-enum.md)                   | 模块路径和公开名称待定                      |
| 动态值 | [`7-dynamic.md`](./7-dynamic.md)             | 模块路径和公开函数名待定                    |
| symbol | [`8-symbol.md`](./8-symbol.md)               | 声明载体待定                                |
| 函数   | [`9-function.md`](./9-function.md)           | 已定稿的属性白名单；声明载体待定            |
| 字符串 | [`10-string.md`](./10-string.md)             | 完整方法白名单、构建器名称待定              |

## 优化 API 与宿主能力

| 项                                     | 状态                                      |
| -------------------------------------- | ----------------------------------------- |
| 线性字符串构建、数组容量等性能专用入口 | 待定；不得改写普通 `+` 或 `push` 的复杂度 |
| 宿主 / FFI 能力如何出现在标准环境      | 待定；服从 T48                            |
| 内建 API 作为函数值时的 wrapper 与 ABI | 待定；见内建能力规范                      |
| 标准库、编译器、runtime 的内建版本握手 | 待定                                      |

## 版本边界

模板字符串和大小写工具使用工具链固定的 Unicode 与格式语义版本。跨模块配方必须记录对应版本；版本不兼容时重新检查或拒绝产物，不能由运行时修补。

## 待定项

1. 根环境 `BindEnv` 名单和 `builtinId` 编码，包括 `undefined`。
2. 标准模块最终路径和各领域公开 API 名称。
3. 值空间构造器进入全局环境还是必须 import。
4. 优化 API 与宿主能力入口。
5. 内建元数据结构、函数值 ABI 和版本握手，与内建能力规范待确认项对齐。
