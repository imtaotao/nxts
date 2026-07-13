# 一等泛型函数 Runtime

- 覆盖能力：T37
- 规范状态：已定稿
- 实现状态：未实现
- 最后更新：2026-07-28
- 文档顺序：3

## 目标与边界

本规范定义无法静态去虚化的一等泛型函数值和接口泛型方法的 runtime 调用路径。泛型推导与兼容由 [`24-generics.md`](../../language/types/24-generics.md) 定义，专门化需求与槽位 ABI 由 [`1-typeAbi.md`](../../compiler/abi/1-typeAbi.md) 定义。

## 多态函数值

一等泛型函数值使用固定大小逻辑表示：

```text
PolymorphicFunctionValue {
  stableIdentityOrEnvironment
  specializationTable
}
```

`specializationTable` 只包含最终程序静态可达的闭合调用签名，每个签名具有链接期确定的固定槽位。调用已选择的多态函数值时，执行一次固定槽位读取和一次间接调用。

该路径必须满足：

- 不根据类型进行哈希查找。
- 不携带调用点类型描述或泛型字典。
- 不使用 JIT 或运行时代码生成。
- 不装箱普通参数和返回值。
- 每次调用不分配内存。
- 全部专门化入口共享同一逻辑函数身份和闭包环境。

普通泛型函数、已知目标和可以去虚化的多态值不使用该表。

## 接口泛型方法

动态接口调用所需的闭合泛型方法实例作为固定槽位存放在 witness 描述中：

```text
Decoder witness
├─ ordinary method slots
├─ decode<User> slot
└─ decode<Config> slot
```

槽位集合来自链接期静态可达需求。接口值本身仍保持既定二字表示，不携带用户可读取的类型实参，也不为普通非泛型方法增加额外分派步骤。

## 身份与环境

实例化表达式和专门化入口选择不创建包装函数，不改变 `name`、`length` 或严格相等。闭包逃逸时，全部入口共享一个环境对象；环境布局与 GC 由 T58 定义。
