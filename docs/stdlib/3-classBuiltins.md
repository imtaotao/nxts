# 类内建能力

- 来源能力：T36
- 规范状态：部分定稿
- 文档顺序：3

## 目标与边界

本规范记录 T36 已确认的可继承内建类型和类实例默认标准能力。最终白名单、标准声明、模块路径和 intrinsic 身份由 T49 定稿。

## 内建类型继承

普通内建类型默认不可继承。数组、Map、Promise 和其他具有专用布局或运行时协议的类型不能作为用户类基类。

`Error` 必须支持用户派生类：

```ts
class ParseError extends Error {}
```

可继承内建类型由编译器可信标记形成封闭白名单，用户声明不能伪造。Nxts 不支持 `Symbol.species`；内建方法返回类型由静态声明决定，不根据派生构造器动态替换。

`extends null`、动态内建构造器和未列入白名单的内建继承均编译错误。

## 默认对象能力

无显式基类的类不继承隐藏的用户可见 `Object` 根类，也不为完整 `Object.prototype` 增加实例字段或通用方法表。

未显式实现 `toString(): string` 的类实例返回固定结果 `"[object Object]"`。类可以显式覆盖同签名方法。

`Object.keys`、`Object.hasOwn` 等只有在 T49 明确提供时才属于支持 API。未支持的 `hasOwnProperty`、`valueOf`、`isPrototypeOf`、`propertyIsEnumerable`、`__proto__` 和原型反射操作编译错误。

`instanceof Object` 是否开放由 T24 与 T49 共同确定，不要求类实例继承隐藏根描述符。

## T49 待确认项

- 除 `Error` 外的可继承内建类型白名单。
- `Error` 的标准字段、构造签名和堆栈信息能力。
- `Object.keys`、`Object.hasOwn` 等方法的最终声明与适用类型。
- 类默认 `toString` 的 intrinsic 身份。
