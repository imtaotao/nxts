# 运行时基础值

本目录定义不归普通对象容器管理的基础值、函数值和多态函数机制。其环境对象等内部引用仍服从表示与 GC 规范。

文档中的结构示意只表达 runtime 调用所需的逻辑信息，不固定字段顺序、字宽或调用 ABI；物理表示与跨模块调用分别由 [`compiler/representation`](../../compiler/representation/index.md) 和 [`compiler/abi`](../../compiler/abi/index.md) 定义。

## 文档

- [`1-symbolRuntime.md`](./1-symbolRuntime.md)：symbol 身份分配与模块值传递。
- [`2-functionRuntime.md`](./2-functionRuntime.md)：函数身份、描述符与类型化调用入口。
- [`3-polymorphicFunctionRuntime.md`](./3-polymorphicFunctionRuntime.md)：一等泛型函数与接口泛型方法的固定专门化槽位。

## 规划文档

- `4-closureRuntime.md`：T58 捕获环境、逃逸和闭包调用。
- `5-generatorRuntime.md`：T60 同步与异步生成器状态。
