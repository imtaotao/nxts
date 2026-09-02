# 控制流类型分析

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-26
- 文档顺序：6

## 目标

定义 Nxts checker 如何根据控制流判断可达性、变量赋值状态、类型收窄、分支合并和穷尽性。

类型分类见 [`1-typeClassification.md`](./1-typeClassification.md)，赋值兼容见 [`3-typeCompatibility.md`](./3-typeCompatibility.md)，类型格与公共上界见 [`4-typeLattice.md`](./4-typeLattice.md)，类型推导见 [`5-typeInference.md`](./5-typeInference.md)。T06 假定名称、作用域和声明绑定已经完成；局部绑定、导入符号和类型引用解析由 T57 定义。

## 核心原则

控制流分析只使用源码中明确表达的控制流和已支持的类型判断。checker 不根据复杂表达式语义、用户函数副作用或运行时概率猜测类型。

收窄必须保持静态安全，不引入运行时转换、隐藏分配、对象裁剪或隐式动态值。无法证明的路径保持原类型，或产生诊断。显式 `unknown` 值可以检查已有动态标签，但收窄本身不能创建动态表示。

控制流分析结果只影响静态类型和诊断，不改变运行时值表示。

## 术语

| 术语     | 含义                                           |
| -------- | ---------------------------------------------- |
| 可达性   | 某个程序点是否可能被正常执行到。               |
| 赋值状态 | 局部变量在某个程序点是否已经被确定赋值。       |
| 收窄     | 在某条控制流路径上将变量类型缩小为更具体类型。 |
| 反向收窄 | 在条件为假分支中排除条件为真时的类型。         |
| 分支合并 | 多条控制流汇合后合并变量类型和赋值状态。       |
| 穷尽检查 | 判断联合类型所有成员是否已经被覆盖。           |

## 可达性

- 小节结论：已定

以下语句之后的同一顺序路径不可达：

- `return`。
- `throw`。
- 已证明不会正常结束的调用，例如返回 `never` 的函数调用。
- 已证明无限循环且没有可达 `break` 的循环。

```ts
function fail(message: string): never {
  throw new Error(message);
}

function read(flag: boolean): string {
  if (!flag) {
    fail('missing');
  }

  return 'ready';
}
```

静态类型本身为 `never` 的表达式没有正常控制流后继，并在类型格合并中按 T04 规则被其他可达类型吸收。

```ts
const value = flag ? fail('missing') : 'ready';
// value: "ready"
```

外层表达式的静态类型与正常完成状态分别计算。必经子表达式为 `never` 时，当前求值路径终止，但外层调用、运算或构造表达式仍保留其自身类型规则确定的静态类型。短路运算、条件表达式、可选链等未必求值的分支只终止实际进入该分支的路径。

checker 根据上述语言控制流规则直接证明的顺序不可达语句或必经求值项属于编译错误。该判断可以传播源码中准确的 `never` 子表达式，但不得依赖优化级别、函数实现摘要、内联、常量传播或泛型单态化结果；穷尽检查中的显式 `default` / `assertNever` 防御分支不属于顺序终止后的代码。

## 赋值状态

- 小节结论：已定

局部变量在读取前必须已经被确定赋值。没有初始化表达式的 `let` 声明进入未赋值状态：

```ts
let value: string;
value.length; // 编译错误：读取前未赋值

value = 'ready';
value.length; // 合法
```

分支合并时，只有所有可达分支都已赋值，变量才被视为确定赋值：

```ts
let value: string;

if (flag) {
  value = 'ready';
}

value.length; // 编译错误：flag 为 false 时未赋值
```

T06 采用保守赋值状态分析。只有当前控制流内、checker 能直接看到的赋值，才能证明变量已赋值。

`while` 和普通 `for` 循环体可能一次都不执行，因此循环体内赋值默认不能证明循环之后变量已赋值：

```ts
let value: string;

while (flag) {
  value = 'ready';
}

value.length; // 编译错误：循环可能未执行
```

`do while` 循环体至少执行一次，可以让循环体内所有可达路径上的赋值参与循环后的赋值状态：

```ts
let value: string;

do {
  value = 'ready';
} while (flag);

value.length; // 合法
```

`break` 离开循环的路径必须参与循环后赋值状态合并；`continue` 回到循环头，参与循环固定点分析。具体循环固定点算法属于实现细节，但结果必须保守：不能把某条可达未赋值路径误判为已赋值。

闭包内部赋值不能证明外部读取前已赋值：

```ts
let value: string;

run(() => {
  value = 'ready';
});

value.length; // 编译错误：checker 不能证明回调已经执行
```

普通函数调用不被视为会给局部变量赋值，除非未来存在明确的语言能力表达该效果。闭包捕获、捕获写入、逃逸和函数调用副作用由 T58 定义。

`try`、`catch` 和 `finally` 的赋值状态采用保守合并。异常可能中断 `try` 内后续赋值；只有所有可达正常路径和异常处理路径都能证明赋值后，合并点才视为已赋值。完整同步异常控制流由 T61 细化。

## 空值收窄

- 小节结论：已定

`=== null`、`!== null`、`=== undefined` 和 `!== undefined` 可以收窄显式包含对应空值成员的联合类型。

T17 的显式 `unknown` 值也可以执行这些严格空值检查。命中分支收窄为 `null` 或 `undefined`，未命中分支仍为 `unknown`，因为开放动态值集合无法表示完整补集。

```ts
function read(value: string | undefined) {
  if (value !== undefined) {
    value.length; // value: string
  }
}
```

真分支保留被判断命中的成员，假分支排除该成员：

```ts
function read(value: string | null | undefined) {
  if (value === null) {
    value; // null
  } else {
    value; // string | undefined
  }
}
```

`null` 与 `undefined` 严格区分。`value !== null` 不会排除 `undefined`，`value !== undefined` 也不会排除 `null`。

严格空值比较的收窄规则如下：

| 判断                  | 真分支           | 假分支           |
| --------------------- | ---------------- | ---------------- |
| `value === null`      | `null`           | 排除 `null`      |
| `value !== null`      | 排除 `null`      | `null`           |
| `value === undefined` | `undefined`      | 排除 `undefined` |
| `value !== undefined` | 排除 `undefined` | `undefined`      |

Nxts 不支持 `==` 和 `!=`。checker 必须拒绝这两个运算符，不为其提供隐式转换或类型收窄规则。

`??` 的结果类型和求值语义由 T14 定义，可选链由 T14 与 T51 定义。

## Truthiness 收窄

- 小节结论：已定

Nxts 支持保守 truthiness 空值收窄。`if (value)`、`while (value)` 等 truthy 条件的真分支可以排除 `null` 和 `undefined` 成员：

```ts
function read(value: string | undefined) {
  if (value) {
    value.length; // value: string
  }
}
```

该规则只排除空值成员，不建模非空字符串、非零数字、非 `NaN` 数字或 `true` 字面量：

```ts
function read(value: string | undefined) {
  if (value) {
    value; // string，不区分非空 string
  } else {
    value; // string | undefined，空字符串也可能进入该分支
  }
}
```

假分支不执行激进收窄，除非未来有专门的字面量或值范围能力可以静态表达对应 falsy 值集合。

该规则不是 TypeScript truthiness 收窄的完整复刻；Nxts 当前不通过 truthiness 推导非空字符串、非零数值或其他值范围类型。

`unknown` 不允许直接用于 truthiness 条件或逻辑非。程序必须先通过 T17 允许的类型检查、严格空值检查、T44 的受信任类型检查或 T49 的 schema 解码得到确定的静态类型。

所有 `symbol` 值均为 truthy。对只包含 symbol 与空值的联合，真分支可以排除 `null`、`undefined`，假分支可以排除 symbol 成员；该规则不需要值范围分析。

## `typeof` 收窄

- 小节结论：已定

`typeof` 可以用于已支持 JavaScript 基础类型的收窄：

```ts
function read(value: string | number) {
  if (typeof value === 'string') {
    value.length; // value: string
  }
}
```

当前支持范围：

| 判断                           | 收窄目标    |
| ------------------------------ | ----------- |
| `typeof value === "string"`    | `string`    |
| `typeof value === "number"`    | `number`    |
| `typeof value === "boolean"`   | `boolean`   |
| `typeof value === "symbol"`    | `symbol`    |
| `typeof value === "undefined"` | `undefined` |

其他 `typeof` 结果当前不产生类型收窄：

| 判断                          | 当前处理                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `typeof value === "object"`   | 暂不收窄；`typeof null === "object"`、数组、普通对象和标准库对象边界后续定义。 |
| `typeof value === "function"` | 暂不收窄；函数类型、可调用对象和标准库 `Function` 边界后续定义。               |
| `typeof value === "bigint"`   | T19 不支持 `bigint`，该判断产生编译错误。                                      |

parser 可以接受合法 JavaScript `typeof` 表达式；checker 只对本小节明确支持的结果执行收窄。涉及当前不支持类型的判断应产生明确诊断或保持原类型，具体诊断策略由对应类型规范定义。

`unknown` 可以作为上述已支持 `typeof` 判断的来源。判断成立时收窄为目标基础类型；判断不成立时仍为 `unknown`。该检查读取既有动态标签，不执行表示转换或额外分配。

### `unique symbol` 身份收窄

具体 `unique symbol` token 的 `===`、`!==` 判断可以收窄有限 unique symbol 联合。相等分支保留对应 `typeof token`，不等分支排除该成员：

```ts
const Ready = Symbol('ready');
const Failed = Symbol('failed');

function read(value: typeof Ready | typeof Failed) {
  if (value === Ready) {
    value; // typeof Ready
  } else {
    value; // typeof Failed
  }
}
```

两个静态已知且不同的 `unique symbol` 直接比较产生编译错误。宽 `symbol` 与具体 token 可以执行普通运行时身份比较，但两个分支中的宽操作数都保持 `symbol`；比较不能恢复已经丢弃的声明身份。该规则与 TypeScript 一致。

## 分支合并

- 小节结论：已定

控制流分支汇合时，checker 使用 T04 的最小公共上界合并变量类型，并合并赋值状态。

```ts
let value: string | undefined = input;

if (value !== undefined) {
  value; // string
} else {
  value; // undefined
}

value; // string | undefined
```

不可达分支不参与合并：

```ts
let value: string | undefined = input;

if (value === undefined) {
  return;
}

value; // string
```

分支合并不能引入 `any`、`unknown`、对象裁剪、数值提升或隐藏运行时检查。

## 收窄稳定性边界

- 小节结论：已定

T06 只定义局部变量绑定级别的控制流收窄。变量重新赋值后，checker 按新的赋值更新该变量在当前控制流路径上的类型。

```ts
let value: string | undefined = input;

if (value !== undefined) {
  value; // string
  value = undefined;
  value; // undefined
}
```

对象属性收窄在属性写入、别名写入、函数调用和逃逸后的稳定性，由对象类型、可变性和后续别名分析规范定义。当前阶段 checker 对无法证明稳定的对象属性收窄应保守失效。

```ts
const alias = result;

if (result.kind === 'ok') {
  // alias 写入是否影响 result 的属性收窄，由对象和别名分析规则定义。
}
```

判别字段作为联合成员身份的一部分，不能通过属性写入改变对象所属成员；该规则见判别联合小节。

## 判别联合

- 小节结论：已定

判别联合通过对象成员中的稳定字面量字段区分联合成员。判别字段必须是所有相关对象成员中同名的静态属性，且其类型为互不冲突的字面量类型或字面量联合。

```ts
type Ok = {
  kind: 'ok';
  value: string;
};

type Err = {
  kind: 'err';
  message: string;
};

function read(result: Ok | Err) {
  if (result.kind === 'ok') {
    result.value; // result: Ok
  } else {
    result.message; // result: Err
  }
}
```

判别字段比较只支持静态属性访问和字面量比较：

```ts
result.kind === 'ok';
result.kind !== 'err';
```

Nxts 不通过动态 key、任意对象形状猜测或用户函数结果识别判别联合。

普通属性仍按对象类型的可写规则修改：

```ts
let result: Ok = {
  kind: 'ok',
  value: 'done',
};

result.value = 'updated'; // 合法
```

判别字段不能通过属性写入改变对象所属成员：

```ts
let result: Ok | Err = {
  kind: 'ok',
  value: 'done',
};

result.kind = 'err'; // 编译错误：不能通过修改判别字段改变联合成员
```

状态切换应通过重新赋值为另一个完整成员对象表达。变量重新赋值后，checker 按新的赋值更新当前控制流类型：

```ts
let result: Ok | Err = {
  kind: 'ok',
  value: 'done',
};

result = {
  kind: 'err',
  message: 'failed',
}; // 合法
```

如果需要一个内部状态字段可变的对象，应使用单一固定形状对象，而不是通过修改判别字段在不同对象形状之间切换：

```ts
type ResultState = {
  kind: 'ok' | 'err';
  value?: string;
  message?: string;
};

const state: ResultState = {
  kind: 'ok',
  value: 'done',
};

state.kind = 'err'; // 合法：这是普通固定形状对象的可写属性
```

## `instanceof` 收窄

- 小节结论：已定

`instanceof` 是类类型的运行时收窄能力。右侧可以是静态可解析类声明，也可以是静态类型已证明为 Nxts 类构造器的运行时值：

```ts
class Animal {}
class Dog extends Animal {
  bark() {}
}

function run(value: Animal) {
  if (value instanceof Dog) {
    value.bark(); // value: Dog
  }
}

function matches(value: unknown, Ctor: typeof Animal) {
  if (value instanceof Ctor) {
    value; // Animal
  }
}
```

对联合类型，真分支保留目标类及其派生类成员，假分支排除目标类及其派生类成员：

```ts
function read(value: Dog | Cat) {
  if (value instanceof Dog) {
    value; // Dog
  } else {
    value; // Cat
  }
}
```

`unknown` 也可以在右侧满足上述类构造器限制时执行 `instanceof`。判断成立时收窄为构造器静态类型对应的实例类型，判断不成立时仍为 `unknown`；可打包类引用和动态类型身份的运行时边界由 T17、T36 和 T47 定义。

`instanceof` 不用于普通对象 shape 检查，也不支持以下动态 JavaScript 能力参与收窄：

- 普通函数、普通对象或无法静态证明为类构造器的动态值。
- 自定义 `Symbol.hasInstance`。
- 动态修改原型链。
- `Object.create(nonNullPrototype)`、`Object.setPrototypeOf` 或 `__proto__` 产生的关系。

这些动态能力当前不属于 Nxts 普通对象和类模型。类构造器值、运行时类身份和 `instanceof` 行为由[类语义](../semantics/7-classSemantics.md)定义，跨模块类 ABI 由 T47 定义。

## 类型谓词

- 小节结论：已定

用户自定义类型谓词 `value is T` 当前不纳入第一阶段支持。parser 可以识别该语法并产生明确诊断，但 checker 不为其创建可继续通过的有效类型节点。

当前阶段不支持用户自定义类型谓词的原因：

| 原因                       | 影响                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| 谓词声明可能与函数体不一致 | checker 若直接信任声明，错误谓词会绕过真实运行时检查。                                         |
| 跨模块可信边界尚未定义     | 导入谓词函数时需要判断其声明、实现和版本是否仍然匹配，该边界依赖 T55 模块规则和 T47 类型 ABI。 |
| 泛型谓词复杂度高           | `value is Box<T>` 等形式需要泛型约束、方差和类型提取规则配合。                                 |
| 反向收窄不总是可靠         | 谓词返回 `false` 不一定能安全推出目标类型的补集。                                              |
| 容易绕过 Nxts 静态边界     | 用户谓词可能伪造对象形状、数值转换或写权限结论。                                               |

当前阶段由 checker 提供内置常用收窄能力：

- 空值严格比较。
- truthiness 空值收窄。
- 已支持范围内的 `typeof`。
- 判别联合。
- 静态类体系内的 `instanceof`。
- T44 标准库 intrinsic 提供的受信任运行时类型检查。

T44 的受信任类型检查可以对 `unknown` 或接口来源建立真分支事实。直接条件、否定条件后的提前退出和未被改写的局部 `const` 布尔别名可以传播该事实：

```ts
if (!isType<User>(input)) return;
input.name; // input: User

const valid = isType<User>(input);
if (valid) {
  input.name; // input: User
}
```

输入表达式只求值一次，成功分支复用已经提取的载荷或接口 witness。可变布尔变量、对象属性和跨函数返回值不携带证明；来源绑定重新赋值或可能被闭包改写后，旧事实失效。普通同名函数不能伪造 intrinsic 身份。

普通返回 `boolean` 的函数可以由 checker 自动证明并附加可信谓词摘要，无需用户声明 `value is T`：

```ts
function isString(value: i32 | string) {
  return typeof value === 'string';
}
```

checker 只能记录由函数体全部返回路径证明出的真分支事实；只有同样证明互补关系时才能记录假分支事实。摘要必须随函数体重新计算，跨模块只导出编译器生成的摘要和对应类型指纹，不能信任源码声明或手写元数据。无法证明时函数仍是普通 `boolean` 函数，不产生收窄，也不增加运行时检查。

数组 `filter`、`find` 等标准库签名可以消费该摘要并为新结果推导更窄元素类型。`every` 只建立当前数组元素读取事实，不能把联合元素数组重新解释为物理布局不同的数组类型；具体类型规则由 [`21-arrayTypes.md`](./21-arrayTypes.md) 定义，方法签名与 API 专属行为由[数组标准库](../../stdlib/2-array.md)定义。

未来如果支持用户自定义类型谓词，必须单独定义以下边界：

- 谓词函数体与声明是否需要一致性检查。
- checker 信任谓词结果的条件。
- 谓词函数跨模块导入和版本兼容，由 T55 模块规则和 T47 类型 ABI 提供边界。
- 泛型谓词、联合成员谓词和对象形状谓词的支持范围。
- 谓词失败路径的反向收窄规则。

用户自定义谓词不能成为绕过对象精确形状、数值显式转换、`readonly` 写权限或运行时收窄规则的后门。

## 循环中的收窄

- 小节结论：已定

循环内收窄只在当前迭代的当前控制流路径中有效。循环边界和循环结束后使用保守合并。

循环条件产生的收窄可以用于循环体入口：

```ts
let value: string | undefined = input;

while (value !== undefined) {
  value.length; // value: string
  value = next();
}

value; // string | undefined
```

循环体内对被收窄变量赋值后，该变量在后续路径上使用赋值表达式的新类型，旧收窄失效：

```ts
while (value !== undefined) {
  value; // string
  value = undefined;
  value; // undefined
}
```

循环结束后的类型由进入循环前类型、循环条件失败路径以及所有可达 `break` 出口共同合并：

```ts
while (value !== undefined) {
  if (done) {
    break;
  }

  value = next();
}

value; // string | undefined
```

采用保守合并的原因：

| 原因                                        | 影响                                     |
| ------------------------------------------- | ---------------------------------------- |
| `while` 和普通 `for` 循环体可能一次都不执行 | 循环体内收窄不能证明循环后状态。         |
| 循环体可能执行多次                          | 每次迭代都需要重新进入循环头分析。       |
| `break` 可从循环中间离开                    | 需要与条件失败路径和其他出口合并。       |
| `continue` 会回到循环头                     | 当前路径收窄不能直接带到循环后。         |
| 循环体内赋值会改变变量类型                  | 旧收窄必须失效。                         |
| 函数调用和闭包副作用难以静态证明            | checker 不根据执行时机或副作用猜测收窄。 |

未来如果需要更精细的循环固定点收窄，可以在控制流实现规范中扩展；扩展不得把可达未证明路径误判为已收窄。

## 穷尽检查

- 小节结论：已定

穷尽检查以 `never` 作为剩余类型为空的标记。第一阶段由显式 `never` 位置触发，不强制普通 `switch` 或 `if` 自动穷尽。

常用模式：

```ts
function assertNever(value: never): never {
  throw new Error('unreachable');
}
```

当 checker 能证明所有联合成员已经被覆盖时，剩余分支类型为 `never`。

```ts
type Result = { kind: 'ok'; value: string } | { kind: 'err'; message: string };

function read(result: Result): string {
  switch (result.kind) {
    case 'ok':
      return result.value;
    case 'err':
      return result.message;
    default:
      return assertNever(result); // result: never
  }
}
```

如果存在未覆盖成员，`default` 分支中的剩余类型不是 `never`，传给 `assertNever` 时产生编译错误：

```ts
function read(result: Result): string {
  switch (result.kind) {
    case 'ok':
      return result.value;
    default:
      return assertNever(result); // 编译错误：result 仍可能是 Err
  }
}
```

普通 `switch` 或 `if` 没有显式 `never` 位置时，不因为未覆盖全部联合成员直接报穷尽错误。其他规则仍然生效，例如显式返回类型要求所有可达路径返回值。

自动穷尽诊断、warning/error 等级和严格模式策略由后续工具链或诊断规范定义。

## 下游规范事项

本规范的控制流分析边界已经确定。以下内容由对应能力规范继续细化：

| 能力           | 下游规范职责                                                                          |
| -------------- | ------------------------------------------------------------------------------------- |
| 闭包与副作用   | 捕获变量、捕获写入、函数调用副作用和收窄失效规则由 T58 定义。                         |
| 异常处理       | `try`、`catch`、`finally` 的完整可达性和赋值状态合并由 T61 定义。                     |
| 类类型         | `instanceof` 的运行时身份、跨模块 ABI 和动态派发边界由类类型规范和 T47 定义。         |
| 联合类型       | 判别字段归一化、联合成员覆盖和 tag / payload 表示。                                   |
| 对象与别名分析 | 对象属性收窄在属性写入、别名写入、函数调用和逃逸后的稳定性由对象类型和 T58 共同定义。 |
| 高级类型       | 用户自定义谓词声明、泛型谓词和无法由函数体完整证明的反向收窄。                        |
| 诊断策略       | 自动穷尽检查和严格模式 warning/error 等级；源码级顺序不可达已经固定为编译错误。       |
