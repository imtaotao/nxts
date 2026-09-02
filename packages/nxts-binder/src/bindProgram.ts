import type { Identifier, StringLiteral } from '@babel/types';
import { bindFile } from './bindFile';
import { createDiagnostic } from './catalog';
import { ExportResolver } from './exportResolver';
import type {
  BindEnv,
  BindFileResult,
  BindProgramResult,
  FileExport,
  FileImport,
  ModuleEdge,
  ParseFileResult,
} from './types';

const exportedName = (node: Identifier | StringLiteral) => {
  if (node.type === 'Identifier') {
    return node.name;
  }
  return node.value;
};

const importSpan = (file: ParseFileResult, item: FileImport) => {
  const body = file.ast?.program.body ?? [];
  for (const statement of body) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }
    if (statement.source.value !== item.source) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.local.name !== item.local) {
        continue;
      }
      return {
        start: specifier.local.start ?? 0,
        end: specifier.local.end ?? 0,
      };
    }
  }
  return { start: 0, end: 0 };
};

const reexportSpan = (file: ParseFileResult, item: FileExport) => {
  const body = file.ast?.program.body ?? [];
  for (const statement of body) {
    if (statement.type !== 'ExportNamedDeclaration' || !statement.source) {
      continue;
    }
    if (statement.source.value !== item.source) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ExportNamespaceSpecifier') {
        if (
          item.imported === '*' &&
          exportedName(specifier.exported) === item.name
        ) {
          return {
            start: specifier.exported.start ?? 0,
            end: specifier.exported.end ?? 0,
          };
        }
        continue;
      }
      if (specifier.type !== 'ExportSpecifier') {
        continue;
      }
      if (exportedName(specifier.exported) !== item.name) {
        continue;
      }
      return {
        start: specifier.exported.start ?? 0,
        end: specifier.exported.end ?? 0,
      };
    }
  }
  return { start: 0, end: 0 };
};

const diagnose = (
  result: BindProgramResult,
  file: BindFileResult,
  messageId: 'binder.unresolvedExport' | 'binder.ambiguousExport',
  name: string,
  source: string,
  span: { start: number; end: number },
) => {
  result.diagnostics.push(
    createDiagnostic(messageId, [name, source], {
      ...span,
      fileId: file.snapshot.fileId,
      sourceVersion: file.snapshot.sourceVersion,
    }),
  );
};

const linkImports = (
  result: BindProgramResult,
  resolver: ExportResolver,
  file: BindFileResult,
  parsed: ParseFileResult,
) => {
  const fromFileId = file.snapshot.fileId;
  for (const item of file.imports) {
    const target = resolver.fileIdOf(fromFileId, item.source);
    const span = importSpan(parsed, item);
    if (target == null) {
      diagnose(
        result,
        file,
        'binder.unresolvedExport',
        item.imported,
        item.source,
        span,
      );
      continue;
    }
    if (item.imported === '*') {
      result.links.push({
        fromFileId,
        importSymbolId: item.symbolId,
        toFileId: target,
        exportSymbolId: null,
      });
      continue;
    }
    const resolved = resolver.resolve(target, item.imported, item.space);
    if (resolved.kind === 'found') {
      result.links.push({
        fromFileId,
        importSymbolId: item.symbolId,
        toFileId: resolved.fileId,
        exportSymbolId: resolved.symbolId,
      });
      continue;
    }
    if (resolved.kind === 'namespace') {
      result.links.push({
        fromFileId,
        importSymbolId: item.symbolId,
        toFileId: resolved.fileId,
        exportSymbolId: null,
      });
      continue;
    }
    diagnose(
      result,
      file,
      resolved.kind === 'ambiguous'
        ? 'binder.ambiguousExport'
        : 'binder.unresolvedExport',
      item.imported,
      item.source,
      span,
    );
  }
};

const diagnoseReexports = (
  result: BindProgramResult,
  resolver: ExportResolver,
  file: BindFileResult,
  parsed: ParseFileResult,
) => {
  const fromFileId = file.snapshot.fileId;
  for (const item of file.exports) {
    if (item.source == null || item.name === '*') {
      continue;
    }
    if (
      item.space === 'type' &&
      file.exports.some(
        (other) =>
          other !== item &&
          other.space === 'value' &&
          other.name === item.name &&
          other.source === item.source &&
          other.imported === item.imported,
      )
    ) {
      continue;
    }
    const target = resolver.fileIdOf(fromFileId, item.source);
    const span = reexportSpan(parsed, item);
    if (target == null) {
      diagnose(
        result,
        file,
        'binder.unresolvedExport',
        item.imported === '*' ? item.name : (item.imported ?? item.name),
        item.source,
        span,
      );
      continue;
    }
    if (item.imported === '*') {
      continue;
    }
    if (item.imported == null) {
      continue;
    }
    const resolved = resolver.resolve(target, item.imported, item.space);
    if (resolved.kind === 'found' || resolved.kind === 'namespace') {
      continue;
    }
    diagnose(
      result,
      file,
      resolved.kind === 'ambiguous'
        ? 'binder.ambiguousExport'
        : 'binder.unresolvedExport',
      item.imported,
      item.source,
      span,
    );
  }
};

export function bindProgram(
  files: readonly ParseFileResult[],
  edges: readonly ModuleEdge[],
  env: BindEnv = { symbols: [] },
) {
  const bound = files.map((file) => bindFile(file, env));
  const resolver = new ExportResolver(bound, edges);

  for (const file of bound) {
    file.resolved = resolver.resolveAll(file.snapshot.fileId);
  }
  const result: BindProgramResult = {
    files: bound,
    links: [],
    diagnostics: [],
  };
  for (let index = 0; index < bound.length; index++) {
    linkImports(result, resolver, bound[index], files[index]);
    diagnoseReexports(result, resolver, bound[index], files[index]);
  }

  return result;
}
