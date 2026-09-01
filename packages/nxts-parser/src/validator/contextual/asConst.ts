// as const 把字面量收成只读精确类型，要看见字面量本身才能钉死。
// 变量或调用上的 as const 没有可冻结的结构，会变成无检查断言。
// ok: const x = 1 as const
// ok: const x = [1, 2] as const
// no: const x = y as const
// no: const x = foo() as const

import type { Node } from "@babel/types";
import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

const isConstType = (node: Node) =>
  node.type === "TSTypeReference" &&
  node.typeName.type === "Identifier" &&
  node.typeName.name === "const";

const unwrap = (node: Node) => {
  let current = node;
  while (current.type === "ParenthesizedExpression") {
    current = current.expression;
  }
  return current;
};

const isNumericUnary = (node: Node) =>
  node.type === "UnaryExpression" &&
  (node.operator === "+" || node.operator === "-") &&
  unwrap(node.argument).type === "NumericLiteral";

const isDirectLiteral = (node: Node) => {
  const value = unwrap(node);
  return (
    value.type === "NumericLiteral" ||
    value.type === "StringLiteral" ||
    value.type === "BooleanLiteral" ||
    value.type === "NullLiteral" ||
    value.type === "TemplateLiteral" ||
    value.type === "ArrayExpression" ||
    value.type === "ObjectExpression" ||
    isNumericUnary(value)
  );
};

export const asConstRule: Rule = {
  name: "asConst",
  check: (node, ctx) => {
    if (
      node.type === "TSAsExpression" &&
      isConstType(node.typeAnnotation) &&
      !isDirectLiteral(node.expression)
    ) {
      return rejectNode(node, ctx, "NXT1001", "parser.asConst");
    }
    return null;
  },
};
