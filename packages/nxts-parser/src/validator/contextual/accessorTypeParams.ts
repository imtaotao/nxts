// get x<T>() 看起来像方法泛型，但读是 obj.x，写是 obj.x = v。
// 没有调用、没有实参，也没有 obj.x<T>，T 无法实例化，属性类型也不能每次读写都变。
// 泛型挂在类上：class A<T> { get x(): T }。
// ok: class A<T> { get x(): T { return this.v } }
// no: class A { get x<T>(): T { return this.v } }
// no: class A { set x<T>(v: T) {} }

import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

export const accessorTypeParamsRule: Rule = {
  name: "accessorTypeParams",
  check: (node, ctx) => {
    if (
      (node.type === "ClassMethod" || node.type === "ClassPrivateMethod") &&
      (node.kind === "get" || node.kind === "set") &&
      node.typeParameters
    ) {
      return rejectNode(node, ctx, "parser.accessorTypeParams");
    }
    return null;
  },
};
