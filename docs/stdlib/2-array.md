# 数组标准库

- 来源能力：T34
- 规范状态：部分定稿
- 文档顺序：2

## 目标与边界

本规范是数组构造器、实例方法、静态方法和性能专用数组 API 的唯一权威来源。T34 已确定的方法行为和类型约束保持定稿；`std/array` 的最终模块路径、公开名称和 intrinsic 身份由 T49 定稿。

数组类型规则见[数组类型](../language/types/21-arrayTypes.md)，数组值的长度、索引和遍历行为见[数组语义](../language/semantics/6-arraySemantics.md)，分配与扩容实现见[数组运行时](../runtime/objects/2-arrayRuntime.md)。

## 构造与复制

支持以下创建形式：

```ts
const literal = [1, 2, 3];
const empty = new Array<i32>();
const values = Array.of(1, 2, 3);
const copy = Array.from(source);
```

`new Array<T>()` 只允许零参数。以下形式编译错误：

```ts
new Array(10); // 禁止按长度创建空洞
Array(10); // Array 不是可调用构造器
new Array(1, 2, 3); // 使用字面量或 Array.of
```

按长度创建数组必须同时提供初始化规则：

```ts
import { generate, repeat } from "std/array";

const zeros = repeat(0, count);
const indexes = generate(count, (index) => index);
```

`repeat(value, count)` 重复同一个值；引用值不会被克隆。`generate` 按索引升序调用生成器。已知长度的创建必须一次分配，不得通过反复增长实现。

以下操作创建新数组身份并执行浅拷贝：

- 数组 spread。
- `slice`、`concat`、`map`、`filter` 和 `flat`。
- `Array.from`。
- 解构 rest。

对象元素只复制引用。编译器证明新身份、别名和写入均不可观察时，可以消除复制或转移缓冲区，但语言语义仍是新数组。

## `Array.isArray`

`Array.isArray(value)` 对 Nxts 普通数组、只读数组和元组返回 `true`，对数字索引普通对象、字典和其他值返回 `false`。该检查不扫描元素、不调用用户代码，也不依赖可修改原型。

静态收窄结果由[数组类型](../language/types/21-arrayTypes.md)定义。输入已经是数组或元组时可以常量折叠；输入为 `unknown` 时只证明数组运行时类别，不证明具体元素布局。

## `Array.from`

`Array.from(source, mapper?)` 支持：

| 输入                      | 结果                                            |
| ------------------------- | ----------------------------------------------- |
| 数组、只读数组和元组      | 对元素执行浅拷贝。                              |
| 字符串                    | 按 T60 的 Unicode 字符迭代规则产生 `string[]`。 |
| 静态 `Iterable<T>`        | 按迭代顺序收集。                                |
| 索引完整的 `ArrayLike<T>` | 按 `0..length` 读取。                           |

可选 mapper 直接写入结果数组，不创建中间数组。已知长度时一次分配；未知长度迭代器使用几何扩容。mapper 不支持 `thisArg`，也不得结构性修改正在读取的源数组。

不支持数组子类、`Symbol.species` 或 `Array.fromAsync`。

## 性能专用 API

容量提示 API：

```ts
import { reserve, withCapacity } from "std/array";

const output = withCapacity<i32>(expected);
reserve(output, additional);
```

`withCapacity` 返回长度为零的数组；`reserve` 不改变长度、元素或身份。这些 API 只影响分配策略，不参与程序正确性。编译器能够推导容量时必须自动预分配。

其他候选 API：

| API                               | 契约                                |
| --------------------------------- | ----------------------------------- |
| `generate(count, mapper)`         | 按索引创建已初始化的稠密数组。      |
| `repeat(value, count)`            | 重复同一个值或引用。                |
| `isArrayOf<T>(value)`             | O(1) 检查精确元素布局，不扫描元素。 |
| `sortUnstable(array, compareFn?)` | 不保证稳定性的原地排序。            |

这些能力不添加到 `Array` 或数组实例上。最终模块路径与名称由 T49 确定。

## 标准数组 API

当前数组 API 以 ES2020 为版本上限，但不是 ES2020 全量实现。

| 分类     | 支持的方法                                                                 |
| -------- | -------------------------------------------------------------------------- |
| 静态     | `Array.isArray`、`Array.from`、`Array.of`                                  |
| 查询     | `includes`、`indexOf`、`lastIndexOf`、`find`、`findIndex`、`some`、`every` |
| 转换     | `map`、`filter`、`reduce`、`reduceRight`、`flat`、`flatMap`                |
| 复制组合 | `concat`、`slice`                                                          |
| 原地修改 | `push`、`pop`、`shift`、`unshift`、`splice`、`reverse`、`sort`、`fill`     |
| 遍历     | `forEach`、`keys`、`values`、`entries`                                     |
| 字符串   | `join`、`toString`                                                         |

明确排除：

| 能力                                                                             | 原因或替代                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| `copyWithin`、`toLocaleString`                                                   | 当前标准库范围不提供。                         |
| `at`、`findLast`、`findLastIndex`、`with`、`toSorted`、`toReversed`、`toSpliced` | 超出 ES2020 API 上限。                         |
| `Symbol.iterator`、`Symbol.species`                                              | T60 使用静态迭代能力，不开放动态 Symbol 协议。 |
| callback `thisArg`                                                               | 使用箭头函数捕获上下文。                       |
| `Array.prototype.method.call(...)`                                               | 不提供 `call/apply/bind` 或泛型原型借用。      |
| 数组子类和动态原型替换                                                           | 保持静态方法解析和固定数组布局。               |

## 迭代方法

| 方法        | 返回迭代器元素 |
| ----------- | -------------- |
| `keys()`    | `i32`          |
| `values()`  | `T`            |
| `entries()` | `[i32, T]`     |

返回的静态 `ArrayIterator<T>` 由 T60 定义，不要求公开 `Symbol.iterator`。用于 `for...of` 时可以消除迭代器对象和 entry 元组分配；手动保存迭代器并调用 `next()` 时才物化状态对象。

## 元组上的数组 API

元组复用数组 API 名称和求值顺序，但方法必须保持实例长度和固定位置类型：

| 方法类别                                              | 元组规则                                         |
| ----------------------------------------------------- | ------------------------------------------------ |
| 查询、遍历与字符串方法                                | 可以调用，元素类型为实际位置类型的规范联合。     |
| `map`、`filter`、`slice`、`concat`、`flat`、`flatMap` | 默认返回普通数组，不自动保留元组类型。           |
| `push`、`pop`、`shift`、`unshift`、`splice`           | 编译错误，因为会改变长度。                       |
| `reverse`、`sort`、`fill`                             | 仅在每个可能受影响位置都接受该写入或重排时允许。 |
| readonly 元组上的原地方法                             | 全部编译错误。                                   |

例如，同构 `[i32, i32]` 可以 `reverse` 或 `sort`；异构 `[string, i32]` 不能反转，也不能对动态范围执行 `fill(0)`。`fill(0, 1, 2)` 只修改已知 `i32` 位置，因此合法。

动态范围的方法必须对所有可能位置安全。显式元组上下文可以重新检查已知长度的方法结果，但标准库本身不承诺返回元组。

元组 `join` 与 `toString` 只读取当前实际位置，并复用本规范的数组字符串规则；省略的 optional 尾部位置不产生片段。

## 可变操作

| 操作                              | 结果与边界                                        |
| --------------------------------- | ------------------------------------------------- |
| `push(...items)`                  | 追加兼容元素，返回新 `length: i32`。              |
| `pop()`                           | 删除尾元素，空数组返回 `undefined`。              |
| `unshift(...items)`               | 在头部插入，返回新长度，复杂度 O(n)。             |
| `shift()`                         | 删除头元素，空数组返回 `undefined`，复杂度 O(n)。 |
| `splice(start, count?, ...items)` | 返回被删除元素的新数组，保持稠密。                |
| `reverse()`                       | 原地反转并返回同一数组。                          |
| `sort(compareFn?)`                | 原地稳定排序并返回同一数组。                      |
| `fill(value, start?, end?)`       | 原地填充并返回同一数组。                          |

`splice(start)` 删除到末尾；显式 `splice(start, undefined)` 按 JavaScript 行为删除零项。起止位置和删除数量按支持的负值与范围执行 JavaScript 式截取和 clamp，但参数类型保持 `i32`。

`push`、`unshift` 或 `splice` 产生的新长度超过 `2^31-1` 时抛出 `RangeError`，并在修改数组前失败。元素类型错误和只读写入在编译期拒绝。

不支持 `copyWithin`。ES2020 之后的 `with`、`toSorted`、`toReversed` 和 `toSpliced` 不在当前 API 范围内。

## 查询与比较

- `includes` 使用 SameValueZero，`NaN` 可以匹配自身，`+0` 与 `-0` 相等。
- `indexOf` 和 `lastIndexOf` 使用严格相等，不能找到 `NaN`。
- 对象和数组元素按引用身份比较。
- `find` 返回 `T | undefined`。
- `findIndex`、`indexOf` 和 `lastIndexOf` 返回 `i32`，未找到时为 `-1`。

这些方法不创建临时数组。原生标量数组可以使用内联、向量化和专用搜索实现。

## 排序

`sort(compareFn?)` 是稳定原地排序。没有比较器时，按 JavaScript 字符串顺序比较所有具有 T13 字符串转换的元素：

```ts
[10, 2].sort(); // [10, 2]
```

编译器可以直接比较原生数值的规范文本顺序，不要求为每次比较分配临时字符串。元素类型没有受支持字符串转换时必须提供比较器。

比较器可以返回受支持的有符号整数、`f32`、`f64` 或 `number`；负数、零、正数分别表示小于、相等和大于，浮点 `NaN` 按 JavaScript 排序规则视为零。

比较器抛出异常时立即传播，数组可以处于部分重排状态。事务式回滚不属于 `sort` 语义。

## 复制、组合与展开

`slice(start?, end?)` 支持负位置并返回浅拷贝。`concat` 只展开真正的数组一层，不支持 `Symbol.isConcatSpreadable`。

`T[].concat(...)` 只接受能够进入 `T` 布局的元素或数组，结果仍为 `T[]`。数组 spread 可以通过 T04 推导公共类型或规范联合：

```ts
const values = [...numbers, ...strings];
// (number | string)[]
```

编译器能够确定各输入长度时，应预先计算总长度并一次分配；布局相同的连续区域使用批量复制，不得通过反复 `push` 实现。

## `flat` 与 `flatMap`

`flat(depth = 1)` 和 `flatMap(mapper)` 保持 JavaScript 的浅拷贝与一层 mapper 展开语义。深度使用非负或按 JavaScript 归一化的有限 `i32` 值，不接受 `Infinity`。

字面量深度产生精确结果类型：

```ts
const matrix: i32[][] = [[1], [2]];
matrix.flat(); // i32[]
matrix.flat(0); // i32[][]
```

动态深度产生所有可能层级的规范元素联合：

```ts
function flatten(nested: i32[][][], depth: i32) {
  const values = nested.flat(depth);
  // (i32 | i32[] | i32[][])[]
}
```

结果类型规范化必须服从递归类型和类型工作预算。`flatMap` 不创建中间 `map` 数组；已知 mapper 可以内联。固定输入层级的 `flat` 可以预计算输出长度并一次分配。

## 回调型方法

数组回调按索引升序执行：

```ts
(value: T, index: i32, array: T[]) => result;
```

可变数组向回调提供 `T[]`，只读数组提供 `readonly T[]`。数组回调不支持 `thisArg`；需要上下文时使用箭头函数捕获。

| 方法                    | 结果规则                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| `map`                   | 回调真实结果类型为 `U`，返回 `U[]`。                                 |
| `filter`                | 对回调结果执行 T07 truthiness，返回保留元素的新数组。                |
| `find`、`some`、`every` | 对回调结果执行 truthiness，并按 JavaScript 规则短路。                |
| `forEach`               | 按回调真实 ABI 调用后丢弃结果，不建立 `() => T -> () => void` 兼容。 |
| `reduce`、`reduceRight` | 回调结果必须兼容累加器类型。                                         |

`reduce` 有初始值时由初始值和回调共同确定累加器；无初始值时累加器与结果为 `T`。空数组无初始值时抛出 `TypeError`。

异步回调保持 JavaScript 行为：

```ts
items.map(async (item) => load(item));
// Promise<Result>[]

items.filter(async (item) => check(item));
// Promise 为 truthy

items.forEach(async (item) => save(item));
// 返回的 Promise 被忽略
```

编译器应对判断型方法的 async 回调、async `forEach` 和 `await arrayOfPromises` 给出高置信度诊断，但不能把兼容行为改成类型错误。Promise 的失败传播与未处理 rejection 由 T59 定义。

## 回调副作用

回调型数组方法禁止结构性修改正在遍历的同一个数组：

```ts
values.map((value) => {
  values.push(value); // 编译错误
  return value;
});
```

禁止的副作用包括：

- `push`、`pop`、`shift`、`unshift` 和 `splice`。
- 修改 `length`。
- 可能替换底层缓冲区的容量操作。

修改已有元素、`fill`、`reverse` 或 `sort` 可以保留 JavaScript 的顺序可观察行为，但会使元素内容收窄失效，并阻止不安全的向量化、缓存或循环融合。

T58 必须静态推导直接回调、捕获别名和跨模块函数的副作用摘要。无法证明不发生结构修改的回调不能进入这些方法。实现不得为此给数组增加版本字段、迭代锁或运行时修改检查。

## 方法接收者

数组方法复用 T32 的静态接收者模型。直接成员调用不创建绑定函数：

```ts
values.push(1);
```

提取方法不会自动绑定原数组，裸调用编译错误：

```ts
const push = values.push;
push(1); // 编译错误：缺少接收者
```

需要绑定行为时使用箭头函数。编译器可以内联不逃逸箭头函数并消除闭包。数组方法不能被覆盖、替换或作为动态属性写入。

## 字符串转换

`join(separator = ",")` 返回 `string`；`toString()` 等价于 `join(",")`。`null` 和 `undefined` 元素产生空片段，嵌套数组递归使用同一规则。

元素类型的所有联合成员必须具有 T13 定义的静态字符串转换。数组不使用 `Symbol.toPrimitive`、`valueOf` 或动态原型方法。

递归数组的 `join` / `toString` 遇到当前正在转换的循环数组时产生空片段，避免无限递归。静态类型不递归时，编译器应省略循环保护。

原生元素数组使用专用字符串构建器，不创建中间数组；生成最终字符串所需的分配与内容复制仍然可观察。

## 失败行为

| 场景                    | 结果                         |
| ----------------------- | ---------------------------- |
| 空数组 `pop` / `shift`  | 返回 `undefined`。           |
| 空数组无初始值 `reduce` | `TypeError`。                |
| 方法增长超过最大长度    | `RangeError`，数组保持原值。 |
| 回调或比较器抛异常      | 立即传播。                   |

内存分配失败由 T46 统一定义。静态诊断不得依赖优化级别改变程序接受结果。

## API 测试

| 场景                    | 预期                                     |
| ----------------------- | ---------------------------------------- |
| 数组别名执行 `push`     | 原数组观察到新增元素。                   |
| `reverse()`             | 返回同一数组身份。                       |
| `slice()`               | 返回不同数组身份并浅拷贝。               |
| async `filter`          | Promise 按 truthiness 处理，并产生诊断。 |
| 回调内结构修改同一数组  | 编译错误。                               |
| 空数组 `pop` / `shift`  | 返回 `undefined`。                       |
| 空数组无初始值 `reduce` | 抛出 `TypeError`。                       |

## T49 待确认项

- `std/array` 是否作为最终模块路径。
- `repeat`、`generate`、`reserve`、`withCapacity`、`isArrayOf` 和 `sortUnstable` 的最终公开名称。
- 数组 API 的声明载体和 intrinsic 身份编码。
