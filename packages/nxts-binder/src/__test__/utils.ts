import type { File, Node } from '@babel/types';
import { createSnapshot, parseFile } from '@nxts/parser';
import { bindFile, type BindFileResult, type ParseFileResult } from '../index';

type ParsedFile = ParseFileResult & { ast: File };

export async function bindSource(code: string) {
  const file = parseFile(
    await createSnapshot({
      utf8: new TextEncoder().encode(code),
      canonicalPath: 'test.ts',
    }),
  );
  if (file.ast == null) {
    throw new Error('parse failed');
  }
  return {
    file: file as ParsedFile,
    bound: bindFile(file),
  };
}

export function symbolOf(
  bound: BindFileResult,
  file: ParseFileResult,
  node?: Node | null,
) {
  if (node == null) {
    return null;
  }
  const ids = symbolsOf(bound, file, node);
  return ids[0] ?? null;
}

export function symbolsOf(
  bound: BindFileResult,
  file: ParseFileResult,
  node?: Node | null,
) {
  if (node == null) {
    return [];
  }
  const nodeId = file.nodeIds.get(node);
  if (nodeId == null) {
    return [];
  }
  return bound.nodeToSymbols[nodeId] ?? [];
}

export function sameSymbol(
  bound: BindFileResult,
  file: ParseFileResult,
  a?: Node | null,
  b?: Node | null,
) {
  const right = new Set(symbolsOf(bound, file, b));
  return symbolsOf(bound, file, a).some((id) => right.has(id));
}

export function scopeKindOf(bound: BindFileResult, name: string) {
  const symbol = bound.symbols.find((item) => item.name === name);
  if (symbol == null) {
    return null;
  }
  return bound.scopes[symbol.scopeId]?.kind ?? null;
}

export function diagnosticIds(bound: BindFileResult) {
  return bound.diagnostics.map((diagnostic) => diagnostic.messageId);
}
