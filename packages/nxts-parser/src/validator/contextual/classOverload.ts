// 类方法重载也是源码顺序上的紧邻组，实现必须在最后。
// 中间插入其他成员会拆开组，Checker 无法把签名和实现收成一个槽。
// 显式 declare / abstract 由对应规则处理；函数重载交给 overloadDeclare。
// ok: class A { m(a: number): void; m(a: string): void; m(a: number | string) {} }
// no: class A { m(a: number): void; n() {} m(a: number) {} }

import { isArray } from "aidly";
import type { Node } from "@babel/types";
import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

const memberName = (node: Node) => {
  if (node.type !== "TSDeclareMethod" && node.type !== "ClassMethod") {
    return null;
  }
  const key = node.key;
  if (key.type === "Identifier") {
    return key.name;
  }
  if (key.type === "StringLiteral") {
    return key.value;
  }
  if (key.type === "NumericLiteral") {
    return String(key.value);
  }
  return null;
};

const visibility = (node: Node) => {
  if (node.type !== "TSDeclareMethod" && node.type !== "ClassMethod") {
    return "public";
  }
  if (node.accessibility === "private" || node.accessibility === "protected") {
    return node.accessibility;
  }
  return "public";
};

const isAmbientMember = (node: Node) =>
  ("declare" in node && node.declare === true) ||
  ("abstract" in node && node.abstract === true);

const readMember = (node: Node) => {
  if (
    (node.type !== "TSDeclareMethod" && node.type !== "ClassMethod") ||
    isAmbientMember(node)
  ) {
    return null;
  }
  const name = memberName(node);
  if (name == null) {
    return null;
  }
  return {
    name,
    computed: node.computed === true,
    static: node.static === true,
    kind: node.kind,
    async: node.async === true,
    generator: node.generator === true,
    visibility: visibility(node),
    impl: node.type === "ClassMethod",
  };
};

const sameGroup = (
  left: NonNullable<ReturnType<typeof readMember>>,
  right: NonNullable<ReturnType<typeof readMember>>,
) =>
  left.name === right.name &&
  left.computed === right.computed &&
  left.static === right.static &&
  left.kind === right.kind &&
  left.async === right.async &&
  left.generator === right.generator &&
  left.visibility === right.visibility;

export const classOverloadRule: Rule = {
  name: "classOverload",
  check: (node, ctx) => {
    if (node.type !== "TSDeclareMethod" || isAmbientMember(node)) {
      return null;
    }
    const parent = ctx.parent;
    if (parent?.type !== "ClassBody" || !isArray(parent.body)) {
      return rejectNode(node, "NXT1001", "parser.classOverload");
    }
    const current = readMember(node);
    if (current == null) {
      return rejectNode(node, "NXT1001", "parser.classOverload");
    }
    const body = parent.body as Node[];
    const index = body.indexOf(node);
    if (index < 0) {
      return rejectNode(node, "NXT1001", "parser.classOverload");
    }
    for (let i = index + 1; i < body.length; i++) {
      const next = readMember(body[i]);
      if (next == null || !sameGroup(current, next)) {
        return rejectNode(node, "NXT1001", "parser.classOverload");
      }
      if (next.impl) {
        return null;
      }
    }
    return rejectNode(node, "NXT1001", "parser.classOverload");
  },
};
