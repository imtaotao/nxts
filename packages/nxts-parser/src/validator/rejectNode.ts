import type { Node } from "@babel/types";
import type { Diagnostic } from "../types";

export function rejectNode(node: Node, code: string, messageId: string) {
  return {
    code,
    messageId,
    arguments: [],
    primarySpan: {
      start: node.start ?? 0,
      end: node.end ?? 0,
      fileId: 0,
      sourceVersion: 0,
    },
    severity: "error",
    phase: "parser",
  } satisfies Diagnostic;
}
