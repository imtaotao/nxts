import type { Node } from "@babel/types";
import type { Diagnostic } from "../types";

export function rejectNode(node: Node, code: string, messageId: string) {
  return {
    code,
    messageId,
    arguments: [],
    phase: "parser",
    severity: "error",
    primarySpan: {
      fileId: 0,
      sourceVersion: 0,
      start: node.start ?? 0,
      end: node.end ?? 0,
    },
  } satisfies Diagnostic;
}
