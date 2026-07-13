# 元组类型

- 任务编号：T35
- 规范状态：已定稿
- 文档顺序：22

## 目标与边界

本规范定义元组的类型身份、创建与推导、固定位置、optional/rest 形状、索引、写权限、数组兼容、解构类型和递归类型边界。

元组使用 JavaScript 数组的引用身份和可观察行为，但以固定位置类型和创建后长度不可变为静态契约。以下能力由其他规范继续定义：

| 能力                               | 规范归属 |
| ---------------------------------- | -------- |
| 数组的动态长度、标准方法和迭代协议 | T34、T60 |
| 泛型 variadic tuple 的推导与实例化 | T37、T41 |
| `as const` 的完整字面量保留规则    | T40      |
| 精确机器布局、GC 编码和跨模块 ABI  | T45–T47  |
| 元组辅助函数的标准库路径和公开名称 | T49      |
| 解构、spread、调用和循环的语法入口 | T52–T54  |
| 函数 rest、捕获、逃逸和副作用分析  | T32、T58 |

元组不是值语义结构体。赋值、传参和返回默认传递引用；优化器只有在身份、别名和逃逸均不可观察时才能拆分或消除元组对象。

数组身份、固定长度、复制、遍历和失败行为见 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md)，公开方法见 [`2-array.md`](../../stdlib/2-array.md)，物理布局见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)。

## 核心语义

元组满足以下不变量：

| 不变量       | 类型要求                                                     |
| ------------ | ------------------------------------------------------------ |
| 位置类型固定 | 每个已声明位置具有独立静态类型，写入不能改变该位置类型。     |
| 长度形状固定 | 类型记录全部合法长度；单个实例不能通过类型安全操作改变长度。 |
| 写权限明确   | mutable 只允许写已有位置，readonly 禁止通过该视图写入。      |
| 数组类别     | 元组可以使用规范明确开放的数组读取与方法能力。               |
| 局部付费     | 固定元组不为 rest、动态索引或 variadic tuple 预付表示成本。  |

“可变元组”只表示已有位置可写，不表示长度可变。固定元组、可选元组和 rest 元组的每个实际实例都遵守实例长度固定规则。

## 类型语法与标签

固定元组使用 TypeScript 元组语法：

```ts
type Point = [i32, i32];
type Entry = [key: string, value: i32];
type ReadonlyPoint = readonly [x: i32, y: i32];
```

标签只用于源码可读性、IDE 展示和诊断，不参与类型身份、兼容、布局或 ABI：

```ts
type Labeled = [x: i32, y: i32];
type Unlabeled = [i32, i32];
// Labeled 与 Unlabeled 是同一个规范类型
```

标签不会成为运行时属性，以下写法编译错误：

```ts
function readPoint(point: [x: i32, y: i32]): void {
  point.x; // 编译错误
}
```

空元组和单元素元组合法，但必须具有显式元组上下文：

```ts
const empty: [] = [];
const single: [i32] = [1];
```

## 创建与推导

无上下文数组字面量始终按 T05 和 T34 推导为普通数组，即使变量使用 `const`：

```ts
const values = [1, 2];
// i32[]
```

元组只能由明确的元组意图产生：

| 来源                         | 示例                                        |
| ---------------------------- | ------------------------------------------- |
| 显式类型注解                 | `const point: [i32, i32] = [1, 2]`          |
| 参数、返回值或赋值目标上下文 | `return [1, 2]`，返回类型为 `[i32, i32]`    |
| `as const`                   | `[1, 2] as const`，产生 readonly 字面量元组 |
| 泛型 tuple rest 上下文       | 由 T37 的泛型推导规则确定                   |

`const` 只限制变量重新绑定，不自动产生 readonly 数组或元组。`as const` 的完整递归只读与字面量保留规则由 T40 定义；T35 只要求其数组结果使用 readonly 元组类别：

```ts
const fixed = [1, 2] as const;
// readonly [1, 2]
```

上下文元组按位置检查字面量。数值字面量可以直接采用对应位置的原生数值类型，不构成隐式数值转换：

```ts
const pair: [i64, f32] = [1, 2.5];
```

## 字面量长度与空位

固定元组字面量必须精确匹配声明长度：

```ts
const valid: [i32, string] = [1, "x"];
const missing: [i32, string] = [1]; // 编译错误
const extra: [i32, string] = [1, "x", 2]; // 编译错误
```

元组字面量禁止空位：

```ts
const sparse: [i32, string] = [1, ,]; // 编译错误
```

空位解构只表示跳过读取，不创建或要求元组空洞：

```ts
const [, value] = valid;
// value: string
```

## 可选元素

可选元素使用 TypeScript 语法，并遵守 TypeScript 对可选位置顺序的语法约束：

```ts
type Result = [value: string, error?: Error];
```

可选元素自动包含 `undefined`。上述类型规范化为以下固定元组联合：

```ts
[string] | [string, Error | undefined];
```

因此以下值均合法，并保持不同的 JavaScript 可观察长度：

```ts
const success: Result = ["ok"];
const explicit: Result = ["ok", undefined];

function createFailure(error: Error): Result {
  return ["failed", error];
}

success.length; // 1
explicit.length; // 2
```

省略位置与显式存储 `undefined` 在 `length`、`Object.keys`、遍历和字符串转换中保持区别。checker 不能把 `[value, undefined]` 隐式裁剪为 `[value]`。

可选元组的 `length` 类型是所有合法固定长度组成的数值字面量联合：

```ts
function resultLength(result: [string, Error?]): 1 | 2 {
  return result.length;
}
```

长度检查可以收窄到对应固定元组成员：

```ts
if (result.length === 2) {
  const error = result[1];
  // Error | undefined
}
```

实例创建后不能通过索引写入补出缺失可选位置，也不能通过删除或长度写入移除已有可选位置。需要改变可选位置是否存在时，应创建新元组。

## Rest 元组

元组可以包含一个 TypeScript 允许位置上的 rest 区段：

```ts
type Arguments = [command: string, ...values: i32[]];
type Command = [...names: string[], options: Options];
type Wrapped = [prefix: boolean, ...names: string[], options: Options];
```

规则如下：

- 一个元组最多包含一个 rest 区段。
- 非泛型 rest 元素必须是数组类型。
- 可选、必选和 rest 元素的相对位置遵循 TypeScript 元组语法。
- 泛型 `[...T]`、`[...T, ...U]` 的约束、推导和有限实例化由 T37、T41 定义。
- rest 元组类型可以表示多个长度，但每个实际实例创建后长度固定。
- rest 区段中的已有元素可以按 rest 元素类型写入，不能增加或删除元素。

动态 spread 可以创建 rest 元组：

```ts
function createCommand(
  names: string[],
  options: Options,
): [...string[], Options] {
  return [...names, options];
}
```

rest 元组的用户可见索引类型保持 TypeScript 可表达的保守结果。Nxts 不通过额外的算术索引收窄扩大 TypeScript 的接受范围：

```ts
function readLast(command: [...string[], Options]) {
  const last = command[command.length - 1];
  // string | Options | undefined
}
```

编译器内部可以证明该地址属于固定后缀并直接读取对应槽位，但该证明只用于生成代码优化，不能让 TypeScript 会拒绝的后续源码在 Nxts 中通过。需要频繁访问固定后缀的数据结构优先使用显式嵌套：

```ts
type CommandData = [names: string[], options: Options];
```

## 长度

固定元组的 `length` 是对应 `i32` 数值字面量；可选元组是合法长度的字面量联合；包含 rest 的元组对用户暴露 `i32`，checker 内部可以记录最小长度和固定前后缀关系。

元组 `length` 始终只读，包括 mutable 元组：

```ts
const point: [i32, i32] = [1, 2];

point.length = 2; // 编译错误
point.length = 1; // 编译错误
```

rest 元组的运行时长度沿用 T34 的 `i32` 范围和最大值。创建结果超过最大长度时，在修改任何可观察状态前抛出 `RangeError`。

## 索引读取

固定位置的字面量索引返回该位置的精确类型：

```ts
const entry: [string, i32] = ["count", 1];

entry[0]; // string
entry[1]; // i32
```

静态已知越界索引编译错误，包括负索引：

```ts
entry[2]; // 编译错误
entry[-1]; // 编译错误
```

无法证明位置的动态 `i32` 索引返回所有可能位置类型的规范联合，并包含 `undefined`：

```ts
function readEntry(entry: [string, i32], index: i32) {
  const value = entry[index];
  // string | i32 | undefined
}
```

控制流证明 `0 <= index < tuple.length` 时移除越界产生的 `undefined`，但位置本身声明包含 `undefined` 时仍保留：

```ts
if (index >= 0 && index < entry.length) {
  const value = entry[index];
  // string | i32
}
```

optional 和 rest 元组按所有当前可能成员合并位置类型。静态长度收窄可以排除不存在对应位置的成员。

元组索引只接受 `i32` 和可规范化为有效索引的数值字符串字面量。其他数值类型必须通过 T12 显式转换；宽字符串不能索引元组。

## 索引写入

字面量位置写入按该位置类型检查：

```ts
let entry: [string, i32] = ["count", 1];

entry[0] = "total";
entry[1] = 2;
entry[1] = "2"; // 编译错误
```

动态索引写入值必须能被每个可能目标位置以相同、无操作且布局安全的方式接受：

```ts
function writeAt(entry: [string, i32], point: [i32, i32], index: i32): void {
  entry[index] = 1; // 编译错误：index 也可能是位置 0
  point[index] = 3; // 类型允许
}
```

静态越界写入编译错误。动态索引写入的类型规则不允许增加长度或创建空洞；实际越界失败见 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md)。

## 可变性与 Readonly

mutable 元组允许修改已有位置：

```ts
let point: [i32, i32] = [1, 2];
point[0] = 3;
```

mutable 元组可以零复制形成相同布局的 readonly 视图：

```ts
const view: readonly [i32, i32] = point;

view[0] = 3; // 编译错误
point[0] = 3; // 合法，view 可以观察到
```

`readonly` 是浅层静态写权限，不冻结底层元组。其他 mutable 别名的写入仍然可见。

兼容规则：

| 转换                         | 规则                                       |
| ---------------------------- | ------------------------------------------ |
| mutable 到相同 readonly 元组 | 零成本允许。                               |
| readonly 到 mutable 元组     | 拒绝。                                     |
| mutable 元组之间             | 长度形状和每个可写位置的规范类型必须相同。 |
| readonly 元组之间            | 允许逐位置零成本协变，但机器布局必须相同。 |

元组不支持 `Object.freeze`、`Object.seal` 或 `Object.preventExtensions`。这些 API 不能替代静态 readonly。

## 元组之间的兼容

标签不参与兼容。源元组的每一种可能长度和位置都必须被目标类型接受：

```ts
const full: [i32, string] = [1, "x"];
const optional: readonly [i32, string?] = full; // 合法

function requireFull(maybe: [i32, string?]): void {
  const required: readonly [i32, string] = maybe; // 编译错误
}
```

固定、可选和 rest 元组兼容使用统一形状规则：

1. 源的每个合法运行时长度必须属于目标长度集合。
2. 该长度下的每个源位置必须零成本兼容对应目标位置。
3. mutable 目标还必须保证目标可能执行的每次写入对源布局安全。
4. rest 区段必须检查固定前后缀和动态区的全部重叠位置。
5. 兼容不能插入装箱、接口打包、字段重排、逐元素检查或复制。

复杂兼容检查使用规范形状图和记忆化，不展开无限 rest 或递归元组。

## 与数组兼容

元组具有数组身份，但不因此自动获得所有数组赋值兼容。

同构元组可以零复制形成相同元素布局的 readonly 数组视图：

```ts
const point: [i32, i32] = [1, 2];
const values: readonly i32[] = point;
```

该转换要求所有实际位置使用相同规范元素类型和连续机器布局。以下转换拒绝：

| 转换                                       | 拒绝原因                                        |
| ------------------------------------------ | ----------------------------------------------- |
| 元组到 mutable 数组                        | 目标可以通过长度修改方法破坏元组不变量。        |
| 异构元组到联合元素数组                     | 需要联合注入、字段重排或复制。                  |
| 数组到元组                                 | 长度、位置类型和其他 mutable 别名无法静态保证。 |
| 需要接口打包或数值转换的 readonly 数组视图 | 不是无操作兼容。                                |

异构元组通过 spread 显式创建普通数组：

```ts
const entry: [string, i32] = ["count", 1];
const values: (string | i32)[] = [...entry];
```

spread 语义上创建新的浅拷贝数组。优化器证明新身份、别名和写入均不可观察时可以消除复制，但类型系统不能把该优化当成隐式兼容。

## 数组方法

元组只获得 [`2-array.md`](../../stdlib/2-array.md) 明确开放的数组 API。改变长度的方法不可用；保持长度的原地方法必须对每个可能受影响位置类型安全；创建结果容器的方法默认返回普通数组。类型系统不建立第二套元组方法集合。

## 解构

元组解构按位置提供精确类型：

```ts
const entry: [string, i32] = ["count", 1];
const [key, value] = entry;
// key: string
// value: i32
```

可选元素读取包含 `undefined`，默认值按 JavaScript 规则惰性求值并移除对应空值分支：

```ts
function unpack(result: [string, Error?], defaultError: Error): void {
  const [value, error] = result;
  // error: Error | undefined

  const [value2, error2 = defaultError] = result;
  // error2: Error
}
```

固定元组的 rest 解构保留剩余位置的精确元组类型：

```ts
const tuple: [string, i32, boolean] = ["x", 1, true];
const [first, ...rest] = tuple;
// rest: [i32, boolean]
```

rest 解构的静态结果保留剩余固定位置。新身份、默认值求值和运行时 rest 位置规则见 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md) 与 [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)。

静态解构超过固定元组最大长度编译错误；可选或 rest 元组按所有可能长度合并结果类型。

## Spread

固定元组 spread 可以在元组上下文中保留位置：

```ts
const pair: [i32, i32] = [1, 2];
const triple: [i32, i32, i32] = [...pair, 3];
```

长度未知的普通数组不能展开到没有 rest 的固定元组：

```ts
function invalidSpread(values: i32[]): void {
  const invalid: [i32, i32] = [...values]; // 编译错误
}
```

动态数组可以展开到类型兼容的 rest 区段。多个 spread 的类型检查由 T52 定义；求值、迭代和失败顺序见 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md)。

元组 spread 到普通数组产生普通数组；spread 到显式元组上下文按目标位置重新检查，不隐式转换已有元素表示。

## 函数参数与调用

函数 rest 参数可以使用元组类型：

```ts
function write(...args: [name: string, count: i32]) {
  const [name, count] = args;
}

const args: [string, i32] = ["items", 2];
write(...args);
```

固定元组展开执行精确参数数量和位置类型检查，不形成动态参数类型。tuple rest 的物化语义见 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md)，具体调用约定见 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)。

## 遍历与枚举

元组遍历的元素静态类型为全部实际位置类型的规范联合，不因越界加入 `undefined`。optional 和 rest 元组按当前可能成员合并元素类型：

```ts
const entry: [string, i32] = ["count", 1];

entry.keys(); // Iterator<i32>
entry.values(); // Iterator<string | i32>
entry.entries(); // Iterator<[i32, string | i32]>
```

具体迭代顺序、遍历中写入、`for...in` 拒绝和 `Object.*` 枚举结果由 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md) 定义。

## 引用、比较与字符串转换

元组类型是引用类型，静态兼容不会裁剪、复制或改变身份。别名、严格相等、字符串转换和动态属性边界由 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md) 定义。

## 递归元组

元组是 T31 定义的运行时引用间接层：

```ts
type Chain = [value: i32, next: Chain | null];
```

元组槽位保存另一个元组对象引用，不以内联方式无限展开。直接递归、互相递归和没有空值终点但具有有限引用布局的元组类型均按 T31 检查。

递归类型合法不代表允许读取未初始化引用。创建循环仍必须满足确定赋值、TDZ 和写入类型规则。

递归元组的有限布局见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，循环回收见 [`1-gcTypeDescriptors.md`](../../runtime/gc/1-gcTypeDescriptors.md)。

## 运行时逻辑表示

元组值必须是固定大小管理引用，同构 readonly 数组视图不得复制，固定位置不得逐元素装箱。固定、optional、rest、递归元组和动态异构索引的唯一物理布局来源是 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)。

## GC 与写屏障

元组必须生成精确位置与 rest 区段扫描描述，原生标量位置不执行引用写屏障。完整扫描和循环回收规则见 [`1-gcTypeDescriptors.md`](../../runtime/gc/1-gcTypeDescriptors.md)。

## 跨模块 ABI

导出元组必须保留标签以外的规范位置类型、写权限和完整形状，且不能隐式复制 payload 适配模块差异。指纹与调用约定由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义。

## 编译器职责

| 阶段                       | 唯一职责来源                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------- |
| 语法接受与标签保留         | [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)                                 |
| 形状规范化、关系缓存与预算 | [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)   |
| Checked HIR 与物化事实     | [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)                           |
| 机器布局                   | [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md) |
| GC 描述                    | [`1-gcTypeDescriptors.md`](../../runtime/gc/1-gcTypeDescriptors.md)                |
| 优化与 lowering            | [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md)      |
| 跨模块 ABI                 | [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)                                  |

## 复杂度与资源边界

固定元组不设置 `1024` 等较小语言级成员数量上限，也不能在预算耗尽时退化为数组、`unknown` 或动态表示。规范形状图、记忆化和确定性预算由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义。

## 性能验收

元组最终性能目标以等价 Go 小结构和固定数组为参考；第一版可接受约 50% 吞吐，但不得引入统一装箱、动态元素表或强制堆分配。完整基准与诊断范围见 [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md)。

## 与 TypeScript / JavaScript 的差异

Nxts 保持 TypeScript 元组语法和 JavaScript 数组身份，但静态规则更严格：

| 主题                  | TypeScript / JavaScript                      | Nxts                               |
| --------------------- | -------------------------------------------- | ---------------------------------- |
| 裸 `const` 数组字面量 | 通常推导为数组                               | 同样推导为数组。                   |
| 标签、optional、rest  | 支持                                         | 保持相同语法。                     |
| `as const`            | 产生 readonly 字面量元组                     | 保持相同方向，完整规则归 T40。     |
| 长度修改              | mutable tuple 仍可能调用数组修改方法         | 所有元组实例创建后长度不可变。     |
| 位置写入              | mutable tuple 可以写入                       | 仅允许已有位置的类型安全写入。     |
| 动态索引              | 返回已知元素联合，配置可额外加入 `undefined` | 未证明边界时始终包含 `undefined`。 |
| rest 尾部算术索引     | 不保证推导固定尾部类型                       | 不提供更宽松的公开推导。           |
| 元组到 mutable 数组   | 常可按元素联合兼容                           | 拒绝，避免获得长度写权限。         |
| 异构元组到联合数组    | 常可结构兼容                                 | 需要显式 spread 创建数组。         |
| 运行时布局            | JavaScript 动态数组                          | 编译期固定位置或 rest 分区布局。   |

这些差异只缩小 Nxts 的接受范围。除 Nxts 原生类型需要工具链声明外，通过 Nxts checker 的元组源码也必须能被 TypeScript 解析和类型检查；内部优化事实不能产生 TypeScript 无法验证的额外源码能力。

## 失败行为

字面量长度或空位错误、静态越界、不兼容位置写入、`length` 写入以及不安全的数组原地方法均为编译错误。动态越界与长度上限的用户可观察失败由 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md) 定义；布局指纹不一致由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 处理。静态接受结果不能因 Debug、Release 或优化级别不同而变化。

## 诊断与测试矩阵

类型检查至少覆盖：

| 场景                                   | 预期                                         |
| -------------------------------------- | -------------------------------------------- |
| `const value = [1, 2]`                 | `i32[]`，不是元组。                          |
| `const value: [i32, i32] = [1, 2]`     | mutable 固定元组。                           |
| `[1, 2] as const`                      | readonly 字面量元组。                        |
| 显式 `[]` 元组上下文                   | 合法空元组。                                 |
| 元组字面量缺少、增加或空洞位置         | 编译错误。                                   |
| `[string, Error?]`                     | `[string] \| [string, Error \| undefined]`。 |
| `[value, undefined]` 对可选位置        | 合法且保留实际长度。                         |
| 一个合法 rest 区段                     | 接受。                                       |
| 多个 rest 或非法 optional/rest 顺序    | 编译错误。                                   |
| 字面量有效索引                         | 得到精确位置类型。                           |
| 字面量越界索引                         | 编译错误。                                   |
| 未证明的动态索引                       | 全部位置联合并包含 `undefined`。             |
| `tuple[length - 1]` 访问 rest 固定后缀 | 保持 TypeScript 可表达的保守联合。           |
| 动态异构写入                           | 值不能被全部可能位置接受时编译错误。         |
| mutable 到 readonly 元组               | 零复制允许。                                 |
| readonly 到 mutable 元组               | 编译错误。                                   |
| 同构元组到 readonly 数组               | 零复制允许。                                 |
| 元组到 mutable 数组                    | 编译错误。                                   |
| 异构元组 spread 到联合数组             | 创建浅拷贝数组。                             |
| 元组 `push/pop/splice`                 | 编译错误。                                   |
| 同构元组 `reverse/sort`                | 允许。                                       |
| 异构元组不安全重排                     | 编译错误。                                   |
| 固定元组 rest 解构                     | 得到剩余位置的精确元组类型。                 |

身份、optional 存在性、动态失败和枚举行为由 [`14-tupleSemantics.md`](../semantics/14-tupleSemantics.md) 验证；布局、GC、ABI 和生成代码分别由 T45–T47 及 [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md) 验证。

## 依赖关系

| 规范          | T35 使用或提供的边界                                       |
| ------------- | ---------------------------------------------------------- |
| T01–T06       | 元组类别、规范身份、兼容、上下文推导和边界收窄。           |
| T08、T12      | `i32` 长度与索引、数值字面量上下文和显式转换。             |
| T14、T20、T23 | `undefined`、字面量位置、optional 长度和联合表示。         |
| T31           | 元组是递归引用间接层，递归图和复杂度预算复用公共规则。     |
| T32–T34       | 函数 rest、参数 ABI、数组身份、方法、遍历和字符串转换。    |
| T37–T41       | 泛型 variadic tuple、类型运算、`as const` 和高级类型工具。 |
| T45–T49       | 精确布局、GC、ABI、原生内存与标准库辅助函数。              |
| T51–T61       | 索引、赋值、spread、调用、循环、副作用、迭代和异常。       |
