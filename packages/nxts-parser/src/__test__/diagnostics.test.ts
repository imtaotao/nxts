import { describe, expect, it } from 'vitest';
import { diagnosticFromBabel } from '../diagnostics/babel';
import { createDiagnostic, messageCodes } from '../diagnostics/catalog';
import {
  FILE_ERROR_BUDGET,
  finalizeDiagnostics,
} from '../diagnostics/finalize';
import { parseFile } from '../index';
import { snapshotFromText } from './utils';

const span = {
  start: 0,
  end: 1,
  fileId: 1,
  sourceVersion: 1,
};

describe('diagnostics', () => {
  it('maps each messageId to a stable code', async () => {
    expect(messageCodes['parser.var']).toBe('NXT1101');
    expect(messageCodes['parser.any']).toBe('NXT1003');
    expect(messageCodes['parser.unsupported']).toBe('NXT1001');
    expect(messageCodes['parser.ast.missingSpan']).toBe('NXT1011');
  });

  it('maps object babel errors and stringifies non-objects', async () => {
    const snapshot = await snapshotFromText('x');
    const fromError = diagnosticFromBabel(
      {
        reasonCode: 'MissingPlugin',
        loc: { index: 3 },
        details: { missingPlugin: ['optionalChainingAssign'] },
      },
      snapshot,
    );
    expect(fromError.messageId).toBe('parser.unsupported');
    expect(fromError.arguments).toEqual(['optionalChainingAssign']);
    expect(fromError.primarySpan.start).toBe(3);

    const fromText = diagnosticFromBabel('boom', snapshot);
    expect(fromText.messageId).toBe('parser.babel');
    expect(fromText.arguments).toEqual(['boom']);
    expect(fromText.primarySpan.start).toBe(0);
  });

  it('dedups identical diagnostics and sorts by span then code', async () => {
    const snapshot = await snapshotFromText('ab');
    const later = createDiagnostic('parser.var', {
      ...span,
      start: 4,
      end: 5,
    });
    const earlier = createDiagnostic('parser.eqeq', {
      ...span,
      start: 1,
      end: 2,
    });
    const { diagnostics } = finalizeDiagnostics(
      [later, earlier, { ...earlier }],
      snapshot,
    );
    expect(diagnostics.map((diagnostic) => diagnostic.messageId)).toEqual([
      'parser.eqeq',
      'parser.var',
    ]);
  });

  it('truncates file error diagnostics after the budget', async () => {
    const snapshot = await snapshotFromText(
      Array.from(
        { length: FILE_ERROR_BUDGET + 1 },
        (_, i) => `var x${i} = 1;`,
      ).join('\n'),
    );
    const result = parseFile(snapshot);
    expect(result.diagnosticsTruncated).toBe(true);
    expect(result.complete).toBe(false);
    expect(
      result.diagnostics.filter(
        (diagnostic) => diagnostic.messageId === 'parser.var',
      ),
    ).toHaveLength(FILE_ERROR_BUDGET);
    expect(result.diagnostics.at(-1)?.messageId).toBe('parser.budget.error');
    expect(result.diagnostics.at(-1)?.code).toBe('NXT0901');
  });
});
