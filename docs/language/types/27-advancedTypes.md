# 高级类型

- 任务编号：T41
- 规范状态：已定稿
- 文档顺序：27

## 目标与边界

本规范定义条件类型、分布式条件类型、`infer`、映射类型、键重映射、模板字符串类型、内建类型工具以及递归高级类型的静态结果。

高级类型用于根据已有静态类型计算新类型，不是运行时反射或值转换系统。类型计算必须在 checker、泛型实例化或模块静态链接阶段完成；进入具体 Typed IR、对象布局和调用 ABI 前，所有影响运行时表示的结果必须规范化为已有具体类型。

性能是高级类型设计的第一优先级。高级类型自身不得向最终程序增加类型描述符、隐藏参数、装箱、分配、运行时分支、字符串匹配或动态分派。计算结果若本身是联合、可选对象或字典，仍按对应类型规范承担其固有表示成本，但不得额外承担“由高级类型生成”的包装成本。

类型计算算法与预算见 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)，IR 消解规则见 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)，最终表示见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，标准工具身份见 [`1-standardLibraryTypes.md`](../../stdlib/1-standardLibraryTypes.md)。

以下能力由其他规范定义：

| 能力                                      | 规范归属                     |
| ----------------------------------------- | ---------------------------- |
| 类型身份、兼容、类型格和普通推导          | T02–T05                      |
| 控制流收窄和穷尽检查                      | T06                          |
| 字符串格式、运行时模板和大小写值操作      | T13、T49                     |
| `void`、`never`、`unknown` 和 `any` 边界  | T15–T17                      |
| 字面量、联合、交叉和空值                  | T20–T23                      |
| 对象、接口、字典和递归类型                | T26–T31                      |
| 函数、重载、数组、元组、类、泛型和枚举    | T32–T39                      |
| `keyof`、类型查询、索引访问和 `as const`  | [T40](./26-typeOperators.md) |
| `satisfies`                               | T42                          |
| 类型断言和表示转换                        | T43–T44                      |
| 精确布局、GC、跨模块 ABI 和标准库符号身份 | T45–T49                      |
| 上下文 `this` 和 `ThisType<T>`            | T56                          |
| `await`、Promise 状态和 thenable 边界     | T59                          |

## 核心原则

| 原则           | 要求                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------- |
| 纯静态         | 高级类型只存在于语法树、类型图、编译元数据和诊断中，不形成运行时值。                                |
| TS 严格子集    | 语法和常用结果优先对齐 TypeScript strict；Nxts 可以因已定边界拒绝更多程序，不得接受更不安全的关系。 |
| 声明期检查     | 类型别名和泛型声明必须基于参数约束检查，不采用实例化后试错或失败分支兜底。                          |
| 闭合后生成     | 影响存储、返回值或参数布局的类型运算必须在生成具体 Typed IR 和 ABI 前得到唯一规范结果。             |
| 不隐含值转换   | 类型映射、键重命名和大小写类型计算不复制、修改或重新解释已有运行时值。                              |
| 最终类型付费   | 最终结果类型按自身规则承担联合 tag、可选状态或字典成本；高级类型不得增加结果之外的隐藏成本。        |
| 不使用动态兜底 | 失败、歧义和资源超限不能退化为 `any`、隐式 `unknown`、宽 `string` 或部分计算结果。                  |
| 确定计算       | 规范 TypeId、操作身份、缓存、符号回边和版本固定的工作预算共同保证相同输入得到相同结果。             |
| 能力局部化     | thenable、上下文 `this`、标准库值操作等运行时机制由对应规范开放，不能仅凭类型工具名称隐式获得。     |

## 类型计算模型

高级类型计算使用规范类型图，不对源码文本做字符串替换。类型别名可以在开放泛型声明中暂时保留符号运算：

```ts
type Value<T> = T extends Promise<infer U> ? U : T;
```

`Value<Promise<string>>` 必须在进入具体函数返回布局前成为 `string`。无法闭合的结果只允许存在于合法开放泛型签名和静态配方中。节点模型、求值顺序与缓存由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义。

## 条件类型

### 基础语法

Nxts 支持 TypeScript 条件类型语法：

```ts
type Result<T> = T extends string ? TextResult : OtherResult;
```

条件类型判断静态类型关系，不读取运行时值，也不生成值级 `if`。检查类型已经闭合时立即计算；仍包含开放类型参数时保留延迟节点，待合法实例化位置继续计算。

### `extends` 判断关系

条件类型中的 `Source extends Target` 表示 `Source` 的全部值是否满足 `Target` 的静态类型契约。它复用 T03、T26–T30、T36–T38 已定义的类型关系和约束满足规则，但不执行显式转换：

```ts
type A = 'ready' extends string ? true : false;
// true

type B = Dog extends Animal ? true : false;
// true

type C = MutableConfig extends ReadonlyConfig ? true : false;
// true

type D = number extends i32 ? true : false;
// false
```

以下内容不能使条件变为真：

- 数值表示能够通过 `std/numeric` 显式转换。
- 对象能够通过复制、裁剪或补字段变成目标形状。
- 基类值能够通过运行时检查收窄为派生类。
- 两个类型在当前后端偶然使用相同机器表示。
- `as`、FFI 或未支持的动态协议可能伪造目标类型。

接口结构契约、类继承、字面量到基础类型、品牌到底层类型以及可变到只读方向继续遵守各自已定规则。条件计算不建立普通赋值原本不允许的值级兼容。

### 声明期检查与分支事实

条件类型的两个分支都必须完成名称绑定和声明期静态检查。真分支可以使用 `extends` 提供的类型事实：

```ts
type Message<T> = T extends { message: infer _Message } ? T['message'] : never;
```

真分支已经证明 `T` 具有 `message`，因此索引访问合法。分支事实只在对应分支内有效，不进入外层别名或否定分支。

条件类型不能采用实例化后试错：

```ts
type Invalid<T> = T extends string ? T['missing'] : never;
// 编译错误：真分支中的类型操作不合法
```

未被最终选择的分支不会贡献结果类型，但其中的未绑定名称、非法语法、越权访问和不满足声明约束的操作仍然是编译错误。

### 联合分发

被检查位置为裸类型参数时，条件类型按 TypeScript 规则对联合成员分发：

```ts
type OnlyString<T> = T extends string ? T : never;

type Result = OnlyString<string | i32>;
// string
```

概念上等价于：

```text
OnlyString<string> | OnlyString<i32>
```

使用单元素元组包裹被检查类型可以关闭分发：

```ts
type Whole<T> = [T] extends [string] ? T : never;

type Result = Whole<string | i32>;
// never
```

只有裸类型参数触发分发。普通联合表达式、元组、对象、数组、Promise 或其他泛型构造中的类型参数不因内部包含联合而自动分发。

每个成员的分支结果完成后使用 T04、T21 和对应类型构造的规范化规则合并。重复成员消除，`never` 被普通联合成员吸收；不能为了减少成员数量把结果扩大为不精确上位类型。

### 特殊类型

`never` 在分布式条件中表示空成员集合：

```ts
type Check<T> = T extends string ? 'yes' : 'no';

type A = Check<never>;
// never
```

关闭分发后，`never` 按 T16 的底类型关系参与普通判断：

```ts
type B = [never] extends [string] ? 'yes' : 'no';
// "yes"
```

`unknown` 只在源码显式提供或既有规范明确产生时参与计算：

```ts
type C = Check<unknown>;
// "no"

type Identity<T> = T extends unknown ? T : never;
```

直接目标 `T extends unknown` 与 T37 的无约束上界特例一致，作为类型级全域判断成立；该特例不建立普通值 `T -> unknown` 的隐式赋值或动态打包。条件类型不会读取 `unknown` 的运行时内容或自动收窄动态值。结果为 `unknown` 时，后续值使用仍受 T17 的显式动态边界约束。

`void`、`null` 和 `undefined` 按各自既有类型关系参与条件判断。条件结果得到 `void` 后仍只能用于合法结果位置。`any` 不是有效 Nxts 类型，不能作为被检查类型、目标类型、分支结果或内部工具约束。

## `infer`

### 作用域与支持位置

`infer` 只允许出现在条件类型 `extends` 右侧的匹配位置：

```ts
type Element<T> = T extends readonly (infer U)[] ? U : never;

type PromiseValue<T> = T extends Promise<infer U> ? U : T;

type FunctionParts<T> = T extends (...args: infer P) => infer R
  ? [P, R]
  : never;
```

支持从以下静态结构提取类型：

| 匹配结构       | 可提取内容                                   |
| -------------- | -------------------------------------------- |
| 数组和元组     | 元素、固定位置、可选位置、rest 区段          |
| 对象和接口     | 属性、索引结果和满足约束的成员类型           |
| 函数和构造签名 | 参数元组、显式 `this`、返回类型和实例类型    |
| 已知泛型实例   | `Promise<T>`、用户泛型和其他已绑定构造的实参 |
| 模板字符串类型 | 由静态字面量片段锚定的字符串或受约束基础类型 |

`infer` 变量只在条件类型真分支可见，不能用于否定分支、条件外层、值表达式或运行时类型查询：

```ts
type Invalid<T> = T extends Promise<infer U> ? U : U;
// 编译错误：否定分支中 U 不可见
```

### 候选合并

同一个 `infer` 变量可以出现多次。checker 复用 T38 的方差信息合并候选：

```ts
type Values<T> = T extends {
  readonly left: infer U;
  readonly right: infer U;
}
  ? U
  : never;

type Result = Values<{
  left: string;
  right: i32;
}>;
// string | i32
```

| 候选位置                   | 合并规则                                       |
| -------------------------- | ---------------------------------------------- |
| 返回值、只读属性等协变位置 | 使用最小公共上位和规范联合                     |
| 函数参数等逆变位置         | 使用安全交集；不相交时结果为 `never`           |
| 可写属性等不变位置         | 候选必须为相同规范类型                         |
| 同时出现在不同方差位置     | 求唯一满足全部方向的安全结果；不存在时匹配失败 |

合并不能插入数值转换、接口包装、联合值构造或运行时检查。静态类型结果可以是联合或 `never`，但这些类型只有在后续真正用于值位置时才按自身规则产生表示。

### 受约束提取

Nxts 支持 TypeScript 的受约束 `infer`：

```ts
type Index<T> = T extends `${infer N extends i32}` ? N : never;
```

候选必须同时满足匹配结构和 `extends` 约束。字符串到数字字面量的静态提取使用 T13 的规范格式和对应数值类型范围；失败进入条件类型否定分支，不生成运行时解析代码。

### 重载匹配

对有序重载函数进行条件提取时，只使用最后一个公开重载签名，与 TypeScript 的可观察类型工具行为一致。私有实现签名永远不进入匹配：

```ts
function parse(value: i32): NumberNode;
function parse(value: string): TextNode;
function parse(value: i32 | string): NumberNode | TextNode {
  // 实现签名
}

type Result = ReturnType<typeof parse>;
// TextNode
```

若没有公开重载，则使用普通公开函数签名。实现签名中额外接受的参数或更宽返回类型不能通过 `infer`、`ReturnType` 或 `Parameters` 泄漏。

## 函数与构造器类型工具

Nxts 提供以下全局类型工具：

| 工具                       | 输入要求       | 结果                           |
| -------------------------- | -------------- | ------------------------------ |
| `ReturnType<T>`            | 函数类型       | 最后一个公开签名的返回类型     |
| `Parameters<T>`            | 函数类型       | 最后一个公开签名的参数元组     |
| `ConstructorParameters<T>` | 可构造类型     | 最后一个公开构造签名的参数元组 |
| `InstanceType<T>`          | 类或可构造类型 | 构造结果实例类型               |

```ts
type Result = ReturnType<() => string>;
// string

type Args = Parameters<(id: i32, name?: string) => boolean>;
// [id: i32, name?: string]

type UserArgs = ConstructorParameters<typeof User>;
type UserInstance = InstanceType<typeof User>;
```

参数工具保留位置、标签、可选标记和 rest 区段；标签只保留用于展示和诊断，不参与类型身份。返回工具保留 `void`、`undefined`、`never`、联合和递归类型的既有语义。

非函数传给函数工具、非构造器传给构造器工具均为编译错误，不返回 `never` 或 `unknown` 兜底。Nxts 不支持抽象类，因此构造器工具不接受抽象构造签名。

尚未实例化且无法得到唯一结果的泛型函数工具调用是编译错误：

```ts
type Identity = <T>(value: T) => T;

type Invalid = ReturnType<Identity>;
// 编译错误：没有闭合类型实参，无法得到唯一返回类型
```

开放泛型声明内部可以得到包含当前合法类型参数的符号结果：

```ts
type WrappedResult<T> = ReturnType<() => Box<T>>;
// Box<T>
```

## `Awaited<T>`

`Awaited<T>` 计算异步完成值类型：

```ts
type A = Awaited<Promise<string>>;
// string

type B = Awaited<Promise<Promise<i32>>>;
// i32

type C = Awaited<Promise<void>>;
// void

type D = Awaited<Promise<string> | i32>;
// string | i32
```

规则如下：

- 原生 `Promise<T>` 递归解包为 `Awaited<T>`。
- 裸类型参数按条件类型规则对联合分发。
- 非 Promise 类型保持原类型。
- `never` 保持 `never`。
- 显式 `unknown` 保持 `unknown`，不隐式读取动态完成值。
- `null`、`undefined` 和其他非 Promise 基础值保持原类型。

T41 当前只保证原生 `Promise<T>` 的静态提取，不根据一个普通对象恰好具有 `then` 成员而自行建立 thenable 能力。T59 若开放受支持的 `PromiseLike` 或 thenable，必须同时扩展 `await` 和 `Awaited<T>` 使用的同一静态 awaitable 识别入口，不能让两者产生不同完成值类型。

`Awaited<T>` 本身没有运行时成本。Promise 状态、异步调度、fulfillment、rejection、嵌套采用和 `await` lowering 的成本由 T59 定义。

## 联合类型工具

Nxts 提供以下全局联合类型工具：

| 工具             | 结果                             |
| ---------------- | -------------------------------- |
| `Exclude<T, U>`  | 删除 `T` 中满足 `U` 的联合成员   |
| `Extract<T, U>`  | 只保留 `T` 中满足 `U` 的联合成员 |
| `NonNullable<T>` | 删除 `null` 和 `undefined` 成员  |

```ts
type A = Exclude<string | i32 | null, null>;
// string | i32

type B = Extract<string | i32, string>;
// string

type C = NonNullable<string | null | undefined>;
// string
```

这些工具使用分布式条件类型和 T21 联合规范化。结果可以合法成为 `never`。

工具只处理已有联合成员，不对无限值域执行集合减法：

```ts
type Text = Exclude<string, 'reserved'>;
// string
```

宽 `string` 不是所有字符串字面量的显式无限联合，因此不能通过排除一个字面量得到新的运行时字符串类别。

## 映射类型

### 基础语法与修饰符

Nxts 支持 TypeScript 映射类型语法：

```ts
type Copy<T> = {
  [K in keyof T]: T[K];
};

type Optional<T> = {
  [K in keyof T]?: T[K];
};

type MutableRequired<T> = {
  -readonly [K in keyof T]-?: T[K];
};
```

支持以下修饰：

| 修饰                     | 作用                                  |
| ------------------------ | ------------------------------------- |
| 无显式修饰               | 同态映射时保留来源的可选性和 readonly |
| `readonly` / `+readonly` | 将结果属性设为 readonly               |
| `-readonly`              | 从结果属性移除 readonly               |
| `?` / `+?`               | 将结果属性设为可选                    |
| `-?`                     | 从结果属性移除可选                    |

`-readonly` 和 `-?` 只构造目标类型，不能把已有只读对象或缺失字段对象转换成可写、必选值。值级兼容仍按 T03、T26、T29 和 T43–T44 检查。

### 键域与结果类别

映射键必须规范化为 T40 支持的字符串或数字键：

| 键结果                         | 映射结果         |
| ------------------------------ | ---------------- |
| 有限字符串、数字或枚举键集合   | 精确固定对象类型 |
| 宽 `string`                    | T30 字符串字典   |
| 宽 `number`                    | T30 数值字典     |
| `never`                        | 不产生属性       |
| symbol、对象、函数或动态未知键 | 编译错误         |

有限映射保留规范键顺序用于稳定诊断和元数据，但普通对象属性类型身份不依赖源码声明顺序。宽键结果直接复用字典的缺失读取、权限、枚举和哈希表规则，不创建无限属性集合。

映射接口和类实例时只读取 T40 暴露的公开实例成员。结果是结构类型，不保留类身份、私有字段、受保护字段、构造器、静态成员或原型能力。

### 键重映射

Nxts 支持 TypeScript 的 `as` 键重映射：

```ts
type WithoutId<T> = {
  [K in keyof T as K extends 'id' ? never : K]: T[K];
};

type Getters<T> = {
  [K in keyof T as K extends string ? `get${Capitalize<K>}` : K]: () => T[K];
};
```

映射到 `never` 表示删除该键。映射到新字面量、有限联合或宽键域时，按上一节选择固定对象或字典结果。键重映射不修改来源对象，也不创建重命名字段的运行时代理。

多个来源键映射为同一规范键时，按 TypeScript 的保守规则合并：

```ts
type Source = {
  readonly optional?: 'a';
  required: 'b';
};

type Result = {
  [K in keyof Source as 'value']: Source[K];
};

// 等价于：
type Normalized = {
  readonly value?: 'a' | 'b';
};
```

合并规则如下：

- 值类型形成规范联合。
- 任一来源为可选时，结果为可选。
- 任一来源为 readonly 时，结果为 readonly。
- 显式 `-?` 或 `-readonly` 在合并后移除对应修饰。
- 合并与来源键声明顺序和缓存遍历顺序无关。

### 不隐含对象转换

映射类型只生成新类型，不转换现有值：

```ts
type UserGetters = Getters<User>;

function buildGetters(user: User): UserGetters {
  const invalid: UserGetters = user;
  // 编译错误：user 没有映射后的运行时字段

  return {
    getName: () => user.name,
  };
}
```

只有最终类型和来源类型的规范布局、身份和权限满足既有零成本兼容规则时，才能形成视图。重命名键、删除字段、改变字段表示、增加存在状态或改变类身份不能通过映射类型隐式发生。

编译器不能把映射结果当作 C 风格指针重解释，也不能因为字段偏移偶然相同就跳过类型兼容检查。

### 数组与元组

未改变键集合的同态映射保留数组或元组类别：

```ts
type A = Readonly<string[]>;
// readonly string[]

type B = Readonly<[i32, string]>;
// readonly [i32, string]

type C = Partial<[i32, string]>;
// [i32?, string?]
```

数组和元组规则如下：

- `Readonly<T[]>` 和 `Readonly<Tuple>` 形成相同布局的只读视图。
- 元组的 `Partial`、`Required` 和普通同态值映射复用 T35 的固定、可选和 rest 形状图。
- 可选元组实例创建后仍不能补出或删除位置；改变实际长度需要创建新元组。
- 普通数组不支持 `Partial<T[]>`，避免恢复 T34 已排除的稀疏位置语义。
- `Required<T[]>` 对没有可选索引的普通稠密数组保持数组类别。
- 改变键集合、删除键或使用 `as` 重映射后，结果为普通对象或字典，不再具有数组身份和长度修改能力。

映射结果若改变元素表示，现有数组或元组不能被零复制重解释；程序必须显式构造目标容器。

## 对象类型工具

Nxts 提供以下全局对象类型工具：

| 工具           | 结果                                             |
| -------------- | ------------------------------------------------ |
| `Partial<T>`   | 固定属性变为可选                                 |
| `Required<T>`  | 固定属性移除可选状态                             |
| `Readonly<T>`  | 固定属性或容器变为浅层只读                       |
| `Pick<T, K>`   | 选择 `K extends keyof T` 的属性                  |
| `Omit<T, K>`   | 删除指定键；不存在的合法键按 TypeScript 规则忽略 |
| `Record<K, V>` | 为 `K` 中每个键生成必选可写的 `V` 属性           |

### `Partial`、`Required` 和 `Readonly`

```ts
type Draft = Partial<User>;
type Complete = Required<Draft>;
type View = Readonly<User>;
```

`Partial<T>` 只增加属性缺失状态，不把属性存储类型隐式改成 `T | undefined`。读取可选属性时按 T26 得到 `T | undefined`；显式声明在字段值类型中的 `undefined` 与缺失状态继续分离。

`Required<T>` 移除缺失状态，不删除字段值类型中显式存在的 `undefined`。已有 `Partial<T>` 值不能因为目标使用 `Required<T>` 就获得不存在的字段。

`Readonly<T>` 是浅层静态权限映射，不递归处理成员引用，不执行 `Object.freeze`，也不阻止其他 mutable 别名修改底层值。需要深层只读时可以使用用户定义递归映射，但每一层仍遵守对应类型的布局和权限规则。

宽字典本来就不保证任意动态键存在，因此 `Partial` 和 `Required` 不为其创建可选索引签名或无限存在位；动态读取仍按 T30 得到可能缺失的结果。`Readonly` 可以把可写字典变为相同表示的只读视图。

### `Pick` 与 `Omit`

```ts
type PublicUser = Pick<User, 'id' | 'name'>;

type SafeUser = Omit<User, 'password'>;
```

`Pick` 要求每个选择键满足 `keyof T`。`Omit` 接受合法键类型并与 TypeScript 一样忽略不属于 `keyof T` 的键。两者保留剩余属性的类型、可选性和 readonly。

`Pick` 和 `Omit` 产生结构类型，不对已有对象执行字段裁剪：

```ts
function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
  };
}
```

若 T03 已证明来源和结果规范布局完全一致，则可以使用既有零成本兼容；否则直接把多字段对象赋给少字段固定对象仍按对象裁剪规则拒绝。

### `Record`

```ts
type StatusText = Record<Status, string>;

type StringTable = Record<string, i32>;
```

有限字符串、数字字面量或封闭枚举键生成固定对象，所有属性必选且可写。宽 `string` 或 `number` 生成 T30 原生字典，不假设运行时所有可能键均存在：

```ts
function readRecord(table: Record<string, i32>, key: string) {
  const value = table[key];
  // i32 | undefined
}
```

`Record` 不支持 symbol 键。有限键冲突按规范属性键合并；不兼容的重复运行时规范键产生编译错误。

## `NoInfer<T>`

`NoInfer<T>` 控制泛型候选来源，不改变最终类型：

```ts
function select<C extends string>(
  options: readonly C[],
  fallback: NoInfer<C>,
): C {
  return fallback;
}

select(['red', 'green'] as const, 'blue');
// 编译错误
```

推导步骤为：

1. `options` 提供候选并确定 `C = "red" | "green"`。
2. `NoInfer<C>` 阻止 `fallback` 扩大 `C`。
3. 推导完成后再检查 `"blue"` 是否兼容 `C`。

`NoInfer<T>` 规范化后的类型仍是 `T`，只在 T05、T37 的候选收集阶段带有“禁止从此位置推导”的静态标记。它不能跳过约束检查、赋值检查或显式类型实参验证，不进入 Typed IR、布局或 ABI。

## 显式 `this` 类型工具

Nxts 提供：

```ts
type Handler = (this: Service, value: i32) => string;

type Receiver = ThisParameterType<Handler>;
// Service

type Plain = OmitThisParameter<Handler>;
// (value: i32) => string
```

`ThisParameterType<T>` 要求函数具有显式 `this` 伪参数。没有显式接收者时产生编译错误，不返回 `unknown`。

`OmitThisParameter<T>` 生成移除接收者后的新函数类型，但不绑定已有函数值：

```ts
function omitReceiver(handler: Handler, service: Service): void {
  const invalid: Plain = handler;
  // 编译错误：handler 仍要求接收者

  const plain: Plain = (value) => service.handle(value);
}
```

输入函数没有显式 `this` 时，`OmitThisParameter<T>` 返回原函数类型。泛型或重载输入与 TypeScript 一样只传播最后一个公开签名；无法闭合该签名中的类型参数时产生编译错误。

Nxts 不因该工具恢复函数 `call`、`apply` 或 `bind`。`ThisType<T>` 依赖对象字面量上下文 `this` 和 T56 接收者规则，当前只保留标准类型名称空间位置，不在 T41 建立有效能力。

## 模板字符串类型

### 基础形式

Nxts 支持 TypeScript 模板字符串类型：

```ts
type Event = `${'open' | 'close'}Changed`;
// "openChanged" | "closeChanged"

type UserId = `user:${i32}`;

type Enabled = `enabled:${boolean}`;
// "enabled:true" | "enabled:false"
```

模板字符串类型描述字符串值集合，不创建运行时模板或正则表达式。有限字面量联合在编译期计算笛卡尔积并规范化；宽值域使用符号化模板模式，不枚举无限成员。

### 插值类型

| 插值类型                             | 类型级结果                           |
| ------------------------------------ | ------------------------------------ |
| 字符串字面量或有限联合               | 产生对应有限字符串片段               |
| 宽 `string`                          | 保留任意字符串符号片段               |
| 数字字面量、`number` 和原生数值类型  | 使用 T13 对应类型的规范字符串格式    |
| `boolean` 或布尔字面量               | `"true"`、`"false"` 或其有限子集     |
| `null`、`undefined`                  | `"null"`、`"undefined"`              |
| `never`                              | 整个分布成员无结果                   |
| bigint、symbol、函数、对象、数组、类 | 编译错误                             |
| 未收窄的多表示联合                   | 按条件分发得到确定模式，否则编译错误 |

对象、数组和类可以按 T13 的值级规则参与普通运行时模板，但这不意味着它们具有可枚举或可静态匹配的模板字符串类型。需要类型级格式时必须先取得受支持的基础值类型。

数值模板使用对应类型的真实格式和范围：

- 固定宽度整数只接受其范围内的规范十进制文本。
- `number` 和 `f64` 使用 T13 的 JavaScript Number 风格，包括已定义的指数、`NaN` 和无穷格式。
- `f32` 使用能够还原同一 binary32 值的规范最短格式。
- `usize`、`isize` 使用目标平台范围；跨目标导出模式必须记录目标和类型摘要。
- 非规范前导零、越界整数或不符合对应格式的字符串字面量不属于该模板类型。

### 普通模板表达式的关系

普通值级模板继续按 T13 默认产生 `string`：

```ts
function formatText(count: i32): string {
  const text = `count:${count}`;
  // 默认推导为 string
  return text;
}
```

当上下文明确要求模板字符串类型，且每个片段和插值的静态类型都能证明满足对应模式时，checker 可以接受：

```ts
function formatCount(count: i32): `count:${i32}` {
  return `count:${count}`;
}
```

该证明只检查源码模板结构和静态插值类型，不在运行时再次匹配结果字符串。通过普通函数、外部输入或宽 `string` 得到的值不能在没有证明入口时直接赋给更窄模板类型。

### 模板提取

模板模式支持 `infer`：

```ts
type EventName<T> = T extends `${infer Name}Changed` ? Name : never;

type A = EventName<'userChanged'>;
// "user"

type Pair<T> = T extends `${infer Left}:${infer Right}` ? [Left, Right] : never;
```

匹配按 TypeScript 规则使用静态字面量片段从左到右确定捕获边界。联合输入逐成员匹配；相邻捕获和重复捕获使用确定的 TypeScript 匹配顺序与候选合并规则。

受约束捕获可以恢复基础字面量类型：

```ts
type Port<T> = T extends `${infer N extends i32}` ? N : never;

type A = Port<'8080'>;
// 8080，对应 i32 字面量

type B = Port<'2147483648'>;
// never，超出 i32 范围
```

该过程是编译期文本验证，不执行运行时整数解析或溢出检查。

### 大小写类型工具

Nxts 提供：

```ts
type A = Uppercase<'ready'>;
// "READY"

type B = Lowercase<'HTTP'>;
// "http"

type C = Capitalize<'user'>;
// "User"

type D = Uncapitalize<'User'>;
// "user"
```

字面量和有限联合直接计算；宽 `string` 保留为符号化转换类型，不能退化为普通 `string`。这些结果可以继续用于键重映射和模板匹配。

大小写映射使用工具链固定的 Unicode 版本和非区域化规则。编译器、运行时标准库和跨模块静态摘要必须使用兼容的大小写表版本；系统区域设置不能改变结果。

类型工具不转换运行时值：

```ts
type Upper = Uppercase<'hello'>;

const a: Upper = 'hello';
// 编译错误

const b: Upper = 'HELLO';
// 合法
```

动态值只有来自能够证明结果契约的入口时才能获得对应类型：

```ts
function uppercase(text: string): Uppercase<string> {
  const invalid: Uppercase<string> = text;
  // 编译错误

  return text.toUpperCase();
}
```

T49 必须让标准大小写 intrinsic 的静态返回类型和实际运行时转换使用同一规则。转换本身承担创建结果字符串的正常成本；类型系统不增加转换后的验证扫描。编译期常量调用可以直接折叠。

区域化大小写、用户自定义格式化和任意正则字符串类型不属于 T41。

## 递归与复杂度

### 稳定递归

高级类型处理递归输入时复用 T31 的符号类型图：

```ts
type DeepReadonly<T> = T extends readonly (infer Element)[]
  ? readonly DeepReadonly<Element>[]
  : T extends Node
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
```

实现不能通过较小的固定展开深度决定递归是否合法。再次遇到相同操作身份、输入 TypeId 和规范类型参数时，应命中缓存或建立结果回边。

| 计算情况                     | 处理                       |
| ---------------------------- | -------------------------- |
| 相同操作再次遇到相同规范输入 | 复用缓存或建立递归结果回边 |
| 递归映射产生稳定有限类型图   | 接受                       |
| 每轮生成新类型实参或更大结构 | 报告无限类型计算           |
| 输入有限但组合结果过大       | 触发确定的资源预算诊断     |

稳定递归不创建运行时递归类型描述符。最终对象、数组、接口和联合继续使用各自已有的递归布局与 GC 规则。

### 符号计算与工作预算

实现必须优先保留宽模板模式、开放条件、宽字典映射、optional/rest 形状和递归回边等符号形式，只在确实需要成员时展开。缓存键、统计维度、`65535` 简单键的近似线性要求和确定性预算由 [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md) 定义。

## 运行时表示与成本

高级类型节点必须在可执行 IR 前消失，最终值只承担规范结果类型本身的联合、optional、对象、元组、字典或字符串表示成本。禁止真假标记、类型字典、键映射表、字符串验证标签、隐式对象复制和统一装箱。最终表示及 LLVM 边界见 [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，IR 禁止项见 [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)。

## 标准类型工具身份

全局工具集合、绑定身份、同名遮蔽和版本边界由 [`1-standardLibraryTypes.md`](../../stdlib/1-standardLibraryTypes.md) 定义。T41 只定义每个工具的输入约束与结果语义。

## 跨模块静态元数据

闭合导出类型保存规范结果，开放泛型保存已绑定静态配方；两者都不能进入对象、闭包或模块初始化。摘要字段、Unicode/语义版本和拒绝规则由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义。

## 编译器职责

| 阶段                    | 唯一职责来源                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------ |
| 语法接受范围            | [`1-syntaxSubset.md`](../syntax/1-syntaxSubset.md)                                   |
| 类型参数与 `infer` 绑定 | T57                                                                                  |
| 求值、递归缓存与预算    | [`5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)     |
| 泛型闭合与共享          | T37 及 [`1-loweringStrategies.md`](../../compiler/optimizer/1-loweringStrategies.md) |
| Checked HIR 消解        | [`1-irContracts.md`](../../compiler/ir/1-irContracts.md)                             |
| 最终布局与 LLVM         | [`1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)   |
| 静态配方与版本          | [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md)                                    |
| 标准符号身份            | [`1-standardLibraryTypes.md`](../../stdlib/1-standardLibraryTypes.md)                |
| 复杂度和零成本诊断      | [`1-performanceDiagnostics.md`](../../toolchain/1-performanceDiagnostics.md)         |

## 支持范围与预留

当前支持：

- 用户定义条件类型和分布式条件类型。
- 条件结构中的 `infer` 和受约束 `infer`。
- 用户定义映射类型、修饰符和 `as` 键重映射。
- 有限与符号化模板字符串类型。
- 本规范列出的全局类型工具。
- 使用 T31 回边和统一预算的稳定递归高级类型。

当前不支持：

| 能力                           | 原因或归属                           |
| ------------------------------ | ------------------------------------ |
| `any` 参与类型计算             | T17 永久排除                         |
| 高阶类型参数和类型构造器参数   | T37 已排除                           |
| 用户自定义 compiler intrinsic  | 会建立不受控编译器特权入口           |
| symbol 键映射和 symbol 模板    | T18、T30、T40 尚未开放 symbol 属性键 |
| bigint 模板和 bigint 类型工具  | T19 不支持 bigint                    |
| 普通数组 `Partial<T[]>`        | 与 T34 稠密数组不变量冲突            |
| 任意结构化 thenable 解包       | T59 决定 PromiseLike 与 `await` 边界 |
| `ThisType<T>`                  | T56 决定对象字面量上下文接收者       |
| 区域化大小写和正则类型         | 不属于有限、确定的基础高级类型能力   |
| 运行时读取、构造或比较类型对象 | 高级类型纯静态，不建立反射系统       |

未来开放预留能力时必须扩展对应类型关系、静态摘要和运行时机制，不能通过放宽 T41 的失败兜底实现。

## 与 TypeScript 的兼容性

Nxts 保持 TypeScript 的条件类型、裸参数联合分发、元组关闭分发、`infer`、映射修饰、键重映射、模板字符串类型和常用工具名称。通过 Nxts checker 的源码在提供原生类型和标准库声明后必须能够通过 TypeScript strict 检查。

主要差异如下：

| 场景                               | TypeScript strict                | Nxts                                       |
| ---------------------------------- | -------------------------------- | ------------------------------------------ |
| `any`                              | 可参与条件、推导和标准工具约束   | 永久拒绝                                   |
| 无法闭合的泛型 `ReturnType`        | 常得到 `unknown`                 | 编译错误                                   |
| 无显式接收者的 `ThisParameterType` | 得到 `unknown`                   | 编译错误                                   |
| `Awaited`                          | 可识别结构化 thenable            | 当前只保证原生 Promise；扩展归 T59         |
| 普通数组 `Partial<T[]>`            | 支持并可表达稀疏位置             | 拒绝，保持稠密数组                         |
| symbol、bigint 高级类型            | 支持                             | 按既有类型边界拒绝                         |
| 映射或 `Pick` 后的结构赋值         | 常允许额外字段对象直接兼容       | 不允许借类型计算绕过固定对象裁剪和布局规则 |
| 数值模板                           | 主要基于统一 `number` / `bigint` | 区分 `i32`、`f32`、`f64` 等格式和范围      |
| 复杂类型资源上限                   | 由 TypeScript 实现限制决定       | 使用版本固定的确定预算并报告增长来源       |
| 运行时表示                         | 类型擦除到 JavaScript 动态值     | 先闭合类型，再生成具体原生布局和 ABI       |

这些差异只缩小接受范围或提高结果精度，不为已接受源码增加额外运行时类型行为。

## 诊断与测试

### 条件类型与 `infer`

至少覆盖：

- 闭合真假分支和开放泛型延迟计算。
- 裸类型参数联合分发和元组关闭分发。
- `never` 的空分发与关闭分发后的底类型关系。
- 显式 `unknown`、`void`、`null` 和 `undefined`。
- 真分支约束事实和否定分支不可见性。
- 非法分支不能通过未选择而逃过声明检查。
- 数组、元组、对象、函数、构造器、泛型实例和模板的 `infer`。
- 协变候选联合、逆变候选交叉和不变候选冲突。
- 受约束 `infer` 成功、格式失败和范围失败。
- 重载只读取最后一个公开签名，不泄漏实现签名。
- 任意 `any` 使用产生明确错误。

### 类型工具

至少覆盖：

- `ReturnType` 保留普通、联合、`void`、`undefined` 和 `never` 返回。
- `Parameters` 保留必选、可选、默认位置、标签和 rest。
- 构造器参数与实例类型。
- 非函数、非构造器和未闭合泛型错误。
- `Awaited` 递归 Promise、联合、非 Promise、`void`、`never` 和 `unknown`。
- `Exclude`、`Extract`、`NonNullable` 及 `never` 结果。
- `NoInfer` 只屏蔽候选，不跳过最终检查。
- 显式 `this` 提取、移除和已有函数值赋值拒绝。
- 标准符号身份与局部同名类型遮蔽。

### 映射类型

至少覆盖：

- 同态映射保留可选和 readonly。
- `+` / `-` 修饰符添加和移除。
- 有限键、宽字符串键、宽数值键和空键。
- 接口、类 public 实例成员和枚举键。
- 键重命名、映射到 `never` 和有限模板键。
- 碰撞值联合、可选/readonly 保守合并及显式移除。
- 映射结果不能自动转换来源对象。
- `Partial`、`Required`、`Readonly`、`Pick`、`Omit` 和 `Record`。
- `Record<Enum, V>` 固定对象和 `Record<string, V>` 字典缺失读取。
- readonly 数组零成本视图、可选元组形状和普通数组 `Partial` 拒绝。
- 递归映射命中符号回边。

### 模板字符串类型

至少覆盖：

- 有限联合笛卡尔积和重复成员规范化。
- 宽字符串前缀、后缀和中间符号片段。
- boolean、空值、`number` 和全部原生数值格式。
- 整数边界、前导零、`NaN`、无穷、`-0` 和指数格式。
- 普通模板默认 `string` 与上下文模式证明。
- 字符串 `infer`、多个捕获、联合分发和受约束数值恢复。
- 四个大小写工具的字面量、联合、宽字符串和 Unicode 边界。
- 未转换动态字符串不能赋给大小写结果类型。
- 对象、数组、函数、symbol 和 bigint 插值拒绝。
- 类型计算不生成运行时正则、验证扫描或标签。

### 复杂度、模块与成本

至少覆盖：

- 稳定递归建立回边，无界新实参链产生诊断。
- 大型条件联合、映射键和模板组合使用缓存与符号形式。
- `65535` 个简单键的线性映射。
- 预算超限结果确定，不受线程和机器速度影响。
- 超限不返回部分类型或动态兜底。
- 闭合导出结果和开放泛型配方跨模块得到相同 TypeId。
- 语义版本、Unicode 表和依赖指纹不一致时拒绝链接。
- 高级类型节点不进入具体 Typed IR、GC 描述或运行时对象。
- 最终联合、可选对象和字典只承担自身规范要求的成本。

## 依赖边界

| 相关能力               | T41 使用或确定的内容                                     | 对应规范继续负责内容                                   |
| ---------------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| T02–T06 公共类型规则   | 静态包含、分支结果规范化、普通推导隔离和分支事实         | 类型身份、兼容、类型格、普通推导和 CFG                 |
| T07–T23 基础与组合类型 | 特殊类型条件行为、数值模板、联合分发和最终结果类型       | 基础值语义、格式、联合/交叉布局和空值表示              |
| T26–T31 对象声明       | 映射成员、工具结果、字典分流和递归运算回边               | 对象布局、权限、接口、字典、类可见性和递归类型图       |
| T32–T39 复合与泛型     | 函数工具、重载提取、容器映射、类实例、枚举键和延迟实例化 | 签名、布局、构造、方差、闭合实例和代码共享             |
| T40 类型运算符         | 使用 `keyof`、`typeof`、`T[K]` 和 `as const` 结果        | 基础类型查询、键域和字面量保留                         |
| T42 `satisfies`        | 不通过高级类型隐式恢复该语法                             | 不支持边界、拒绝诊断和不进入 Typed IR                  |
| T43–T44 转换           | 类型映射不隐含值转换或对象重解释                         | 品牌断言、普通 `as` 拒绝、显式转换和运行时检查         |
| T45–T47 表示与 ABI     | 高级类型先闭合；导出静态配方和语义版本要求               | 精确字段、GC 描述、模块格式、链接与目标平台校验        |
| T49 标准库             | 规定全局类型工具集合及大小写值 intrinsic 的静态契约      | 公开声明、模块路径、运行时实现和优化入口               |
| T56 `this`             | 提取和移除显式 `this` 参数                               | 上下文 `this`、`ThisType<T>`、接收者初始化和调用       |
| T59 异步               | `Awaited<T>` 当前静态 Promise 提取                       | `await`、PromiseLike、状态机、fulfillment 和 rejection |
