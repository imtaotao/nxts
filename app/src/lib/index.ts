import {
  bindProgram,
  type ModuleEdge,
  type ParseFileResult,
} from '@nxts/binder';
import { createSnapshot, parseFile } from '@nxts/parser';

export type PlaygroundFile = {
  path: string;
  source: string;
};

const collectSpecifiers = (file: ParseFileResult) => {
  const sources = new Set<string>();
  if (file.ast == null) {
    return sources;
  }
  for (const statement of file.ast.program.body) {
    if (statement.type === 'ImportDeclaration') {
      sources.add(statement.source.value);
      continue;
    }
    if (statement.type === 'ExportAllDeclaration') {
      sources.add(statement.source.value);
      continue;
    }
    if (statement.type === 'ExportNamedDeclaration' && statement.source) {
      sources.add(statement.source.value);
    }
  }
  return sources;
};

const dirname = (path: string) => {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
};

const normalizePath = (path: string) => {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
};

function resolveSpecifier(
  fromPath: string,
  specifier: string,
  files: readonly PlaygroundFile[],
) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return null;
  }
  const raw = normalizePath(`${dirname(fromPath)}/${specifier}`);
  if (raw.endsWith('.ntx') || raw.endsWith('.ts')) {
    return files.find((file) => file.path === raw) ?? null;
  }
  return (
    files.find((file) => file.path === `${raw}.ntx`) ??
    files.find((file) => file.path === `${raw}.ts`) ??
    null
  );
}

export async function run(files: readonly PlaygroundFile[]) {
  const parsed = await Promise.all(
    files.map(async (file, fileId) =>
      parseFile(
        await createSnapshot({
          utf8: new TextEncoder().encode(file.source),
          canonicalPath: file.path,
          fileId,
        }),
      ),
    ),
  );
  const pathToId = new Map(files.map((file, fileId) => [file.path, fileId]));
  const edges: ModuleEdge[] = [];
  for (const file of parsed) {
    for (const specifier of collectSpecifiers(file)) {
      const target = resolveSpecifier(
        file.snapshot.canonicalPath,
        specifier,
        files,
      );
      if (target == null) {
        continue;
      }
      const toFileId = pathToId.get(target.path);
      if (toFileId == null) {
        continue;
      }
      edges.push({
        fromFileId: file.snapshot.fileId,
        specifier,
        toFileId,
      });
    }
  }
  return bindProgram(parsed, edges);
}
