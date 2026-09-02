# `null` 与 `undefined` 类型

- 覆盖能力：T14
- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：10

## 目标与边界

本规范定义 `null`、`undefined` 的类型身份、赋值兼容、比较收窄及空值相关表达式的结果类型。

用户可观察的短路、求值顺序、默认值和缺失值行为见 [`../semantics/3-nullishSemantics.md`](../semantics/3-nullishSemantics.md)。空值联合的 niche、tag、容器元素布局、GC 形状与抽象 ABI 见 [`../../compiler/representation/1-typeRepresentation.md`](../../compiler/representation/1-typeRepresentation.md)。

## 类型身份

`null` 与 `undefined` 是两个独立的单例类型：

- `null` 表示显式提供的空值。
- `undefined` 表示未提供或不存在。
- 两者不能互相隐式转换。
- 保留 `undefined` 不允许读取未初始化变量；确定赋值分析独立于内存零状态。

## 赋值兼容

类型系统采用与 TypeScript `strictNullChecks` 一致的显式空值联合：

```ts
let name: string = undefined; // 编译错误
let optionalName: string | undefined = undefined; // 合法
```

`null` 和 `undefined` 不能隐式赋给不包含对应成员的目标类型。需要接受空值或缺失值时，必须显式写出对应联合成员。

## 严格比较与收窄

空值比较只支持 `===` 和 `!==`：

```ts
function read(value: string | null | undefined) {
  if (value !== null && value !== undefined) {
    value; // string
  }
}
```

| 条件                  | 成立分支           | 不成立分支         |
| --------------------- | ------------------ | ------------------ |
| `value === null`      | 收窄为 `null`      | 排除 `null`        |
| `value !== null`      | 排除 `null`        | 收窄为 `null`      |
| `value === undefined` | 收窄为 `undefined` | 排除 `undefined`   |
| `value !== undefined` | 排除 `undefined`   | 收窄为 `undefined` |

另一侧静态类型不包含被比较的空值成员时仍允许比较，结果为可常量折叠的 `boolean`，但不产生新的收窄事实：

```ts
null === undefined; // false

function isMissing(value: string) {
  return value === null; // false
}
```

该防御性规则只适用于与 `null` 或 `undefined` 的严格比较，不扩展为普通类型之间的跨类型比较。`==` 和 `!=` 不是 Nxts 支持的运算符。

完整控制流规则见 [`6-typeNarrowing.md`](./6-typeNarrowing.md)。

## `typeof` 收窄

`typeof value` 的结果类型是对应字符串字面量联合。空值相关规则为：

- `typeof value === "undefined"` 可以把显式包含 `undefined` 的联合收窄到 `undefined`。
- `typeof value === "object"` 不能排除 `null`。
- `typeof value === undefined` 是类型错误，因为右侧不是字符串。
- 标识符即使只出现在 `typeof` 中也必须先完成名称绑定。

```ts
typeof value === undefined; // 编译错误
typeof value === 'undefined'; // 合法
value === undefined; // 合法
```

Nxts 不继承 JavaScript 对 `typeof undeclaredName` 的动态未绑定名称特例。目标宿主可选能力必须通过 T48、T49 和 T55 定义的静态绑定入口提供。

## 空值合并结果类型

设 `left ?? right` 两侧类型分别为 `L` 和 `R`，`NonNullish(L)` 表示排除 `null` 与 `undefined`，结果类型为：

```text
lub(NonNullish(L), R)
```

其中 `lub` 使用 T04 的最小公共上界与联合规范化规则：

```ts
function examples(
  name: string | null,
  count: i32 | undefined,
  value: string | null,
) {
  const displayName = name ?? 'default'; // string
  const normalizedCount = count ?? 0; // i32
  const result = value ?? 10; // string | number
}
```

左侧静态确定不含空值时，结果类型为 `L`；左侧静态确定只含空值时，结果类型为 `R`。这两种情况不改变语义规范要求的求值顺序。

## 可选链结果类型

设可选段左侧类型为 `B`，checker 先使用 `NonNullish(B)` 检查普通成员访问、索引访问或调用是否合法：

- `B` 包含空值成员时，结果为正常操作结果与 `undefined` 的最小公共上界。
- `B` 不含空值成员时，结果与普通操作相同，不额外加入 `undefined`。
- `NonNullish(B)` 不包含有效接收者，或普通操作本身不合法时，编译错误。

```ts
function examples(
  user: User | null,
  fixedUser: User,
  profile: { name: string | null } | undefined,
) {
  const name = user?.name; // User.name 的类型 | undefined
  const fixedName = fixedUser?.name; // User.name 的类型
  const profileName = profile?.name; // string | null | undefined
}
```

可选链只处理空值，不绕过成员、索引与调用检查。

## 缺失值类型

可选参数、可选属性与默认参数使用 `undefined` 表示缺失状态，不隐式改写为 `null`。

- 可选参数 `value?: T` 在函数体内是 `T | undefined`。
- 可选属性读取结果包含 `undefined`。
- 属性缺失与属性存在但值为 `undefined` 在类型值上都可读为 `undefined`，存在性差异由对象语义保留。
- 省略参数与显式传入 `undefined` 使用相同的 `undefined` 类型状态。
- `null` 只有在参数类型显式接受时才合法。

数组空位不受本规范授权；数组是否允许空位由 T34 定义。

## Checker 职责

checker 必须：

1. 为两个空值建立不同的规范类型身份。
2. 执行严格空值赋值兼容和联合规范化。
3. 生成空值比较、`typeof`、`??` 与可选链的收窄事实和结果类型。
4. 在进入布局阶段前保留空值成员身份，不根据预计位模式合并类型。
5. 拒绝未初始化读取和只存在于 `typeof` 中的未绑定名称。

checker 不选择 niche、tag、字段偏移、GC 描述或 LLVM 类型。

## 与 TypeScript / JavaScript 的差异

| 场景                | TypeScript strict / JavaScript           | Nxts                         |
| ------------------- | ---------------------------------------- | ---------------------------- |
| 严格空值类型        | TypeScript 显式区分。                    | 对齐 TypeScript strict。     |
| `== null`           | 可以同时匹配两个空值。                   | 不支持 `==`、`!=`。          |
| `typeof` 未绑定名称 | JavaScript 返回 `"undefined"`。          | 静态绑定失败并编译报错。     |
| 内部表示            | TypeScript 擦除，JavaScript 使用动态值。 | 按闭合静态类型选择专用表示。 |

Nxts 缩小了 TypeScript strict 的接受范围，但不为已接受的相同 JavaScript 表达式定义相反的结果。

## 诊断与类型测试

至少覆盖：

| 场景                                 | 预期结果                                |
| ------------------------------------ | --------------------------------------- |
| 空值赋给非空目标                     | 编译错误。                              |
| 两个空值分别参与联合与收窄           | 成员身份保持独立。                      |
| 防御性严格空值比较                   | 合法并得到常量 `boolean`，不错误收窄。  |
| `typeof value === undefined`         | 编译错误并提示字符串或直接比较。        |
| `typeof undeclaredName`              | 名称绑定错误。                          |
| `??` 与可选链的多层联合              | 按 `NonNullish` 和 `lub` 得到规范类型。 |
| 未初始化的 `T \| undefined` 局部变量 | 赋值前读取仍为编译错误。                |

## 依赖关系

- T04 提供 `lub` 与联合规范化基础。
- T06 提供控制流收窄和确定赋值。
- T21 提供一般联合成员操作。
- T23 与 T45 定义空值联合的规范表示。
- T32、T50–T53 定义参数、运算符、访问和调用位置的完整检查。
