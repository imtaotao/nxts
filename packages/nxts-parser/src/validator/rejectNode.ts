import type { Node } from "@babel/types";
import type { Diagnostic, RuleContext } from "../types";

export function rejectNode(
  node: Node,
  ctx: RuleContext,
  code: string,
  messageId: string,
) {
  return {
    code,
    messageId,
    arguments: [],
    phase: "parser",
    severity: "error",
    primarySpan: {
      fileId: ctx.fileId,
      sourceVersion: ctx.sourceVersion,
      start: node.start ?? 0,
      end: node.end ?? 0,
    },
  } satisfies Diagnostic;
}
