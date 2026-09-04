import { createSnapshot, parseFile } from '@nxts/parser';
import {
  bindProgram,
  type BindEnv,
  type BindFileResult,
  type ModuleEdge,
} from '@nxts/binder';
import { checkProgram } from '../index';

export const atomEnv: BindEnv = {
  symbols: [{ name: 'i32', space: 'type', builtinId: 'i32' }],
};

export const genericEnv: BindEnv = {
  symbols: [
    { name: 'i32', space: 'type', builtinId: 'i32' },
    { name: 'Array', space: 'type', builtinId: 'Array' },
    { name: 'Promise', space: 'type', builtinId: 'Promise' },
  ],
};

export async function checkSource(code: string, env?: BindEnv) {
  const parsed = parseFile(
    await createSnapshot({
      utf8: new TextEncoder().encode(code),
      canonicalPath: 'main.ts',
      fileId: 0,
    }),
  );
  const bind = bindProgram([parsed], [], env);
  return { bind, check: checkProgram(bind) };
}

export async function checkSources(
  files: readonly { path: string; code: string }[],
  env?: BindEnv,
) {
  const parsed = await Promise.all(
    files.map(async (file, fileId) =>
      parseFile(
        await createSnapshot({
          utf8: new TextEncoder().encode(file.code),
          canonicalPath: file.path,
          fileId,
        }),
      ),
    ),
  );
  const pathToId = new Map(files.map((file, fileId) => [file.path, fileId]));
  const edges: ModuleEdge[] = [];
  for (const file of parsed) {
    for (const statement of file.ast?.program.body ?? []) {
      if (statement.type !== 'ImportDeclaration') {
        continue;
      }
      const source = statement.source.value;
      const raw = source.startsWith('./') ? source.slice(2) : source;
      const toFileId =
        pathToId.get(raw) ??
        pathToId.get(`${raw}.ts`) ??
        pathToId.get(`${raw}.ntx`);
      if (toFileId == null) {
        continue;
      }
      edges.push({
        fromFileId: file.snapshot.fileId,
        specifier: source,
        toFileId,
      });
    }
  }
  const bind = bindProgram(parsed, edges, env);
  return { bind, check: checkProgram(bind) };
}

export function valueSymbol(file: BindFileResult, name: string) {
  return file.symbols.find(
    (symbol) => symbol.name === name && symbol.space === 'value',
  );
}

export function typeSymbol(file: BindFileResult, name: string) {
  return file.symbols.find(
    (symbol) => symbol.name === name && symbol.space === 'type',
  );
}
