import type { BinderDiagnostic } from './types';

export const messageCodes = {
  'binder.unresolved': 'NXT2101',
  'binder.duplicate': 'NXT2102',
  'binder.unresolvedExport': 'NXT2103',
  'binder.ambiguousExport': 'NXT2104',
} as const;

export type MessageId = keyof typeof messageCodes;

export function createDiagnostic(
  messageId: MessageId,
  args: readonly unknown[] = [],
  span: {
    start: number;
    end: number;
    fileId: number;
    sourceVersion: number;
  },
) {
  return {
    messageId,
    primarySpan: span,
    arguments: args,
    phase: 'binder',
    severity: 'error',
    code: messageCodes[messageId],
  } satisfies BinderDiagnostic;
}
