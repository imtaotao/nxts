import type { CheckerDiagnostic } from './types';

export const messageCodes = {
  'checker.notAssignable': 'NXT3101',
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
    phase: 'checker',
    severity: 'error',
    code: messageCodes[messageId],
  } satisfies CheckerDiagnostic;
}
