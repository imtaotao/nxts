# 表示规划

本目录定义语义类型到机器布局、联合编码、接口视图、描述符和抽象 ABI 的映射。

- 覆盖能力：T45
- 规范状态：已定稿

## 文档

- [类型运行时表示](./1-typeRepresentation.md)

本目录是对象头、字段偏移、tag、niche、接口视图和 `LayoutRecord` 的唯一权威来源。Runtime 必须消费该布局，不能建立另一套对象表示。

GC 描述符编码与扫描机制归 [`runtime/gc`](../../runtime/gc/index.md)，跨模块稳定性归 [`compiler/abi`](../abi/index.md)，公开 API 归 [`stdlib`](../../stdlib/index.md)。
