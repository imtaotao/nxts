import type { Node } from '@babel/types';
import { describe, expect, it } from 'vitest';
import { assignNodeIds } from '../nodeIds';
import { babelParse } from '../babel';
import { snapshotFromText } from './utils';

const asNode = (node: object) => node as Node;

describe('assignNodeIds', () => {
  it('assigns ids for a legal file and reports no contract errors', async () => {
    const snapshot = await snapshotFromText('const x = 1;\n');
    const ast = babelParse(snapshot.text, snapshot.displayPath);
    const result = assignNodeIds(ast, snapshot);
    expect(result.diagnostics).toEqual([]);
    expect(result.invalidNodes.size).toBe(0);
    expect(result.nodes[0]).toBe(ast);
    expect(result.nodeIds.get(ast)).toBe(0);
  });

  it('accepts zero-length spans at the start and end of the text', async () => {
    const empty = await snapshotFromText('');
    const ast = babelParse(empty.text, empty.displayPath);
    const fromBabel = assignNodeIds(ast, empty);
    expect(fromBabel.diagnostics).toEqual([]);
    expect(fromBabel.nodeIds.has(ast)).toBe(true);

    const atEnd = assignNodeIds(
      asNode({ type: 'Identifier', name: 'x', start: 2, end: 2 }),
      await snapshotFromText('ab'),
    );
    expect(atEnd.diagnostics).toEqual([]);
    expect(atEnd.invalidNodes.size).toBe(0);
    expect(atEnd.nodes).toHaveLength(1);
  });

  it('rejects unknown node types without walking their properties', async () => {
    const snapshot = await snapshotFromText('x');
    const child = asNode({
      type: 'Identifier',
      name: 'x',
      start: 0,
      end: 1,
    });
    const root = asNode({
      type: 'NotABabelNode',
      start: 0,
      end: 1,
      expression: child,
    });
    const result = assignNodeIds(root, snapshot);
    expect(
      result.diagnostics.map((diagnostic) => diagnostic.messageId),
    ).toEqual(['parser.ast.unknownNode']);
    expect(result.nodeIds.has(root)).toBe(false);
    expect(result.nodeIds.has(child)).toBe(false);
    expect(result.invalidNodes.has(root)).toBe(true);
  });

  it('rejects nodes missing start or end', async () => {
    const snapshot = await snapshotFromText('x', {
      fileId: 3,
      sourceVersion: 2,
    });
    const result = assignNodeIds(
      asNode({ type: 'Identifier', name: 'x' }),
      snapshot,
    );
    expect(result.diagnostics[0]?.messageId).toBe('parser.ast.missingSpan');
    expect(result.diagnostics[0]?.primarySpan).toEqual({
      start: 0,
      end: 0,
      fileId: 3,
      sourceVersion: 2,
    });
    expect(result.nodes).toEqual([]);
    expect(result.invalidNodes.size).toBe(1);
  });

  it('rejects spans outside the snapshot text or with a mismatched range', async () => {
    const snapshot = await snapshotFromText('ab');
    const overflow = assignNodeIds(
      asNode({ type: 'Identifier', name: 'x', start: 0, end: 5 }),
      snapshot,
    );
    expect(overflow.diagnostics[0]?.messageId).toBe('parser.ast.invalidSpan');
    expect(overflow.diagnostics[0]?.primarySpan).toEqual({
      start: 0,
      end: 0,
      fileId: 0,
      sourceVersion: 0,
    });

    const mismatched = assignNodeIds(
      asNode({
        type: 'Identifier',
        name: 'x',
        start: 0,
        end: 1,
        range: [0, 2],
      }),
      snapshot,
    );
    expect(mismatched.diagnostics[0]?.messageId).toBe('parser.ast.invalidSpan');
  });

  it('rejects a child that is not contained by its parent', async () => {
    const snapshot = await snapshotFromText('0123456789');
    const child = asNode({
      type: 'Identifier',
      name: 'x',
      start: 0,
      end: 8,
    });
    const root = asNode({
      type: 'ExpressionStatement',
      start: 0,
      end: 3,
      expression: child,
    });
    const result = assignNodeIds(root, snapshot);
    expect(result.diagnostics[0]?.messageId).toBe('parser.ast.parentSpan');
    expect(result.diagnostics[0]?.primarySpan).toEqual({
      start: 0,
      end: 8,
      fileId: 0,
      sourceVersion: 0,
    });
    expect(result.nodeIds.has(root)).toBe(true);
    expect(result.nodeIds.has(child)).toBe(false);
    expect(result.invalidNodes.has(child)).toBe(true);
  });

  it('still assigns a valid child when the parent span is untrusted', async () => {
    const snapshot = await snapshotFromText('x');
    const child = asNode({
      type: 'Identifier',
      name: 'x',
      start: 0,
      end: 1,
    });
    const root = asNode({
      type: 'ExpressionStatement',
      expression: child,
    });
    const result = assignNodeIds(root, snapshot);
    expect(result.diagnostics[0]?.messageId).toBe('parser.ast.missingSpan');
    expect(result.invalidNodes.has(root)).toBe(true);
    expect(result.nodeIds.has(root)).toBe(false);
    expect(result.nodeIds.has(child)).toBe(true);
    expect(result.parents.get(child)).toBe(root);
  });

  it('assigns a shared node object only once', async () => {
    const snapshot = await snapshotFromText('x');
    const child = asNode({
      type: 'Identifier',
      name: 'x',
      start: 0,
      end: 1,
    });
    const result = assignNodeIds(
      asNode({
        type: 'SequenceExpression',
        start: 0,
        end: 1,
        expressions: [child, child],
      }),
      snapshot,
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.nodes.filter((node) => node === child)).toHaveLength(1);
    expect(result.nodeIds.get(child)).toBe(1);
  });
});
