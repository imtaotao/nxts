# 运行时对象

本目录定义字符串、数组、对象、字典、类实例、接口值和动态值的 runtime 支持。

Runtime 对象规范只定义分配、增长、哈希、描述符查询、反射辅助和其他运行时算法。静态类型规则归 `language/types`，用户可观察行为归 `language/semantics`，物理字段布局归 `compiler/representation`，GC 扫描归 `runtime/gc`。

文档中的结构示意只表达算法需要的逻辑信息，不固定字段顺序、字宽、对齐或对象头；物理结构始终以 [`compiler/representation`](../../compiler/representation/index.md) 为唯一来源。

不需要 runtime helper 的静态类型不建立对应 runtime 文档。

## 文档

- [`1-stringRuntime.md`](./1-stringRuntime.md)：字符串创建、索引、比较、哈希、拼接和格式化。
- [`2-arrayRuntime.md`](./2-arrayRuntime.md)：普通数组的分配、扩容、截断和批量操作。
- [`3-objectRuntime.md`](./3-objectRuntime.md)：固定对象描述符、可选状态、枚举和按需扩展。
- [`4-dictionaryRuntime.md`](./4-dictionaryRuntime.md)：原生哈希表、对象字典视图、扩容和扩展状态。
- [`5-classRuntime.md`](./5-classRuntime.md)：类实例、描述符、方法派发和动态类物化。
- [`6-dynamicRuntime.md`](./6-dynamicRuntime.md)：动态打包、类型描述关系和受信类型检查。
- [`7-interfaceRuntime.md`](./7-interfaceRuntime.md)：接口 witness、有限可选属性扩展和动态契约查询。
