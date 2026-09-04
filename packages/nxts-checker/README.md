# @nxts/checker

消费 `bindProgram` 结果，给符号和表达式挂 `TypeId`，检查这次使用是否合法。公开入口只有 `checkProgram`。

```text
src/
  index.ts              对外导出 checkProgram
  checkProgram.ts       一次程序检查的编排入口
  types.ts              TypeId、诊断、结果形状
  catalog.ts            NXT3xxx / NXT4xxx
  context.ts            一次检查的工作区

  core/                 底座：只对 TypeId 干活
    typeTable.ts        驻留、规范化
    relation.ts         相等、赋值兼容
    infer.ts            缺注解时推导
    error.ts            ErrorType

  hang/                 给符号和节点挂 TypeId

  decl/                 扫声明，调用 hang
    variable.ts         const / let / 参数
    alias.ts            type 别名
    interface.ts        interface
    class.ts            class
    enum.ts             enum
    function.ts         函数、重载
    generic.ts          类型参数、实例化

  link/                 跨文件和环境
    import.ts           ModuleLink → 对方 TypeId
    builtin.ts          builtinId → 内建类型

  check/                走 AST
    expr.ts             运算符、字面量
    access.ts           成员、索引
    assign.ts           赋值、解构
    call.ts             调用、new
    stmt.ts             if / 循环 / return
    this.ts             this / super

  flow/                 控制流
    narrow.ts           收窄、合流
    assign.ts           确定赋值
    exhaust.ts          穷尽

  const/                编译期求值，写入 nodeConstants
    eval.ts             编排：子节点都是常量才算
    commit.ts           提交到目标类型
    number.ts           算术、比较
    string.ts           拼接、索引

  effect/
    capture.ts          闭包捕获、副作用
```
