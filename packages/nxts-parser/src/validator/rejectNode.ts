import type { Node } from '@babel/types';
import { createDiagnostic, type MessageId } from '../diagnostics/catalog';
import type { RuleContext } from '../types';

export function rejectNode(node: Node, ctx: RuleContext, messageId: MessageId) {
  ctx.invalidNodes.add(node);
  return createDiagnostic(messageId, {
    fileId: ctx.fileId,
    sourceVersion: ctx.sourceVersion,
    start: node.start ?? 0,
    end: node.end ?? 0,
  });
}
