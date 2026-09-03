import {
  bindProgram,
  type BindEnv,
  type ModuleEdge,
  type ParseFileResult,
} from '@nxts/binder';
import { checkProgram } from '@nxts/checker';
import { createSnapshot, parseFile } from '@nxts/parser';

// playground 先塞一组常用根符号。完整名单归 T49。
export const playgroundEnv: BindEnv = {
  symbols: [
    { name: 'Array', space: 'value', builtinId: 'Array' },
    { name: 'Array', space: 'type', builtinId: 'Array' },
    { name: 'Promise', space: 'value', builtinId: 'Promise' },
    { name: 'Promise', space: 'type', builtinId: 'Promise' },
    { name: 'Partial', space: 'type', builtinId: 'Partial' },
  ],
};

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
  const bind = bindProgram(parsed, edges, playgroundEnv);
  return {
    bind,
    check: checkProgram(bind),
  };
}
