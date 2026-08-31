// 元组按位置固定长度和偏移；具体数组 rest 只能有一段，optional 也必须在 rest 前。
// 两段 number[] rest 或 rest 后再 optional，后面的下标无法编译期钉死。
// 泛型 [...T, ...U] 仍可能是有限元组拼接，交给 T41。
// ok: type T = [number, ...string[]]
// ok: type T = [number, string?]
// ok: type T = [...string[], number]
// no: type T = [...number[], string, ...boolean[]]
// no: type T = [...number[], string?]

import { isArray } from "aidly";
import type { Node } from "@babel/types";
import type { Rule } from "../../types";
import { rejectNode } from "../rejectNode";

const isOptionalElement = (node: Node) =>
  node.type === "TSOptionalType" ||
  (node.type === "TSNamedTupleMember" && node.optional === true);

const unwrapRestAnnotation = (annotation: Node) => {
  let inner = annotation;
  if (inner.type === "TSNamedTupleMember") {
    inner = inner.elementType;
  }
  if (inner.type === "TSTypeOperator" && inner.operator === "readonly") {
    inner = inner.typeAnnotation;
  }
  return inner;
};

const restInner = (node: Node) => {
  if (node.type !== "TSRestType") {
    return null;
  }
  return unwrapRestAnnotation(node.typeAnnotation);
};

const isConcreteArrayRest = (node: Node) => {
  const inner = restInner(node);
  if (inner == null) {
    return false;
  }
  if (inner.type === "TSArrayType") {
    return true;
  }
  return (
    inner.type === "TSTypeReference" &&
    inner.typeName.type === "Identifier" &&
    (inner.typeName.name === "Array" || inner.typeName.name === "ReadonlyArray")
  );
};

export const tupleRestRule: Rule = {
  name: "tupleRest",
  check: (node) => {
    if (node.type !== "TSTupleType" || !isArray(node.elementTypes)) {
      return null;
    }
    let seenRest = false;
    let concreteRests = 0;
    for (const element of node.elementTypes) {
      if (element.type === "TSRestType") {
        seenRest = true;
        if (isConcreteArrayRest(element)) {
          concreteRests += 1;
          if (concreteRests >= 2) {
            return rejectNode(element, "NXT1001", "parser.tupleRest");
          }
        }
        continue;
      }
      if (seenRest && isOptionalElement(element)) {
        return rejectNode(element, "NXT1001", "parser.tupleRest");
      }
    }
    return null;
  },
};
