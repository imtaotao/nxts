# 语言语义

本目录定义值、表达式、语句、控制流、类、闭包、异常、异步和迭代的用户可观察行为。

本目录可以规定核心值与语言构造的结果、错误、身份和复杂度边界，但不定义物理布局、GC 算法、调用 ABI，也不定义标准 API 的存在性、签名或 API 专属行为；这些内容分别由编译器表示、runtime、ABI 和标准库规范负责。

## 已定稿规范

| 能力                   | 任务编号 | 规范文档                                                       |
| ---------------------- | -------- | -------------------------------------------------------------- |
| 数值语义               | T08–T11  | [`1-numericSemantics.md`](./1-numericSemantics.md)             |
| 字符串语义             | T13      | [`2-stringSemantics.md`](./2-stringSemantics.md)               |
| 空值与缺失值语义       | T14      | [`3-nullishSemantics.md`](./3-nullishSemantics.md)             |
| 对象语义               | T26–T27  | [`4-objectSemantics.md`](./4-objectSemantics.md)               |
| 字典语义               | T30      | [`5-dictionarySemantics.md`](./5-dictionarySemantics.md)       |
| 数组语义               | T34      | [`6-arraySemantics.md`](./6-arraySemantics.md)                 |
| 类语义                 | T36      | [`7-classSemantics.md`](./7-classSemantics.md)                 |
| 枚举值语义             | T39      | [`8-enumSemantics.md`](./8-enumSemantics.md)                   |
| 转换与动态检查语义     | T44      | [`9-conversionSemantics.md`](./9-conversionSemantics.md)       |
| 布尔与 truthiness 语义 | T07      | [`10-booleanSemantics.md`](./10-booleanSemantics.md)           |
| 特殊值语义             | T15–T18  | [`11-specialValueSemantics.md`](./11-specialValueSemantics.md) |
| 接口视图语义           | T29      | [`12-interfaceSemantics.md`](./12-interfaceSemantics.md)       |
| 函数值与调用语义       | T32–T33  | [`13-functionSemantics.md`](./13-functionSemantics.md)         |
| 元组值语义             | T35      | [`14-tupleSemantics.md`](./14-tupleSemantics.md)               |

## 规划规范

下表顺序已经按依赖调整，不按 T 编号机械排序：

| 顺序 | 能力                   | 任务编号 | 规划文档                      |
| ---- | ---------------------- | -------- | ----------------------------- |
| 15   | 闭包与捕获语义         | T58      | `15-closureSemantics.md`      |
| 16   | 同步异常语义           | T61      | `16-exceptionSemantics.md`    |
| 17   | 异步求值语义           | T59      | `17-asyncSemantics.md`        |
| 18   | 迭代与生成器语义       | T60      | `18-iteratorSemantics.md`     |
| 19   | 运算符求值语义         | T50      | `19-expressionSemantics.md`   |
| 20   | 成员与索引访问语义     | T51      | `20-accessSemantics.md`       |
| 21   | 赋值、解构与展开语义   | T52      | `21-assignmentSemantics.md`   |
| 22   | 调用与构造语义         | T53      | `22-callSemantics.md`         |
| 23   | 语句求值语义           | T54      | `23-statementSemantics.md`    |
| 24   | `this` 与 `super` 语义 | T56      | `24-thisAndSuperSemantics.md` |
