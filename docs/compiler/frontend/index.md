# 编译器前端

本目录定义源码解析、Babel AST 验证、名称绑定、类型检查、控制流分析、诊断和 Checked HIR 生成。

前端实现必须消费语言规范，不能通过内部便利扩大或收窄已定稿的语言规则。

## 文档规划

| 顺序 | 文档                                                       | 状态       | 职责                                      |
| ---- | ---------------------------------------------------------- | ---------- | ----------------------------------------- |
| 1    | [`1-frontendPipeline.md`](./1-frontendPipeline.md)         | 已定稿     | parser、validator、binder 和 checker 阶段 |
| 2    | [`2-babelAstContract.md`](./2-babelAstContract.md)         | 已定稿     | Babel AST 输入、NodeId 和规范化           |
| 3    | [`3-sourceAndDiagnostics.md`](./3-sourceAndDiagnostics.md) | 已定稿     | 源文件、位置、错误码和诊断恢复            |
| 4    | `4-nameBinding.md`                                         | 文档待建立 | T57 名称、作用域与声明绑定                |
| 5    | [`5-checkerSemanticModel.md`](./5-checkerSemanticModel.md) | 部分定稿   | TypeId、SymbolId、语义侧表和 checker 输出 |
| 6    | [`6-constantEvaluation.md`](./6-constantEvaluation.md)     | 部分定稿   | 编译期常量值、运算和资源边界              |
| 7    | `7-effectAnalysis.md`                                      | 文档待建立 | T58 捕获、别名副作用和收窄失效            |
