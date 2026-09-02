import type {
  ClassDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  ExpressionStatement,
  FunctionDeclaration,
  Identifier,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  TSTypeAliasDeclaration,
  VariableDeclaration,
} from '@babel/types';
import { describe, expect, it } from 'vitest';
import {
  bindSource,
  diagnosticIds,
  sameSymbol,
  scopeKindOf,
  symbolOf,
  symbolsOf,
} from './utils';

const typeRefOf = (node: Identifier) => {
  const annotation = node.typeAnnotation;
  if (annotation?.type !== 'TSTypeAnnotation') {
    return null;
  }
  const type = annotation.typeAnnotation;
  if (type.type !== 'TSTypeReference') {
    return null;
  }
  return type.typeName;
};

describe('import', () => {
  it('binds a named import in value space', async () => {
    const { file, bound } = await bindSource(
      "import { seed } from './seed'; const n = seed;",
    );
    const imported = (
      (file.ast.program.body[0] as ImportDeclaration)
        .specifiers[0] as ImportSpecifier
    ).local;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0];

    expect(scopeKindOf(bound, 'seed')).toBe('module');
    expect(sameSymbol(bound, file, imported, n.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('hoists an import before later statements', async () => {
    const { file, bound } = await bindSource(
      "const n = seed; import { seed } from './seed';",
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0];
    const imported = (
      (file.ast.program.body[1] as ImportDeclaration)
        .specifiers[0] as ImportSpecifier
    ).local;

    expect(sameSymbol(bound, file, imported, n.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds import type in type space only', async () => {
    const { file, bound } = await bindSource(
      "import type { Count } from './count'; const n: Count = Count;",
    );
    const imported = (
      (file.ast.program.body[0] as ImportDeclaration)
        .specifiers[0] as ImportSpecifier
    ).local;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id as Identifier;

    expect(sameSymbol(bound, file, imported, typeRefOf(n))).toBe(true);
    expect(
      symbolOf(
        bound,
        file,
        (file.ast.program.body[1] as VariableDeclaration).declarations[0].init,
      ),
    ).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['Count']);
  });

  it('binds mixed value and inline type imports', async () => {
    const { file, bound } = await bindSource(
      "import { seed, type Count } from './mod'; const n: Count = seed;",
    );
    const specifiers = (file.ast.program.body[0] as ImportDeclaration)
      .specifiers as ImportSpecifier[];
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0];

    expect(sameSymbol(bound, file, specifiers[0].local, n.init)).toBe(true);
    expect(
      sameSymbol(
        bound,
        file,
        specifiers[1].local,
        typeRefOf(n.id as Identifier),
      ),
    ).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds default and namespace imports', async () => {
    const { file, bound } = await bindSource(
      "import seed from './seed'; import * as ns from './ns'; const n = seed + ns;",
    );
    const defaultLocal = (
      (file.ast.program.body[0] as ImportDeclaration)
        .specifiers[0] as ImportDefaultSpecifier
    ).local;
    const namespaceLocal = (
      (file.ast.program.body[1] as ImportDeclaration)
        .specifiers[0] as ImportNamespaceSpecifier
    ).local;
    const init = (file.ast.program.body[2] as VariableDeclaration)
      .declarations[0].init;

    expect(
      init?.type === 'BinaryExpression' &&
        sameSymbol(bound, file, defaultLocal, init.left),
    ).toBe(true);
    expect(
      init?.type === 'BinaryExpression' &&
        sameSymbol(bound, file, namespaceLocal, init.right),
    ).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('reports a duplicate when import and const share a name', async () => {
    const { file, bound } = await bindSource(
      "import { n } from './seed'; const n = 1;",
    );
    const imported = (
      (file.ast.program.body[0] as ImportDeclaration)
        .specifiers[0] as ImportSpecifier
    ).local;
    const local = (file.ast.program.body[1] as VariableDeclaration)
      .declarations[0].id;

    expect(sameSymbol(bound, file, imported, local)).toBe(false);
    expect(diagnosticIds(bound)).toEqual(['binder.duplicate']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['n']);
  });
});

describe('export', () => {
  it('binds an exported function like a local one', async () => {
    const { file, bound } = await bindSource('export function f() {} f;');
    const fn = (file.ast.program.body[0] as ExportNamedDeclaration)
      .declaration as FunctionDeclaration;
    const ref = (file.ast.program.body[1] as ExpressionStatement).expression;

    expect(sameSymbol(bound, file, fn.id, ref)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds an exported type alias', async () => {
    const { file, bound } = await bindSource(
      'export type User = number; const n: User = 1;',
    );
    const alias = (file.ast.program.body[0] as ExportNamedDeclaration)
      .declaration as TSTypeAliasDeclaration;
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id as Identifier;

    expect(sameSymbol(bound, file, alias.id, typeRefOf(n))).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('binds an exported class in both spaces', async () => {
    const { file, bound } = await bindSource(
      'export class User {} const u: User = User;',
    );
    const decl = (file.ast.program.body[0] as ExportNamedDeclaration)
      .declaration as ClassDeclaration;
    const u = (file.ast.program.body[1] as VariableDeclaration).declarations[0];

    expect(
      sameSymbol(bound, file, decl.id, typeRefOf(u.id as Identifier)),
    ).toBe(true);
    expect(sameSymbol(bound, file, decl.id, u.init)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('resolves a later local export list', async () => {
    const { file, bound } = await bindSource(
      'export { n, type User }; const n = 1; type User = number;',
    );
    const specifiers = (file.ast.program.body[0] as ExportNamedDeclaration)
      .specifiers as ExportSpecifier[];
    const n = (file.ast.program.body[1] as VariableDeclaration).declarations[0]
      .id;
    const alias = file.ast.program.body[2] as TSTypeAliasDeclaration;

    expect(sameSymbol(bound, file, n, specifiers[0]?.local)).toBe(true);
    expect(sameSymbol(bound, file, alias.id, specifiers[1]?.local)).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('leaves a missing local export unbound', async () => {
    const { file, bound } = await bindSource('export { missing };');
    const local = (
      (file.ast.program.body[0] as ExportNamedDeclaration)
        .specifiers[0] as ExportSpecifier
    ).local;

    expect(symbolOf(bound, file, local)).toBe(null);
    expect(diagnosticIds(bound)).toEqual(['binder.unresolved']);
    expect(bound.diagnostics[0]?.arguments).toEqual(['missing']);
  });

  it('does not resolve a re-export from another module', async () => {
    const { file, bound } = await bindSource(
      "export { missing } from './mod';",
    );
    const local = (
      (file.ast.program.body[0] as ExportNamedDeclaration)
        .specifiers[0] as ExportSpecifier
    ).local;

    expect(symbolOf(bound, file, local)).toBe(null);
    expect(bound.diagnostics).toEqual([]);
  });

  it('records file exports and imports without linking', async () => {
    const { file, bound } = await bindSource(
      "import { seed, type Count } from './mod'; export const n = seed; export type User = Count; export { n as out }; export { missing } from './x';",
    );
    const specifiers = (file.ast.program.body[0] as ImportDeclaration)
      .specifiers as ImportSpecifier[];
    const n = (
      (file.ast.program.body[1] as ExportNamedDeclaration)
        .declaration as VariableDeclaration
    ).declarations[0].id;
    const alias = (file.ast.program.body[2] as ExportNamedDeclaration)
      .declaration as TSTypeAliasDeclaration;

    expect(bound.imports).toEqual([
      {
        local: 'seed',
        imported: 'seed',
        space: 'value',
        source: './mod',
        symbolId: symbolOf(bound, file, specifiers[0].local),
      },
      {
        local: 'Count',
        imported: 'Count',
        space: 'type',
        source: './mod',
        symbolId: symbolOf(bound, file, specifiers[1].local),
      },
    ]);
    expect(bound.exports).toEqual([
      {
        name: 'n',
        space: 'value',
        symbolId: symbolOf(bound, file, n),
        source: null,
        imported: null,
      },
      {
        name: 'User',
        space: 'type',
        symbolId: symbolOf(bound, file, alias.id),
        source: null,
        imported: null,
      },
      {
        name: 'out',
        space: 'value',
        symbolId: symbolOf(bound, file, n),
        source: null,
        imported: null,
      },
      {
        name: 'missing',
        space: 'value',
        symbolId: null,
        source: './x',
        imported: 'missing',
      },
    ]);
  });

  it('leaves a file without imports or exports empty', async () => {
    const { bound } = await bindSource('const n = 1;');
    expect(bound.imports).toEqual([]);
    expect(bound.exports).toEqual([]);
  });

  it('records a class and default export', async () => {
    const { file, bound } = await bindSource(
      'export class User {} export default function f() {}',
    );
    const user = (file.ast.program.body[0] as ExportNamedDeclaration)
      .declaration as ClassDeclaration;
    const fn = (file.ast.program.body[1] as ExportDefaultDeclaration)
      .declaration as FunctionDeclaration;

    expect(
      bound.exports
        .filter((item) => item.name === 'User')
        .map((item) => ({
          space: item.space,
          symbolId: item.symbolId,
        })),
    ).toEqual([
      { space: 'value', symbolId: symbolOf(bound, file, user.id) },
      {
        space: 'type',
        symbolId: symbolsOf(bound, file, user.id).find(
          (id) => bound.symbols[id]?.space === 'type',
        ),
      },
    ]);
    expect(bound.exports.some((item) => item.name === 'default')).toBe(true);
    expect(
      bound.exports.find((item) => item.name === 'default')?.symbolId,
    ).toBe(symbolOf(bound, file, fn.id));
  });

  it('binds a default export declaration and expression', async () => {
    const { file, bound } = await bindSource(
      'const n = 1; export default function f() { return n; }',
    );
    const n = (file.ast.program.body[0] as VariableDeclaration).declarations[0]
      .id;
    const fn = (file.ast.program.body[1] as ExportDefaultDeclaration)
      .declaration as FunctionDeclaration;
    const ret = fn.body.body[0];

    expect(scopeKindOf(bound, 'f')).toBe('module');
    expect(
      ret.type === 'ReturnStatement' &&
        sameSymbol(bound, file, n, ret.argument),
    ).toBe(true);
    expect(bound.diagnostics).toEqual([]);
  });

  it('records export * in value and type space', async () => {
    const { bound } = await bindSource("export * from './a';");
    expect(bound.exports).toEqual([
      {
        name: '*',
        space: 'value',
        symbolId: null,
        source: './a',
        imported: '*',
      },
      {
        name: '*',
        space: 'type',
        symbolId: null,
        source: './a',
        imported: '*',
      },
    ]);
  });

  it('records export type * in type space only', async () => {
    const { bound } = await bindSource("export type * from './a';");
    expect(bound.exports).toEqual([
      {
        name: '*',
        space: 'type',
        symbolId: null,
        source: './a',
        imported: '*',
      },
    ]);
  });

  it('records export * as in value and type space', async () => {
    const { bound } = await bindSource("export * as ns from './a';");
    expect(bound.exports).toEqual([
      {
        name: 'ns',
        space: 'value',
        symbolId: null,
        source: './a',
        imported: '*',
      },
      {
        name: 'ns',
        space: 'type',
        symbolId: null,
        source: './a',
        imported: '*',
      },
    ]);
  });
});
