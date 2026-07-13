# 编译器

本目录定义 Nxts 编译器各阶段的输入、输出、职责和依赖边界。

| 子系统   | 职责                                       | 入口                                          |
| -------- | ------------------------------------------ | --------------------------------------------- |
| 前端     | Parser、AST 验证、Binder、Checker 和诊断   | [`frontend`](./frontend/index.md)             |
| IR       | Checked HIR、Layout IR 和阶段不变量        | [`ir`](./ir/index.md)                         |
| 表示规划 | 类型布局、tag、niche、描述符和 GC 形状     | [`representation`](./representation/index.md) |
| 优化器   | 中端分析、转换、逃逸分析和成本约束         | [`optimizer`](./optimizer/index.md)           |
| 后端     | 目标代码生成、目标相关 lowering 和产物生成 | [`backend`](./backend/index.md)               |
| ABI      | 调用约定、跨模块元数据、版本和链接校验     | [`abi`](./abi/index.md)                       |
