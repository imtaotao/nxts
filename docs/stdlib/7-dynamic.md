# 动态值标准库

- 来源能力：T44
- 规范状态：部分定稿
- 最后更新：2026-07-28
- 文档顺序：7

## 目标与边界

本规范定义显式动态打包和受信运行时类型检查。行为与类型规则已定稿；公开名称、模块路径和声明形式由 T49 最终确定。

## 动态打包

本文使用 `dynamic(value)` 作为概念名：

```ts
import { dynamic } from "std/dynamic";

const input: unknown = dynamic(value);
```

| 源值类别                     | 打包要求                                       |
| ---------------------------- | ---------------------------------------------- |
| 数值、布尔、枚举、symbol     | 保存可信类型标签和内联 payload，通常不分配。   |
| string、对象、类、数组、函数 | 保存原引用和具体类型描述，不复制对象。         |
| 接口                         | 保存底层对象引用、具体类型描述和接口恢复信息。 |
| 不能内联的聚合               | 可以在显式边界装箱。                           |
| 品牌                         | 按底层类型打包，不保存品牌身份。               |

用户同名函数不能创建可信动态描述。

## 受信类型检查

本文使用 `isType<T>(value)` 作为概念名：

```ts
import { isType } from "std/dynamic";

function handle(input: unknown) {
  if (isType<User>(input)) {
    input.name;
  }
}
```

该入口在声明文件中表现为 TypeScript 类型谓词，实际目标限制由 T44 checker 执行。

检查可以直接接收 `unknown` 或接口值。成功恢复原本保存的可信类型身份或接口 witness；它不执行任意对象的逐字段结构验证。

## 检查目标

支持基础值、字面量、精确对象、类、接口、数组、元组、字典、函数、枚举、可检查联合和普通 symbol。目标必须闭合且具体。

不支持 `unknown`、`never`、`void`、`any`、品牌、具体 `unique symbol`、自由泛型参数和开放类型配方。

枚举原始值验证使用 [`6-enum.md`](./6-enum.md)；JSON 等外部数据使用 schema 或类型化解析。

## 控制流与结果

入口返回 `boolean`，checker 把成功 payload 或 witness 与该条件关联。成功目标包含 `null` 或 `undefined` 时，成功分支保留完整目标联合，不使用空值作为失败哨兵。

普通失败返回 `false`，不抛错。完整求值行为见 [`../language/semantics/9-conversionSemantics.md`](../language/semantics/9-conversionSemantics.md)。

## Intrinsic 约束

编译器只按绑定后的标准库符号身份识别 `DynamicPack` 和 `CheckedTypeTest`。用户同名函数是普通函数。

动态布局、装箱阈值和 GC 见 T45–T46；跨模块指纹与 witness 查询见 T47。API 不暴露这些内部表示。

## T49 待确认项

- 模块路径和公开函数名。
- TypeScript 声明中的类型谓词形式。
- schema / 类型化解析 API 与错误结果类型。
- 允许直接产生 `unknown` 的其他动态 API 清单。
