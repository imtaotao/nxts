# 垃圾回收

本目录定义 GC 描述符、精确扫描、回收算法、写屏障、安全点、弱引用和性能目标。

GC 消费 `compiler/representation` 产生的引用形状，不重新决定对象字段布局。

## 文档

- [`1-gcTypeDescriptors.md`](./1-gcTypeDescriptors.md)：T46 GC 类型描述与扫描契约，当前处于讨论中。
