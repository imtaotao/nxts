# 标准类型工具

- 任务编号：T49
- 规范状态：部分定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：1

## 目标与边界

本规范定义全局类型空间中的标准工具符号、内建身份和遮蔽规则。工具的具体类型计算语义由 [`27-advancedTypes.md`](../language/types/27-advancedTypes.md) 定义；本文件不建立运行时全局对象或模块初始化。

## 内建工具

| 分类       | 工具                                                                |
| ---------- | ------------------------------------------------------------------- |
| 函数与构造 | `ReturnType`、`Parameters`、`ConstructorParameters`、`InstanceType` |
| 异步       | `Awaited`                                                           |
| 联合       | `Exclude`、`Extract`、`NonNullable`                                 |
| 对象       | `Partial`、`Required`、`Readonly`、`Pick`、`Omit`、`Record`         |
| 推导控制   | `NoInfer`                                                           |
| 接收者     | `ThisParameterType`、`OmitThisParameter`                            |
| 字符串     | `Uppercase`、`Lowercase`、`Capitalize`、`Uncapitalize`              |

工具只存在于类型空间，不要求 import，不生成全局对象属性、runtime 符号或初始化代码。

## 符号身份

checker 按 binder 解析后的标准符号身份识别 intrinsic，不能按标识符文本识别。局部或导入的同名类型可以遮蔽标准工具，但不会获得内建语义：

```ts
type ReturnType<T> = T;
// 当前作用域中是普通用户类型别名
```

能由条件类型和映射类型表达的工具复用统一类型计算器。重载提取、原生 Promise、推导屏蔽和 Unicode 大小写等具有稳定特殊语义的工具可以使用编译器静态 intrinsic，但不能依赖 `any`。

## 版本边界

模板字符串和大小写工具使用工具链固定的 Unicode 与格式语义版本。跨模块配方必须记录对应版本；版本不兼容时重新检查或拒绝产物，不能由运行时修补。
