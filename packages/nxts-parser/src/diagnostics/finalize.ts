import type { SourceSnapshot } from '../snapshot';
import type { Diagnostic } from '../types';
import { createDiagnostic } from './catalog';

export const FILE_ERROR_BUDGET = 100;
export const FILE_OTHER_BUDGET = 100;

const severityRank = {
  error: 0,
  warning: 1,
  info: 2,
};

const argumentKey = (args: readonly unknown[]) => JSON.stringify(args);

const diagnosticKey = (diagnostic: Diagnostic) => {
  const span = diagnostic.primarySpan;
  return [
    diagnostic.code,
    diagnostic.severity,
    span.fileId,
    span.sourceVersion,
    span.start,
    span.end,
    diagnostic.messageId,
    argumentKey(diagnostic.arguments),
  ].join('\0');
};

const dedupDiagnostics = (diagnostics: Diagnostic[]) => {
  const seen = new Set<string>();
  const unique: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(diagnostic);
  }
  return unique;
};

const sortDiagnostics = (diagnostics: Diagnostic[]) => {
  return diagnostics
    .map((diagnostic, index) => ({ diagnostic, index }))
    .sort((left, right) => {
      const a = left.diagnostic;
      const b = right.diagnostic;
      if (a.primarySpan.start !== b.primarySpan.start) {
        return a.primarySpan.start - b.primarySpan.start;
      }
      if (a.primarySpan.end !== b.primarySpan.end) {
        return a.primarySpan.end - b.primarySpan.end;
      }
      if (severityRank[a.severity] !== severityRank[b.severity]) {
        return severityRank[a.severity] - severityRank[b.severity];
      }
      if (a.code !== b.code) {
        return a.code < b.code ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.diagnostic);
};

export function finalizeDiagnostics(
  diagnostics: Diagnostic[],
  snapshot: SourceSnapshot,
) {
  const sorted = sortDiagnostics(dedupDiagnostics(diagnostics));
  const errors = [];
  const others = [];
  for (const diagnostic of sorted) {
    if (diagnostic.severity === 'error') {
      errors.push(diagnostic);
    } else {
      others.push(diagnostic);
    }
  }

  let diagnosticsTruncated = false;
  const next: Diagnostic[] = [];
  if (errors.length > FILE_ERROR_BUDGET) {
    diagnosticsTruncated = true;
    next.push(...errors.slice(0, FILE_ERROR_BUDGET));
    next.push(
      createDiagnostic(
        'parser.budget.error',
        {
          start: 0,
          end: 0,
          fileId: snapshot.fileId,
          sourceVersion: snapshot.sourceVersion,
        },
        [FILE_ERROR_BUDGET],
      ),
    );
  } else {
    next.push(...errors);
  }

  if (others.length > FILE_OTHER_BUDGET) {
    diagnosticsTruncated = true;
    next.push(...others.slice(0, FILE_OTHER_BUDGET));
  } else {
    next.push(...others);
  }

  return { diagnostics: next, diagnosticsTruncated };
}
