# 接口

- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-26
- 文档顺序：17

## 目标与边界

定义 `interface` 的结构化契约、继承、实现、成员冲突和泛型规则，使 TypeScript 常用接口写法能够映射到接近 Go interface 成本的原生实现。

精确对象模型见 [`15-objectTypes.md`](./15-objectTypes.md)，类型身份见 [`2-typeIdentity.md`](./2-typeIdentity.md)，赋值兼容见 [`3-typeCompatibility.md`](./3-typeCompatibility.md)。对象身份与反射事实见 [`../semantics/12-interfaceSemantics.md`](../semantics/12-interfaceSemantics.md)，`Object.*` API 契约见[对象标准库](../../stdlib/4-object.md)，witness runtime 见 [`../../runtime/objects/7-interfaceRuntime.md`](../../runtime/objects/7-interfaceRuntime.md)。

## 核心模型

Nxts 明确区分精确对象类型与接口契约：

| 类型形式                     | 语义                                         |
| ---------------------------- | -------------------------------------------- |
| `type Exact = { ... }`       | 具有确定完整形状和固定布局的精确对象类型。   |
| `interface Contract { ... }` | 可以由多种具体对象或类结构化实现的多态契约。 |

接口只声明可观察成员能力，不声明具体对象的完整属性集合。接口值保留底层对象身份，并通过静态生成的 witness table 访问具体实现；它不是字段裁剪后的新对象。

```ts
type ExactEntity = {
  id: i64;
};

interface Entity {
  id: i64;
}
```

`ExactEntity` 与 `Entity` 不是同一语义类型，也不使用同一调用 ABI。具体对象可以结构化转换为接口视图；接口值不能隐式转换为精确对象。

## 声明与成员

接口使用 TypeScript 声明语法：

```ts
interface UserService {
  readonly name: string;
  timeout?: i32;
  execute(input: string): string;
  ["status"]: string;
}
```

T29 支持以下成员：

- 必选属性、可选属性和 `readonly` 属性。
- 普通方法签名。
- 能够在编译期归一为字符串字面量的计算属性名。

同一接口内，属性与方法共享成员键空间。普通重复成员、属性与方法同名以及无法归一为静态字符串的计算属性名产生编译错误。同名方法签名和纯调用签名可以按 T33 形成有序重载集合；这不允许重复属性、属性与方法混合或接口声明合并。

以下成员由对应能力定义，不因 T29 自动开放：

| 成员能力                   | 负责规范        |
| -------------------------- | --------------- |
| 字符串和数值索引签名       | T30 字典类型    |
| 纯调用签名 `(value: T): R` | T32 函数类型    |
| 方法与调用签名重载         | T33 函数重载    |
| 构造签名 `new (...): T`    | T36 类与构造器  |
| symbol 计算属性            | T18，当前不支持 |

只包含一个或多个调用签名且没有普通成员的接口按 T32–T33 归一为普通或重载函数契约，只包含构造签名的接口可以由 T36 归一为构造器契约。T32 拒绝调用能力与普通属性混合的可调用对象；T29 不把普通接口自动变成 JavaScript 动态函数对象。

接口只有显式声明字符串或数值索引签名时才具备 T30 字典能力。只包含有限属性的普通接口不能仅凭成员类型自动转换为索引签名；指向该接口的 `type` 别名仍保持接口类别。带索引签名的接口由有限接口契约与字典契约组合，固定成员和方法必须满足 T30 的索引值约束。

## 类型空间

接口名称只存在于类型空间，不能作为运行时值、构造器或 `instanceof` 右操作数：

```ts
const user = new User(); // 编译错误：接口不是构造器
value instanceof User; // 编译错误：接口不是运行时值
```

接口 witness 和契约指纹属于编译器生成的运行时元数据，不使源码接口名称进入值空间。类型和值双空间、遮蔽、导入符号绑定和重复声明由 T57 定义；模块解析、导出图和可见性由 T55 定义。

## 结构化契约身份

接口采用结构化语义身份。checker 先展平继承并规范化成员，再按以下信息建立接口契约身份：

- 规范成员键和成员种类。
- 属性类型、可选性和 `readonly` 权限。
- 方法参数、返回类型和接收者要求。
- 泛型实例的规范类型实参。

接口名称、模块路径、声明顺序、继承顺序和继承路径不参与结构化身份。成员种类参与身份；普通方法与同签名的函数值属性不自动视为同一契约，因为接收者绑定和实现 witness 不同。

```ts
interface EntityA {
  readonly id: i64;
}

interface EntityB {
  readonly id: i64;
}
```

`EntityA` 和 `EntityB` 规范化为同一接口契约。成员顺序不同但规范成员相同的接口也具有相同身份。

接口与成员相同的精确对象类型仍然不相等：接口是多态视图，精确对象是具体形状。二者的结构化成员匹配建立转换关系，不建立类型相等。

## 结构化实现

普通对象和类实例只要静态满足接口成员要求，就可以转换为接口，不要求显式声明 `implements`：

```ts
interface Entity {
  readonly id: i64;
  save(): void;
}

const user = {
  id: 1,
  name: "Tom",
  save() {},
};

const entity: Entity = user;
```

额外成员合法，因为转换产生指向原对象的接口视图，不产生精确对象裁剪。checker 按成员能力检查实现：

| 接口要求                     | 具体实现要求                                                      |
| ---------------------------- | ----------------------------------------------------------------- |
| 必选只读属性 `readonly p: T` | 必须可读，具体读取类型兼容 `T`。                                  |
| 必选可写属性 `p: T`          | 必须可读写；读取方向和写入方向都安全，通常要求规范类型一致。      |
| 可选属性 `p?: T`             | 可以存在兼容属性，也可以完全缺失；缺失时由可选扩展规则处理。      |
| 方法 `m(...): R`             | 对象自身方法或类实例方法必须满足 T32 的严格函数兼容和接收者要求。 |

可写属性不能仅按协变读取关系判断。若接口允许写入 `T`，具体实现必须能够接收所有合法 `T` 值，防止通过接口视图破坏具体对象的字段类型。

原生标量默认不能结构化实现接口，避免在接口转换中引入隐藏装箱。`string`、数组、函数和其他引用类型只有在所属能力或 T49 提供静态内建 witness 时才能实现接口。

## 对象与接口转换

满足契约的具体对象到接口属于隐式接口打包：

```text
ConcreteObject -> InterfaceContract
```

该转换：

- 保留原对象引用身份。
- 不复制或裁剪字段。
- 不执行运行时成员扫描或失败检查。
- 选择编译期已生成的 witness table。
- 在 Typed IR 中记录 `InterfacePack`，不能伪装为普通对象零成本相等。

接口到要求更少成员的接口可以执行结构化上位转换，并记录 `InterfaceRepack`。相同接口身份之间不需要转换。

接口不能隐式转换为精确对象，因为底层具体对象可能具有不同完整形状和布局：

```ts
const copyEntity = (entity: Entity) => {
  const exact: ExactEntity = entity; // 编译错误

  const copied: ExactEntity = {
    id: entity.id,
  };
};
```

`as` 不能绕过该方向。需要确认底层具体类型时使用 T44、T49 定义的受信任类型检查；仅需要目标精确形状而不要求原值已经具有该身份时，明确构造对象。

## 接口继承

接口支持 TypeScript 的多接口继承：

```ts
interface Named {
  name: string;
}

interface Timestamped {
  readonly createdAt: i64;
}

interface User extends Named, Timestamped {
  id: i64;
}
```

`extends` 同时表示契约组合和子接口到每个父接口的兼容关系。checker 在编译期展平继承成员，不在运行时遍历接口继承链。

继承关系必须是有向无环图。直接或间接继承自身产生编译错误：

```ts
interface A extends A {}

interface B extends C {}
interface C extends B {}
```

### 继承成员冲突

多个父接口提供完全相同的规范成员时合并为一个成员。成员类型、可选性、权限或成员种类不一致时，子接口必须显式重新声明，并且新声明必须同时满足所有父接口。

属性重声明遵循以下安全方向：

| 父接口到子接口的变化   | 结果                                               |
| ---------------------- | -------------------------------------------------- |
| 可选改为必选           | 允许；子接口提供更强存在保证。                     |
| 必选改为可选           | 拒绝；子接口不能满足父接口的存在要求。             |
| `readonly` 改为可写    | 允许；可写实现可以作为只读父接口使用。             |
| 可写改为 `readonly`    | 拒绝；父接口仍可能执行写入。                       |
| 只读属性类型安全收窄   | 允许；读取方向协变。                               |
| 可写属性类型收窄或扩大 | 拒绝，除非读写两个方向都满足并归一为同一安全类型。 |

```ts
interface Animal {
  readonly kind: string;
}

interface Dog extends Animal {
  readonly kind: "dog";
}
```

方法冲突使用 T32–T33 的严格函数兼容。单个接口可以显式声明同名方法签名形成 T33 重载组；继承得到的不兼容同名方法不能自动合并为重载或动态分派。

## 可选属性

具体实现可以完全缺少接口可选属性：

```ts
interface Options {
  cache?: string;
}

const raw = {};
const options: Options = raw;

options.cache = "memory";
```

读取类型为 `T | undefined`。可写接口允许写入 `T`，并使该属性成为底层对象实际存在的自身属性。接口转换不因属性缺失而失败。

对象身份、可选属性写入和底层反射事实见 [`../semantics/12-interfaceSemantics.md`](../semantics/12-interfaceSemantics.md)，`Object.hasOwn` 与 `Object.keys` 的公开契约见[对象标准库](../../stdlib/4-object.md)。固定槽位与有限扩展记录的实现优先级见 [`../../runtime/objects/7-interfaceRuntime.md`](../../runtime/objects/7-interfaceRuntime.md)。任意键扩展仍要求 T30 索引签名。

## 方法

接口支持普通方法签名：

```ts
interface UserRepository {
  findById(id: i64): User | null;
  save(user: User): void;
}
```

方法参数使用 T03、T32 的严格逆变规则，不采用 TypeScript 为历史兼容保留的双变方法参数。返回值按协变检查，并必须满足调用 ABI。

接口方法可以声明独立方法级类型参数：

```ts
interface Decoder {
  decode<T>(input: string, schema: Schema<T>): T;
}
```

类型实参必须在调用点静态闭合，不能由动态接口值引入运行时泛型推导。泛型方法配方、实例需求和代码体积由 T37 定义；witness 槽位与动态库 ABI 见 runtime 和 T47。

方法重载、可选方法、`this`、接收者绑定和具体调用 ABI 分别由 T33、T32、T56 和 T53 定义，但不得突破本节的静态 witness 与无隐式装箱边界。

## 泛型接口

接口支持类型参数、`extends` 上界约束和默认类型实参：

```ts
interface Box<T> {
  value: T;
}

interface Result<T, E = string> {
  readonly value?: T;
  readonly error?: E;
}
```

泛型参数和默认值沿用 T28、T37 的公共规则。每个具体实例先替换实参、检查约束、展平继承并规范化成员，再建立契约指纹和 witness 布局。

`Box<i32>` 与 `Box<string>` 是不同接口实例。接口值不携带可供用户访问的运行时泛型实参，不使用统一动态泛型表示；单态化、实例共享、代码体积预算和方差由 T37、T38 定义。

## 类的 `implements`

类可以显式声明实现一个或多个接口：

```ts
class User implements Entity, Named {
  id: i64;
  name: string;

  save() {}
}
```

`implements` 只检查类实例侧，不检查静态成员或构造函数，不注入字段和方法，也不改变类布局。省略 `implements` 时，只要类实例结构满足接口，仍可在转换点生成 witness。

witness 共享与调用实现见 [`../../runtime/objects/7-interfaceRuntime.md`](../../runtime/objects/7-interfaceRuntime.md)。可见性、继承方法、覆盖和构造初始化由 T36 定义。

## 递归接口

通过对象、数组、函数或其他引用间接层形成的递归成员合法：

```ts
interface Node {
  value: i32;
  next: Node | null;
}

interface Tree<T> {
  value: T;
  readonly children: Tree<T>[];
}
```

checker 使用符号类型图和回边表示递归契约，不无限展开文本。继承循环始终非法；不断改变泛型实参的递归声明可以按需实例化，只有实际需求形成无界实例链时才在触发位置编译报错。递归等价、惰性实例化、增长检测、布局和 GC 回边由 [`19-recursiveTypes.md`](./19-recursiveTypes.md) 定义。

## 运行时接口视图

接口视图必须保留底层对象身份，不复制或裁剪对象，并以接近 Go interface 的固定大小视图为目标。接口能力不能给未使用接口的普通对象增加访问分支。

物理视图和 witness 布局见 [`../../compiler/representation/1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)，runtime 查询见 [`../../runtime/objects/7-interfaceRuntime.md`](../../runtime/objects/7-interfaceRuntime.md)，IR 操作见 [`../../compiler/ir/1-irContracts.md`](../../compiler/ir/1-irContracts.md)。

## 反射与对象身份

接口类型只限制静态可访问成员，不裁剪底层对象的反射结果。底层反射、`in` 与严格相等语义见 [`../semantics/12-interfaceSemantics.md`](../semantics/12-interfaceSemantics.md)；`Object.keys` 和 `Object.hasOwn` 的公开契约见[对象标准库](../../stdlib/4-object.md)。

checker 和控制流分析必须把接口可写有限键集合纳入别名副作用，不能依据原变量较窄形状错误消除反射路径。完整失效规则由 T58 定义。

## 动态检查

静态对象到接口转换由 checker 证明。`unknown` 到接口，以及接口到无法静态证明的更具体接口，必须使用 T44、T49 的受信布尔检查；成功分支得到目标接口，失败分支保留来源类型。

接口来源不需要先打包为 `unknown`。检查行为见 [`../semantics/12-interfaceSemantics.md`](../semantics/12-interfaceSemantics.md)，runtime 查询见 [`../../runtime/objects/7-interfaceRuntime.md`](../../runtime/objects/7-interfaceRuntime.md)。

判别字段、checker 证明的布尔谓词摘要、T44 的受信任类型检查和类的 `instanceof` 可以按 T24 收窄到能够静态转换为目标接口的类型。用户声明的 `value is T` 谓词仍不受支持。

## 声明合并与插件扩展

Nxts 不支持 TypeScript 的同名接口声明合并。相同作用域中的重复接口名称产生编译错误，接口也不能与类型别名或类在类型空间中同名合并。

以下扩充能力均不支持：

- 全局接口扩充。
- 跨文件同名接口合并。
- `declare module` 模块扩充。
- 插件隐式修改宿主已有接口。

编译期插件通过导出独立扩展接口，由应用入口显式多继承组合：

```ts
interface Request {
  url: string;
}

interface AuthExtension {
  readonly auth: AuthContext;
}

interface AppRequest extends Request, AuthExtension {}
```

运行时插件使用独立的类型化能力注册表或字典，其动态查询与存储成本由对应插件和标准库能力明确承担，不能污染普通接口 witness 和固定对象字段访问。

## 接口交叉

只由接口契约组成的交叉类型生成组合接口契约，语义等价于多接口继承的成员组合：

```ts
type NamedEntity = Named & Entity;
```

组合使用本规范的成员冲突规则，并生成接口视图，不生成精确对象。交叉中只要包含精确对象形状，T22 先得到唯一精确形状，再检查它是否满足全部接口约束；接口不会向该形状隐式添加字段。满足时保留该精确形状，不满足时归一为 `never` 或产生对应成员诊断。

该规则使 `interface Combined extends A, B {}` 与纯接口 `A & B` 具有相同契约成员，但精确对象交叉仍保持 T22 的固定布局语义。

## 跨模块身份与 ABI

结构相同的接口必须得到同一规范契约身份，声明和继承顺序不参与身份。成员变化必须重新执行结构兼容检查。

契约指纹、槽位排序、泛型配方、witness 版本和链接拒绝由 [`../../compiler/abi/1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义。ABI 不匹配时不能在运行时逐项适配。

## 编译器职责

checker 展平继承、检测循环与冲突、规范化契约、执行结构化实现检查并选择转换类别。泛型实例化替换参数、检查约束并缓存规范契约实例。

结构匹配和递归比较使用规范 TypeId、成员索引、缓存与确定预算；耗尽时不能删除成员、假定兼容或改用动态扫描。具体 checker 预算见 [`../../compiler/frontend/5-checkerSemanticModel.md`](../../compiler/frontend/5-checkerSemanticModel.md)，其他阶段见 IR、runtime、T45–T47。

## 与 TypeScript 的兼容性

Nxts 保持 TypeScript 的接口声明语法、结构化实现、多继承、属性、可选属性、`readonly`、普通方法、泛型接口和可选 `implements`。通过 Nxts checker 的接口源码，在提供 Nxts 标准类型声明后也应通过 TypeScript 类型检查。

主要差异如下：

| 场景               | TypeScript                                 | Nxts                                          |
| ------------------ | ------------------------------------------ | --------------------------------------------- |
| 接口与对象类型别名 | 大部分结构场景近似等价。                   | 接口是多态契约，类型别名对象是精确布局。      |
| 声明合并与模块扩充 | 支持同名合并和开放式扩充。                 | 全部拒绝，扩展接口显式组合。                  |
| 方法参数方差       | 方法参数包含历史双变宽松行为。             | 使用严格逆变。                                |
| 接口方法级泛型     | 支持。                                     | 支持闭合实例和链接期固定 witness 槽位。       |
| 原生标量结构实现   | 基于 JavaScript 包装成员进行结构检查。     | 默认拒绝，避免隐藏装箱。                      |
| symbol 成员        | 支持 symbol 计算属性。                     | 当前不支持。                                  |
| 索引签名转换       | 普通接口缺少索引签名时不能赋给索引签名。   | 保持相同边界；必须在接口中显式声明。          |
| 接口运行时表示     | 类型擦除，值继续使用 JavaScript 动态对象。 | 使用静态 witness 接口视图，普通对象布局不变。 |
| 接口转精确对象     | 宽结构赋值通常允许。                       | 拒绝，必须明确构造目标形状。                  |
| 混合可调用对象接口 | 可以组合调用、构造和属性签名。             | 拒绝；函数与元数据使用带方法的普通接口表达。  |

这些差异缩小 Nxts 的源码接受范围。接口可选属性写入、对象身份和反射保持 JavaScript 可观察行为；内部 witness 和扩展记录不能改变程序结果。

## 依赖边界

| 相关能力              | T29 已确定内容                                               | 对应能力负责内容                                   |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| T02–T04 类型关系      | 接口是结构化契约，具体对象单向转换为接口，接口不是精确对象。 | 规范身份、公共兼容类别和公共上界计算。             |
| T22 交叉类型          | 纯接口交叉产生组合契约，混入精确对象产生精确形状。           | 一般交叉归一化、联合分配和复杂度预算。             |
| T26–T27 对象          | 接口视图保留底层对象身份、权限和真实反射结果。               | 具体字段、存在位、枚举顺序、固定布局和只读规则。   |
| T30 字典类型          | 普通接口只包含有限静态成员；索引签名必须显式声明。           | 索引签名、动态键、字典 witness 和任意键扩展表。    |
| T31 递归类型          | 成员引用递归合法，继承循环非法。                             | 符号图等价、惰性实例、增长诊断、布局和 GC 回边。   |
| T32–T33、T37 函数泛型 | 支持普通方法和方法级泛型，动态调用使用固定专门化槽位。       | 函数兼容、泛型实例、可选方法、重载和调用 ABI。     |
| T36–T38 类泛型        | `implements` 只检查实例侧，泛型接口实例必须具体化。          | 类可见性、覆盖、方差、单态化和代码体积。           |
| T43–T44 类型转换      | 静态接口打包不失败；普通 `as` 不建立接口视图。               | checked API、失败模型和转换 IR。                   |
| T45–T47 表示          | 接口目标为紧凑视图、共享 witness 和对象附属扩展记录。        | 精确机器布局、GC 扫描、ABI 编码和链接校验。        |
| T49 标准库            | 内建引用类型只有标准库明确提供时才实现接口。                 | 内建 witness、checked 工具和插件能力注册表。       |
| T50–T58 使用点        | 接口操作保留底层身份，反射与别名副作用必须可见。             | 运算、访问、赋值、调用、模块、接收者和副作用失效。 |

## 诊断与测试

至少覆盖以下场景：

| 场景                            | 预期                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| 同结构不同名接口                | 规范身份相同并可共享契约元数据。                           |
| 接口与同成员精确对象            | 不相等；具体对象可以 `InterfacePack` 为接口。              |
| 具体对象包含额外成员            | 可以实现接口。                                             |
| 接口隐式转精确对象              | 编译错误；检查底层精确身份使用 T44，否则明确构造目标对象。 |
| 多接口继承                      | 展平为规范契约，不产生运行时继承链。                       |
| 完全相同的继承成员              | 合并为单一成员。                                           |
| 只读属性安全收窄                | 接受。                                                     |
| 可写属性类型变化                | 不满足双向安全时编译错误。                                 |
| 必选改可选或可写改只读          | 编译错误并显示继承路径。                                   |
| 继承循环                        | 编译错误，不建立部分契约。                                 |
| 重复接口声明或模块扩充          | 编译错误，不执行声明合并。                                 |
| 普通对象和类结构化实现          | 静态检查契约并接受接口转换。                               |
| 缺失可选属性的接口转换          | 接受。                                                     |
| 写入缺失可选属性                | 类型允许时接受。                                           |
| 接口进入字典位置                | 只有显式索引签名时接受，并使用 T30 字典 witness。          |
| 接口方法调用                    | 按接口方法签名检查参数和结果。                             |
| 方法级泛型                      | 调用点必须得到闭合类型实参。                               |
| 泛型接口实例                    | 每个规范实参组合得到稳定契约身份。                         |
| 原生标量实现接口                | 没有内建 witness 时编译错误，不装箱。                      |
| `new Interface` / `instanceof`  | 编译错误：接口名称仅存在于类型空间。                       |
| `unknown` 或接口 checked 转接口 | 成功分支得到目标接口类型，失败保留来源类型。               |
| 纯接口交叉                      | 生成组合接口契约。                                         |
| 接口与精确对象交叉              | 精确形状满足契约时保留，否则得到 `never`。                 |
| 跨模块相同契约                  | 得到相同规范结构契约身份。                                 |
| 复杂度预算耗尽                  | 明确资源诊断，不删成员、不动态化、不运行时扫描。           |

对象身份、反射、witness、扩展记录、去虚化和 ABI 测试由接口语义、runtime、IR 与 T45–T47 覆盖。
