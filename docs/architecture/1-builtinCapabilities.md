# 内建能力

- 规范状态：讨论中
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：1

## 目标

定义 Nxts 语法关键字、内建类型、内建运算符、编译器内建 API 和 runtime intrinsic 的职责边界，避免 parser、checker、标准库和运行时通过名称约定重复实现同一能力。

程序接受和编译阶段边界见 [`syntax`](../language/syntax/index.md)。具体内建能力的用户语义由对应功能文档定义，本文档只规定统一接入规则。

## 能力分类

| 分类              | 示例                          | 识别与实现位置                                  |
| ----------------- | ----------------------------- | ----------------------------------------------- |
| 语法关键字        | `import`、`return`、`extends` | parser 识别并产出经过 Nxts 语法验证的 Babel AST |
| 内建类型          | `number`、`i32`、`void`       | converter 归一化，checker 定义类型规则          |
| 内建运算符        | `+`、`===`、`!`               | parser 保留语法，checker 按操作数类型解析       |
| 编译器内建 API    | 标准数值模块的 checked 运算   | 使用普通调用语法，checker 解析为稳定内建符号    |
| runtime intrinsic | GC 分配、写屏障、平台调用     | 只供 Typed IR 和 runtime 使用，不直接暴露给源码 |

普通标准库 API 不属于编译器内建能力。能够使用 Nxts 代码正确且高效实现的功能应留在标准库，不进入 compiler intrinsic 集合。

`import` 属于语法关键字，不是内建 API。checked 运算使用普通 TypeScript 导入与调用语法，parser 不负责理解其溢出语义。

## 准入规则

一项公开 API 只有在普通 Nxts 代码无法正确或高效实现，并且至少满足以下一类条件时，才进入编译器内建集合：

| 条件                       | 典型场景                           |
| -------------------------- | ---------------------------------- |
| 需要 LLVM 或 CPU 特殊指令  | checked arithmetic、SIMD、原子操作 |
| 需要编译器类型或布局信息   | 对象反射、泛型布局、类型描述符     |
| 参与 GC、内存或 ABI        | 分配、写屏障、原生调用边界         |
| 普通调用会引入不可接受成本 | 必须内联的底层原语                 |
| 需要跨平台确定语义         | 平台指令差异和稳定失败行为         |

内建能力不得仅用于缩短普通标准库代码，也不得因为某个函数常用就默认获得特殊编译路径。

## 符号识别

编译器按名称解析后的符号身份识别内建 API，不能按成员名称文本匹配：

```ts
import { checkedAddI32 } from 'std/numeric';

const customCheckedAddI32 = (a: i32, b: i32) => a + b;

customCheckedAddI32(a, b); // 普通用户函数
checkedAddI32(a, b); // 根据导入绑定识别为 Nxts 内建符号
```

示例名称只说明符号绑定方式，最终公开名称由 T49 与 [`5-numeric.md`](../stdlib/5-numeric.md) 确定。

内建类型名称属于保留绑定，用户不能在相同作用域重新声明。普通标准库对象如果允许被局部名称遮蔽，checker 必须根据实际绑定判断，不能根据 `Object.keys` 等文本直接生成 intrinsic。

## 编译链路

编译器内建 API 使用普通 TypeScript 表面语法，并在名称解析后转换为专用语义节点：

```text
checkedAddI32(a, b)
  ↓ parser
普通调用 AST
  ↓ checker 名称解析和类型检查
稳定 BuiltinId + 类型参数
  ↓ Typed IR
CheckedAdd<i32>
  ↓ lowering
LLVM intrinsic 或 runtime helper
```

parser 不直接维护内建 API 名称表。checker 必须先完成正常的作用域和符号解析，再决定调用是否指向内建能力。LLVM lowering 不得根据源码名称反推语义。

## 内建定义

每项内建能力需要一份稳定定义，至少包含：

| 信息               | 作用                                        |
| ------------------ | ------------------------------------------- |
| `BuiltinId`        | checker、Typed IR 和 runtime 之间的稳定身份 |
| 公开名称与绑定位置 | 源码入口和名称解析规则                      |
| 类型签名           | 参数、返回值、泛型和可用类型                |
| 副作用与成本       | 是否分配、失败、读写内存或进入系统调用      |
| lowering           | 常量求值、LLVM intrinsic 或 runtime helper  |
| 目标约束           | CPU、OS、ABI 和不支持目标的诊断             |

用户不能声明编译器内部的 `BuiltinId` 或伪造内建元数据。编译器、核心标准库和 runtime 版本必须能够检测不兼容的内建定义。

## 公开 API 与内部实现

公开内建 API 保持稳定的类型签名和可观察语义，内部实现可以按目标选择：

```text
编译期常量求值
LLVM intrinsic
目标相关指令序列
runtime helper
```

不同 lowering 不能改变结果、失败条件和副作用。未使用某项内建 API 的普通代码不应承担该能力的运行时成本。

以 checked 整数加法为例，公开入口属于标准数值模块，并降低为专用 `CheckedAdd` IR，再使用 LLVM overflow intrinsic。具体名称、返回类型、失败模型和完整 API 清单由 T49 与 [`5-numeric.md`](../stdlib/5-numeric.md) 确定。

## 函数值边界

内建 API 是否能脱离直接调用位置作为函数值使用，需要按统一规则确定：

```ts
const add = checkedAddI32;
```

如果允许，编译器需要生成具有稳定函数 ABI 的 wrapper；如果不允许，checker 必须产生明确诊断。不能让不同内建 API 随意选择而没有文档记录。

## 文档与验证

每项内建能力在标记为支持前必须具备：

| 交付物        | 验证内容                              |
| ------------- | ------------------------------------- |
| 用户语义文档  | 输入、输出、失败、边界和成本          |
| checker 测试  | 正确绑定、类型检查、遮蔽和错误诊断    |
| Typed IR 测试 | 稳定 BuiltinId 和语义节点             |
| lowering 测试 | LLVM intrinsic 或 runtime helper 选择 |
| 一致性测试    | 常量求值、不同目标和运行时结果一致    |

只在 checker 中添加名称判断，不代表该内建能力已经得到支持。

## 待确认项

1. `BuiltinId`、签名和副作用元数据的具体数据结构。
2. 内建类型值命名空间由 prelude 自动提供，还是通过核心模块显式导入。
3. 内建 API 作为函数值时的统一 wrapper 和 ABI 规则。
4. 核心标准库、编译器和 runtime 的内建版本握手机制。
5. checked arithmetic 之外的第一批内建 API 清单。
