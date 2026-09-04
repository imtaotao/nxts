import { isNil } from 'aidly';
import type {
  Identifier,
  Node,
  StringLiteral,
  VariableDeclaration,
} from '@babel/types';
import type {
  BindFileResult,
  FileExport,
  FileImport,
  NameSpace,
  ParseFileResult,
} from './types';
import { exportSpace, importSpace } from './declare/module';

const exportedName = (node: Identifier | StringLiteral) => {
  if (node.type === 'Identifier') {
    return node.name;
  }
  return node.value;
};

const importedName = (specifier: Node) => {
  if (specifier.type === 'ImportDefaultSpecifier') {
    return 'default';
  }
  if (specifier.type === 'ImportNamespaceSpecifier') {
    return '*';
  }
  if (specifier.type === 'ImportSpecifier') {
    return exportedName(specifier.imported);
  }
  return null;
};

const collectPatternIds = (node: Node, ids: Identifier[]) => {
  switch (node.type) {
    case 'Identifier':
      ids.push(node);
      return;
    case 'AssignmentPattern':
      collectPatternIds(node.left, ids);
      return;
    case 'RestElement':
      collectPatternIds(node.argument, ids);
      return;
    case 'ObjectPattern':
      for (const property of node.properties) {
        if (property.type === 'RestElement') {
          collectPatternIds(property, ids);
          continue;
        }
        collectPatternIds(property.value, ids);
      }
      return;
    case 'ArrayPattern':
      for (const element of node.elements) {
        if (element) {
          collectPatternIds(element, ids);
        }
      }
      return;
    default:
      return;
  }
};

type BoundLookup = Pick<BindFileResult, 'symbols' | 'nodeToSymbols'>;

const symbolInSpace = (
  file: ParseFileResult,
  bound: BoundLookup,
  node: Node | null | undefined,
  space: NameSpace,
) => {
  if (isNil(node)) {
    return null;
  }
  const nodeId = file.nodeIds.get(node);
  if (isNil(nodeId)) {
    return null;
  }
  for (const id of bound.nodeToSymbols[nodeId] ?? []) {
    if (bound.symbols[id]?.space === space) {
      return id;
    }
  }
  return null;
};

const pushExport = (
  exports: FileExport[],
  name: string,
  space: NameSpace,
  symbolId: number | null,
  source: string | null,
  imported: string | null,
) => {
  exports.push({ name, space, symbolId, source, imported });
};

const collectDeclarationExports = (
  file: ParseFileResult,
  bound: BoundLookup,
  declaration: Node,
  exports: FileExport[],
) => {
  if (declaration.type === 'VariableDeclaration') {
    collectVariableExports(file, bound, declaration, exports);
    return;
  }
  if (declaration.type === 'FunctionDeclaration' && declaration.id) {
    pushExport(
      exports,
      declaration.id.name,
      'value',
      symbolInSpace(file, bound, declaration.id, 'value'),
      null,
      null,
    );
    return;
  }
  if (declaration.type === 'ClassDeclaration' && declaration.id) {
    pushExport(
      exports,
      declaration.id.name,
      'value',
      symbolInSpace(file, bound, declaration.id, 'value'),
      null,
      null,
    );
    pushExport(
      exports,
      declaration.id.name,
      'type',
      symbolInSpace(file, bound, declaration.id, 'type'),
      null,
      null,
    );
    return;
  }
  if (
    (declaration.type === 'TSTypeAliasDeclaration' ||
      declaration.type === 'TSInterfaceDeclaration') &&
    declaration.id
  ) {
    pushExport(
      exports,
      declaration.id.name,
      'type',
      symbolInSpace(file, bound, declaration.id, 'type'),
      null,
      null,
    );
    return;
  }
  if (declaration.type === 'TSEnumDeclaration') {
    pushExport(
      exports,
      declaration.id.name,
      'value',
      symbolInSpace(file, bound, declaration.id, 'value'),
      null,
      null,
    );
    pushExport(
      exports,
      declaration.id.name,
      'type',
      symbolInSpace(file, bound, declaration.id, 'type'),
      null,
      null,
    );
  }
};

const collectVariableExports = (
  file: ParseFileResult,
  bound: BoundLookup,
  declaration: VariableDeclaration,
  exports: FileExport[],
) => {
  for (const declarator of declaration.declarations) {
    const ids: Identifier[] = [];
    collectPatternIds(declarator.id, ids);
    for (const id of ids) {
      pushExport(
        exports,
        id.name,
        'value',
        symbolInSpace(file, bound, id, 'value'),
        null,
        null,
      );
    }
  }
};

const collectDefaultExport = (
  file: ParseFileResult,
  bound: BoundLookup,
  declaration: Node,
  exports: FileExport[],
) => {
  if (declaration.type === 'FunctionDeclaration') {
    pushExport(
      exports,
      'default',
      'value',
      symbolInSpace(file, bound, declaration.id, 'value'),
      null,
      null,
    );
    return;
  }
  if (declaration.type === 'ClassDeclaration') {
    pushExport(
      exports,
      'default',
      'value',
      symbolInSpace(file, bound, declaration.id, 'value'),
      null,
      null,
    );
    pushExport(
      exports,
      'default',
      'type',
      symbolInSpace(file, bound, declaration.id, 'type'),
      null,
      null,
    );
    return;
  }
  if (declaration.type === 'TSInterfaceDeclaration') {
    pushExport(
      exports,
      'default',
      'type',
      symbolInSpace(file, bound, declaration.id, 'type'),
      null,
      null,
    );
    return;
  }
  if (declaration.type === 'Identifier') {
    const valueId = symbolInSpace(file, bound, declaration, 'value');
    const typeId = symbolInSpace(file, bound, declaration, 'type');
    if (!isNil(valueId)) {
      pushExport(exports, 'default', 'value', valueId, null, null);
    }
    if (!isNil(typeId)) {
      pushExport(exports, 'default', 'type', typeId, null, null);
    }
    if (isNil(valueId) && isNil(typeId)) {
      pushExport(exports, 'default', 'value', null, null, null);
    }
    return;
  }
  pushExport(exports, 'default', 'value', null, null, null);
};

export function collectModuleBindings(
  file: ParseFileResult,
  bound: BoundLookup,
) {
  const exports: FileExport[] = [];
  const imports: FileImport[] = [];
  if (isNil(file.ast)) {
    return { exports, imports };
  }

  for (const statement of file.ast.program.body) {
    if (file.invalidNodes.has(statement)) {
      continue;
    }
    if (statement.type === 'ImportDeclaration') {
      for (const specifier of statement.specifiers) {
        if (file.invalidNodes.has(specifier)) {
          continue;
        }
        const space = importSpace(statement, specifier);
        const imported = importedName(specifier);
        const symbolId = symbolInSpace(file, bound, specifier.local, space);
        if (isNil(imported) || isNil(symbolId)) {
          continue;
        }
        imports.push({
          local: specifier.local.name,
          imported,
          space,
          source: statement.source.value,
          symbolId,
        });
      }
      continue;
    }

    if (statement.type === 'ExportAllDeclaration') {
      const source = statement.source.value;
      if (statement.exportKind === 'type') {
        pushExport(exports, '*', 'type', null, source, '*');
      } else {
        pushExport(exports, '*', 'value', null, source, '*');
        pushExport(exports, '*', 'type', null, source, '*');
      }
      continue;
    }

    if (statement.type === 'ExportDefaultDeclaration') {
      if (!file.invalidNodes.has(statement.declaration)) {
        collectDefaultExport(file, bound, statement.declaration, exports);
      }
      continue;
    }

    if (statement.type !== 'ExportNamedDeclaration') {
      continue;
    }

    if (
      statement.declaration &&
      !file.invalidNodes.has(statement.declaration)
    ) {
      collectDeclarationExports(file, bound, statement.declaration, exports);
    }

    const source = statement.source?.value ?? null;
    for (const specifier of statement.specifiers) {
      if (file.invalidNodes.has(specifier)) {
        continue;
      }
      if (specifier.type === 'ExportNamespaceSpecifier') {
        const name = exportedName(specifier.exported);
        if (isNil(name)) {
          continue;
        }
        if (statement.exportKind === 'type') {
          pushExport(exports, name, 'type', null, source, '*');
        } else {
          pushExport(exports, name, 'value', null, source, '*');
          pushExport(exports, name, 'type', null, source, '*');
        }
        continue;
      }
      if (specifier.type !== 'ExportSpecifier') {
        continue;
      }
      const name = exportedName(specifier.exported);
      if (isNil(name)) {
        continue;
      }
      const space = exportSpace(statement, specifier);
      const imported = exportedName(specifier.local);
      pushExport(
        exports,
        name,
        space,
        isNil(source)
          ? symbolInSpace(file, bound, specifier.local, space)
          : null,
        source,
        isNil(source) ? null : imported,
      );
    }
  }

  return { exports, imports };
}
