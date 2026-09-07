# @nxts/checker

消费 `bindProgram` 结果。公开入口只有 `checkProgram`。

当前只 hang：把能确定的类型写法和声明收成图鉴 `TypeId`，写入 `symbolTypes` / `nodeTypes`。不查赋值、不推导、不收窄、不求常量。`complete` 为 `false`。

## 任务

按模块从大到小。`[x]` 已接到 `checkProgram` 或能独立调用；`[ ]` 还空着。当前可开工的最小切片是 Check 的有注解初值。

### 图鉴与底座

- [x] `TypeId` / `TypeTable` / `typeKey`
- [x] `TypeShape` 图鉴种类（原子、字面量、对象、名义类型等）
- [ ] `ErrorType`（只内部抑制连锁，不进公开 `types[]`）
- [ ] `Brand<T, Tag>`（等 T49 标准环境身份）

### Hang

类型写法 / 名义声明 → `TypeId`。`checkProgram` 在类型/值之间转不动点。

- [x] 原子、字面量、数组、元组、对象、联合、交叉
- [x] 函数、构造、别名、class / interface / enum、泛型默认实例
- [x] `keyof`、`T[K]`、条件 / infer / mapped、闭合模板
- [x] 双索引 dictionary、`extends Named<T>`、类实例字段侧表、有注解解构
- [x] 已挂钩值的 `typeof`（含属性链、`typeof Class`、`typeof Enum.Member`）
- [x] `const` 上的 `unique symbol`、跨文件 import 抄 `TypeId`
- [ ] 无注解 `typeof`、`const x = Symbol()`（等 Infer / T05）
- [ ] 分支里的 `typeof`、`x is T`（等 Flow / T06）
- [ ] `typeof Enum` 命名空间、`this`、`import('x')`、对象 rest、开放模板
- [ ] 数组 / 类方法进 `keyof`、字典再带调用 / 构造

### Relation

- [x] `equal` / `assignable`（只给 true / false）
- [x] 字面量、联合 / 交叉、精确对象、对象→接口、接口互赋
- [x] 数组 / 元组、对象 / 数组进字典、函数 / 构造（含重载、`this` 接收者）
- [ ] 类→基类、类→接口
- [ ] `subtype` 独立查询、NoOp / Pack、只读元素协变

### Check

走 AST 查这次使用。未接。

- [ ] 有注解初值 `const n: T = e`（用已有 `assignable`）
- [ ] 表达式、成员 / 索引、调用 / `new`、语句
- [ ] `this` / `super`（等 T56）

### Infer

- [ ] 缺注解初值、实参、上下文推导（T05 已定，等 Check 走初始化器）

### Flow

- [ ] 收窄 / 合流（等 Check 走分支）
- [ ] 确定赋值
- [ ] 穷尽（等收窄能排除成员）

### Const

- [ ] 编译期求值、提交到目标类型、算术 / 字符串（位数预算仍归第 6 篇）

### 诊断与结果

- [ ] `catalog` / `createDiagnostic`（第一次赋值不兼容时接上）
- [ ] `TypeDisplay`（诊断不写 `TypeId`）
- [ ] `nodeReachable` / `nodeConstants` 实填
- [ ] `complete: true`

### Effect

- [ ] 闭包捕获、副作用（等 T58 / `7-effectAnalysis.md`）

## 目录

```text
src/
  index.ts              对外导出 checkProgram
  checkProgram.ts       hangTypes / hangValues 不动点
  types.ts              TypeId、TypeShape、结果形状
  catalog.ts            NXT3xxx / NXT4xxx（未接）
  context.ts            一次检查：图鉴 + 各文件 Hang

  core/                 底座：只对 TypeId 干活
    typeTable.ts        驻留、去重
    typeKey.ts          规范键
    relation/           可赋值
      index.ts          equal、assignable、按 kind 分派
      object.ts         精确对象、对象→接口、接口互赋
      collection.ts     数组、元组
      dictionary.ts     对象/数组进字典、字典只读视图
      function.ts       函数、构造
    infer.ts            缺注解推导（未接）
    error.ts            ErrorType（未接）

  hang/                 类型写法 / 名义声明 → TypeId
    index.ts            typeOfTypeSymbol、resolveAtomType、hangNode、instantiate
    resolve/            类型 AST → TypeId
    intern.ts           class / interface / enum / 类型参数
    instantiate.ts      Foo<i32>
    lookup.ts           keyof / T[K]
    match.ts            条件 extends / infer
    classBody.ts        类实例字段侧表
    pattern.ts          有注解的解构
    ast.ts              剥注解、取类型参数

  decl/                 扫声明，问 hang
    alias.ts            type 别名
    interface.ts        interface
    class.ts            class
    enum.ts             enum
    generic.ts          类型参数
    variable.ts         const / let
    function.ts         函数（有注解才挂）

  link/
    import.ts           ModuleLink → 对方 TypeId
    builtin.ts          builtinId → 原子类型

  check/                走 AST 查这次使用（未接）
    expr.ts             运算符、字面量
    access.ts           成员、索引
    assign.ts           赋值、解构
    call.ts             调用、new
    stmt.ts             if / 循环 / return
    this.ts             this / super

  flow/                 控制流（未接）
    narrow.ts           收窄、合流
    assign.ts           确定赋值
    exhaust.ts          穷尽

  const/                编译期求值（未接）
    eval.ts             子节点都是常量才算
    commit.ts           提交到目标类型
    number.ts           算术、比较
    string.ts           拼接、索引

  effect/
    capture.ts          闭包捕获、副作用（未接）
```
