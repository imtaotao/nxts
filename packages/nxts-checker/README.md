# @nxts/checker

消费 `bindProgram` 结果。公开入口只有 `checkProgram`。

当前只 hang：把能确定的类型写法和声明收成图鉴 `TypeId`，写入 `symbolTypes` / `nodeTypes`。不查赋值、不推导、不收窄、不求常量。`complete` 为 `false`。

```text
src/
  index.ts              对外导出 checkProgram
  checkProgram.ts       先 hangTypes，再 hangValues
  types.ts              TypeId、TypeShape、结果形状
  catalog.ts            NXT3xxx / NXT4xxx（未接）
  context.ts            一次检查：图鉴 + 各文件 Hang

  core/                 底座：只对 TypeId 干活
    typeTable.ts        驻留、去重
    typeKey.ts          规范键
    relation.ts         现：TypeId 相等
    infer.ts            缺注解推导（未接）
    error.ts            ErrorType（未接）

  hang/                 类型写法 / 名义声明 → TypeId
    index.ts            typeOfTypeSymbol、resolveAtomType、hangNode
    resolve/            类型 AST → TypeId
    intern.ts           class / interface / enum / 类型参数
    instantiate.ts      Foo<i32>
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
