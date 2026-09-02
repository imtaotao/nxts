import { createSnapshot, parseFile } from '@nxts/parser';
import { describe, expect, it } from 'vitest';
import {
  bindFile,
  bindProgram,
  ExportResolver,
  type BindProgramResult,
  type ModuleEdge,
  type ParseFileResult,
} from '../index';

const parseSource = async (
  code: string,
  fileId: number,
  canonicalPath: string,
) => {
  return parseFile(
    await createSnapshot({
      utf8: new TextEncoder().encode(code),
      canonicalPath,
      fileId,
    }),
  );
};

const resolverOf = (files: ParseFileResult[], edges: ModuleEdge[]) => {
  return new ExportResolver(
    files.map((file) => bindFile(file)),
    edges,
  );
};

const resolvedOf = (program: BindProgramResult, fileId: number) => {
  return (
    program.files.find((file) => file.snapshot.fileId === fileId)?.resolved ??
    []
  );
};

const exportId = (
  file: ParseFileResult,
  name: string,
  space: 'value' | 'type' = 'value',
) => {
  const bound = bindFile(file);
  return (
    bound.exports.find((item) => item.name === name && item.space === space)
      ?.symbolId ?? null
  );
};

describe('ExportResolver', () => {
  it('finds a local named export', async () => {
    const file = await parseSource('export const foo = 1;', 1, 'a.ts');
    expect(resolverOf([file], []).resolve(1, 'foo', 'value')).toEqual({
      kind: 'found',
      fileId: 1,
      symbolId: exportId(file, 'foo'),
    });
  });

  it('returns missing when the name is not exported', async () => {
    const file = await parseSource('export const foo = 1;', 1, 'a.ts');
    expect(resolverOf([file], []).resolve(1, 'bar', 'value')).toEqual({
      kind: 'missing',
    });
  });

  it('walks a named re-export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export { foo as bar } from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'bar', 'value')).toEqual({
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'foo'),
    });
    expect(resolver.resolve(2, 'foo', 'value')).toEqual({ kind: 'missing' });
  });

  it('walks export * to the owning module', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'foo', 'value')).toEqual({
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'foo'),
    });
  });

  it('walks a chain of export *', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const c = await parseSource("export * from './b';", 3, 'c.ts');
    const resolver = resolverOf(
      [a, b, c],
      [
        { fromFileId: 2, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(resolver.resolve(3, 'foo', 'value')).toEqual({
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'foo'),
    });
  });

  it('does not re-export default through export *', async () => {
    const a = await parseSource('export default function f() {}', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'default', 'value')).toEqual({
      kind: 'missing',
    });
  });

  it('finds default on the owning module', async () => {
    const a = await parseSource('export default function f() {}', 1, 'a.ts');
    expect(resolverOf([a], []).resolve(1, 'default', 'value').kind).toBe(
      'found',
    );
  });

  it('lets an explicit local export win over export *', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource(
      "export const foo = 2; export * from './a';",
      2,
      'b.ts',
    );
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'foo', 'value')).toEqual({
      kind: 'found',
      fileId: 2,
      symbolId: exportId(b, 'foo'),
    });
  });

  it('lets an explicit re-export win over export *', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource('export const foo = 2;', 2, 'b.ts');
    const c = await parseSource(
      "export { foo } from './a'; export * from './b';",
      3,
      'c.ts',
    );
    const resolver = resolverOf(
      [a, b, c],
      [
        { fromFileId: 3, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(resolver.resolve(3, 'foo', 'value')).toEqual({
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'foo'),
    });
  });

  it('reports ambiguous names from two export *', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource('export const foo = 2;', 2, 'b.ts');
    const c = await parseSource(
      "export * from './a'; export * from './b';",
      3,
      'c.ts',
    );
    const resolver = resolverOf(
      [a, b, c],
      [
        { fromFileId: 3, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(resolver.resolve(3, 'foo', 'value')).toEqual({
      kind: 'ambiguous',
    });
  });

  it('does not treat two stars to the same symbol as ambiguous', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const c = await parseSource(
      "export * from './a'; export * from './b';",
      3,
      'c.ts',
    );
    const resolver = resolverOf(
      [a, b, c],
      [
        { fromFileId: 2, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(resolver.resolve(3, 'foo', 'value')).toEqual({
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'foo'),
    });
  });

  it('treats a star cycle as missing', async () => {
    const a = await parseSource("export * from './b';", 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [
        { fromFileId: 1, specifier: './b', toFileId: 2 },
        { fromFileId: 2, specifier: './a', toFileId: 1 },
      ],
    );

    expect(resolver.resolve(1, 'foo', 'value')).toEqual({
      kind: 'missing',
    });
  });

  it('walks export * in type space', async () => {
    const a = await parseSource('export type Count = number;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'Count', 'type')).toEqual({
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'Count', 'type'),
    });
  });

  it('does not resolve a type-only name in value space', async () => {
    const a = await parseSource('export type Count = number;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'Count', 'value')).toEqual({
      kind: 'missing',
    });
  });

  it('does not walk a value through export type *', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export type * from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'foo', 'value')).toEqual({ kind: 'missing' });
  });

  it('returns missing when the re-export edge is absent', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');

    expect(resolverOf([a, b], []).resolve(2, 'foo', 'value')).toEqual({
      kind: 'missing',
    });
  });

  it('resolves export * as to the target module namespace', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * as ns from './a';", 2, 'b.ts');
    const resolver = resolverOf(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolver.resolve(2, 'ns', 'value')).toEqual({
      kind: 'namespace',
      fileId: 1,
    });
    expect(resolver.resolve(2, 'foo', 'value')).toEqual({ kind: 'missing' });
  });
});

describe('bindProgram', () => {
  it('links a named import to the other file export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("import { foo } from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(program.diagnostics).toEqual([]);
    expect(program.links).toEqual([
      {
        fromFileId: 2,
        importSymbolId: bindFile(b).imports[0]?.symbolId,
        toFileId: 1,
        exportSymbolId: exportId(a, 'foo'),
      },
    ]);
  });

  it('links a default import to the default export', async () => {
    const a = await parseSource('export default function f() {}', 1, 'a.ts');
    const b = await parseSource("import f from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(program.diagnostics).toEqual([]);
    expect(program.links).toEqual([
      {
        fromFileId: 2,
        importSymbolId: bindFile(b).imports[0]?.symbolId,
        toFileId: 1,
        exportSymbolId: exportId(a, 'default'),
      },
    ]);
  });

  it('links an import type to a type export', async () => {
    const a = await parseSource('export type Count = number;', 1, 'a.ts');
    const b = await parseSource("import type { Count } from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(program.diagnostics).toEqual([]);
    expect(program.links).toEqual([
      {
        fromFileId: 2,
        importSymbolId: bindFile(b).imports[0]?.symbolId,
        toFileId: 1,
        exportSymbolId: exportId(a, 'Count', 'type'),
      },
    ]);
  });

  it('links through export *', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const c = await parseSource("import { foo } from './b';", 3, 'c.ts');
    const program = bindProgram(
      [a, b, c],
      [
        { fromFileId: 2, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(program.diagnostics).toEqual([]);
    expect(program.links).toEqual([
      {
        fromFileId: 3,
        importSymbolId: bindFile(c).imports[0]?.symbolId,
        toFileId: 1,
        exportSymbolId: exportId(a, 'foo'),
      },
    ]);
  });

  it('links through a named re-export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export { foo as bar } from './a';", 2, 'b.ts');
    const c = await parseSource("import { bar } from './b';", 3, 'c.ts');
    const program = bindProgram(
      [a, b, c],
      [
        { fromFileId: 2, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(program.diagnostics).toEqual([]);
    expect(program.links).toEqual([
      {
        fromFileId: 3,
        importSymbolId: bindFile(c).imports[0]?.symbolId,
        toFileId: 1,
        exportSymbolId: exportId(a, 'foo'),
      },
    ]);
  });

  it('links import * to the target module', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("import * as ns from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(program.diagnostics).toEqual([]);
    expect(program.links).toEqual([
      {
        fromFileId: 2,
        importSymbolId: bindFile(b).imports[0]?.symbolId,
        toFileId: 1,
        exportSymbolId: null,
      },
    ]);
  });

  it('links import of export * as to the target module', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * as ns from './a';", 2, 'b.ts');
    const c = await parseSource("import { ns } from './b';", 3, 'c.ts');
    const program = bindProgram(
      [a, b, c],
      [
        { fromFileId: 2, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(program.diagnostics).toEqual([]);
    expect(program.links).toEqual([
      {
        fromFileId: 3,
        importSymbolId: bindFile(c).imports[0]?.symbolId,
        toFileId: 1,
        exportSymbolId: null,
      },
    ]);
  });

  it('diagnoses a missing named re-export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export { missing } from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(program.links).toEqual([]);
    expect(program.diagnostics.map((item) => item.messageId)).toEqual([
      'binder.unresolvedExport',
    ]);
  });

  it('diagnoses export * as when the module edge is absent', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * as ns from './a';", 2, 'b.ts');
    const program = bindProgram([a, b], []);

    expect(program.links).toEqual([]);
    expect(program.diagnostics.map((item) => item.messageId)).toEqual([
      'binder.unresolvedExport',
    ]);
  });

  it('diagnoses a missing export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("import { missing } from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(program.links).toEqual([]);
    expect(program.diagnostics.map((item) => item.messageId)).toEqual([
      'binder.unresolvedExport',
    ]);
  });

  it('diagnoses an ambiguous export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource('export const foo = 2;', 2, 'b.ts');
    const c = await parseSource(
      "export * from './a'; export * from './b';",
      3,
      'c.ts',
    );
    const d = await parseSource("import { foo } from './c';", 4, 'd.ts');
    const program = bindProgram(
      [a, b, c, d],
      [
        { fromFileId: 3, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
        { fromFileId: 4, specifier: './c', toFileId: 3 },
      ],
    );

    expect(program.links).toEqual([]);
    expect(program.diagnostics.map((item) => item.messageId)).toEqual([
      'binder.ambiguousExport',
    ]);
  });

  it('diagnoses a missing module edge', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("import { foo } from './a';", 2, 'b.ts');
    const program = bindProgram([a, b], []);

    expect(program.links).toEqual([]);
    expect(program.diagnostics.map((item) => item.messageId)).toEqual([
      'binder.unresolvedExport',
    ]);
  });
});

describe('resolved', () => {
  it('records a local named export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const program = bindProgram([a], []);

    expect(resolvedOf(program, 1)).toEqual([
      {
        name: 'foo',
        space: 'value',
        kind: 'found',
        fileId: 1,
        symbolId: exportId(a, 'foo'),
      },
    ]);
  });

  it('expands export * onto the re-exporting file', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(
      resolvedOf(program, 2).find(
        (item) => item.name === 'foo' && item.space === 'value',
      ),
    ).toEqual({
      name: 'foo',
      space: 'value',
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'foo'),
    });
  });

  it('expands a type export through export *', async () => {
    const a = await parseSource('export type Count = number;', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(
      resolvedOf(program, 2).find(
        (item) => item.name === 'Count' && item.space === 'type',
      ),
    ).toEqual({
      name: 'Count',
      space: 'type',
      kind: 'found',
      fileId: 1,
      symbolId: exportId(a, 'Count', 'type'),
    });
  });

  it('does not expand default through export *', async () => {
    const a = await parseSource('export default function f() {}', 1, 'a.ts');
    const b = await parseSource("export * from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolvedOf(program, 2).some((item) => item.name === 'default')).toBe(
      false,
    );
    expect(
      resolvedOf(program, 1).some(
        (item) => item.name === 'default' && item.kind === 'found',
      ),
    ).toBe(true);
  });

  it('records an ambiguous star export', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource('export const foo = 2;', 2, 'b.ts');
    const c = await parseSource(
      "export * from './a'; export * from './b';",
      3,
      'c.ts',
    );
    const program = bindProgram(
      [a, b, c],
      [
        { fromFileId: 3, specifier: './a', toFileId: 1 },
        { fromFileId: 3, specifier: './b', toFileId: 2 },
      ],
    );

    expect(
      resolvedOf(program, 3).find(
        (item) => item.name === 'foo' && item.space === 'value',
      ),
    ).toEqual({
      name: 'foo',
      space: 'value',
      kind: 'ambiguous',
    });
  });

  it('records export * as as a namespace', async () => {
    const a = await parseSource('export const foo = 1;', 1, 'a.ts');
    const b = await parseSource("export * as ns from './a';", 2, 'b.ts');
    const program = bindProgram(
      [a, b],
      [{ fromFileId: 2, specifier: './a', toFileId: 1 }],
    );

    expect(resolvedOf(program, 2).filter((item) => item.name === 'ns')).toEqual(
      [
        { name: 'ns', space: 'value', kind: 'namespace', fileId: 1 },
        { name: 'ns', space: 'type', kind: 'namespace', fileId: 1 },
      ],
    );
  });
});
