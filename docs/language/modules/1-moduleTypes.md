# 程序与模块

- 任务编号：T55
- 规范状态：讨论中
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：1

## 目标

定义源文件、模块边界、模块解析和模块初始化语义。

## 当前决定

### 仅支持 ES Module

Nxts 仅支持 ES Module，不支持 CommonJS 模块系统。所有源文件均按 ES Module 解析和编译。

因此：

- 使用静态 `import` 和 `export` 表达模块依赖与导出。
- 不支持 `require()`、`module.exports` 和 `exports` 等 CommonJS 能力。
- 模块作用域、链接和初始化规则以 ES Module 语义为基础。
- Host 和 CLI 不需要提供 CommonJS 模块解析或互操作兼容层。

### ES Module 语义

对于 Nxts 接受的 ES Module 能力，其可观察行为必须与 JavaScript ES Module 一致。文件扩展名、模块标识符解析和当前支持的语法范围由 Nxts 单独定义，不改变已接受能力的运行时语义。

| 语义             | 要求                                                           |
| ---------------- | -------------------------------------------------------------- |
| 模块实例         | 同一模块在一个程序实例中只初始化和执行一次                     |
| 导入与导出绑定   | 导入是只读 live binding；导出方更新绑定后，导入方可观察到新值  |
| 链接与初始化     | 依赖关系在执行前建立，模块按照 JavaScript ES Module 规则初始化 |
| 循环依赖         | 保持 JavaScript ES Module 的循环依赖和暂时性死区行为           |
| 模块命名空间对象 | 属性、绑定可见性和访问行为与 JavaScript ES Module 一致         |

编译器不得通过复制导入值、重复执行模块或改变初始化顺序来换取更简单的实现。

### 源文件扩展名

`.ntx` 是 Nxts 源文件的正式扩展名。在 Nxts 开发者工具完善前，编译器同时接受 `.ts` 文件作为兼容输入。

`.ntx` 和 `.ts` 文件使用相同的 Nxts 语法、静态语义和 ES Module 规则。`.ts` 兼容输入不启用另一套 TypeScript 语义，也不代表编译器接受 Nxts 尚未支持的 TypeScript 能力。

当前编译器只接受 `.ntx` 和 `.ts` 文件，不接受 `.tsx`、`.mts`、`.ctx` 及其他扩展名。其他扩展名的最终规范状态仍待对应语言能力和开发者工具方案确定。

`.ts` 兼容输入的移除条件和迁移方式待开发者工具方案确定后决定。

### 静态导入与导出

Nxts 支持标准 ES Module 的静态导入、导出和重新导出形式。

| 分类       | 支持形式                                                                       |
| ---------- | ------------------------------------------------------------------------------ |
| 静态导入   | 默认导入、命名导入、命名空间导入、副作用导入，以及默认导入与其他形式的合法组合 |
| 静态导出   | 默认导出、声明导出、导出列表                                                   |
| 重新导出   | 命名重新导出、全部重新导出、命名空间重新导出                                   |
| 仅类型模块 | `import type`、`export type`                                                   |

```ts
import defaultValue from "./defaultValue";
import { value, other as renamed } from "./values";
import * as values from "./values";
import "./initialize";
import type { Options } from "./types";

export const result = defaultValue;
export { value, renamed };
export { value as externalValue } from "./values";
export * from "./values";
export * as values from "./values";
export type { Options } from "./types";
export default result;
```

`import type` 和 `export type` 只参与静态类型检查，不创建运行时模块绑定或运行时依赖。TypeScript 的 `import x = require("x")` 和 `export =` 属于 CommonJS 兼容能力，不受支持。

### import attributes 语法入口

Parser 和 Validator 接受标准 `with` 形式的 import attributes，并完整保留 `ImportAttribute` 节点、属性顺序和源码范围：

```ts
import data from "./data.json" with { type: "json" };
```

语法接受不代表资源模块能力已经实现。在资源类型、加载方式、缓存、产物格式和 Host 边界形成完整方案前，模块语义检查必须产生明确的能力诊断并阻止生成 HIR。旧 import assertions 的 `assert {}` 形式不受支持，也不作为 `with {}` 的兼容别名。

### 相对模块路径

当前模块标识符只支持以 `./` 或 `../` 开头的相对文件路径，不支持裸模块名称、绝对路径、URL 或路径别名。

相对文件路径可以显式写出扩展名，也可以省略扩展名。

- 显式写出 `.ntx` 或 `.ts` 时，只解析指定文件。
- 省略扩展名时，依次查找同名 `.ntx` 和 `.ts` 文件。
- 同名 `.ntx` 和 `.ts` 文件同时存在时，解析 `.ntx` 文件。
- 相对路径不隐式解析目录入口；导入目录中的入口文件时必须明确写出文件名。

```ts
import { value } from "./value"; // 优先解析 ./value.ntx，其次解析 ./value.ts
import { ntxValue } from "./value.ntx";
import { tsValue } from "./value.ts";
import { feature } from "./feature/index";
```

以下模块标识符当前不受支持：

```ts
import "package-name";
import "/absolute/path/module.ntx";
import "https://example.com/module.ntx";
import "@/aliased/module";
```

### `import()` 与顶层 `await` 的实现顺序

Parser 和 Validator 接受 `import()` 表达式与顶层 `await` 并完整保留 Babel AST，但当前 Checker 和后续编译链不实现动态模块加载或顶层异步模块执行。Checker 必须产生明确的能力诊断并阻止生成 HIR，不能因为语法已经接受就将能力标记为已实现。

动态模块加载和顶层异步模块执行均依赖尚未定义的 Promise、异步执行模型和异步模块初始化，因此不能仅完成语法解析后将其标记为已实现。

在 Promise 与异步执行模型形成稳定方案后，再共同确定并实现：

- `import()` 的返回值、失败传播和模块命名空间语义。
- 运行时模块解析、缓存、单次初始化和并发加载行为。
- 原生目标加载预编译模块时的产物格式和 ABI 校验。
- 顶层 `await` 对依赖模块、入口程序和循环依赖的影响。
- Host 是否允许运行时编译或加载源文件。

该实现顺序不代表永久不支持这两项能力，其最终规范状态仍待异步能力设计完成后确认。

## 待确认项

1. `.ts` 兼容输入的移除条件和迁移方式。
2. 其他扩展名的最终规范状态。
3. import attributes 的资源类型、加载方式、缓存、产物格式和 Host 语义。
4. `import()` 与顶层 `await` 的最终规范状态。
