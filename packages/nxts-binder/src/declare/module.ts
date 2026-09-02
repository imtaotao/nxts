import type {
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportSpecifier,
  ImportDeclaration,
  ModuleDeclaration,
  Statement,
} from '@babel/types';
import type { BinderContext } from '../context';
import { resolveExpr } from '../walk/resolveExpr';

type ListStatement = Statement | ModuleDeclaration;

export function declarationOf(statement: ListStatement) {
  if (
    statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration'
  ) {
    return statement.declaration ?? null;
  }
  return statement;
}

export function importSpace(
  statement: ImportDeclaration,
  specifier: ImportDeclaration['specifiers'][number],
) {
  if (statement.importKind === 'type' || statement.importKind === 'typeof') {
    return 'type';
  }
  if (
    specifier.type === 'ImportSpecifier' &&
    (specifier.importKind === 'type' || specifier.importKind === 'typeof')
  ) {
    return 'type';
  }
  return 'value';
}

export function exportSpace(
  statement: ExportNamedDeclaration,
  specifier: ExportSpecifier,
) {
  if (statement.exportKind === 'type' || specifier.exportKind === 'type') {
    return 'type';
  }
  return 'value';
}

export function declareImport(
  binder: BinderContext,
  statement: ImportDeclaration,
) {
  for (const specifier of statement.specifiers) {
    const space = importSpace(statement, specifier);
    if (!binder.isBoundIn(specifier.local, space)) {
      binder.declare(space, specifier.local);
    }
  }
}

export function bindExportNamed(
  binder: BinderContext,
  statement: ExportNamedDeclaration,
  bindStatement: (binder: BinderContext, statement: ListStatement) => void,
) {
  if (statement.declaration) {
    bindStatement(binder, statement.declaration);
  }
}

export function bindExportDefault(
  binder: BinderContext,
  statement: ExportDefaultDeclaration,
  bindStatement: (binder: BinderContext, statement: ListStatement) => void,
) {
  const declaration = statement.declaration;
  if (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'ClassDeclaration' ||
    declaration.type === 'TSInterfaceDeclaration'
  ) {
    bindStatement(binder, declaration);
    return;
  }
  resolveExpr(binder, declaration);
}

export function bindLocalExportSpecifiers(
  binder: BinderContext,
  statements: Array<ListStatement>,
) {
  for (const statement of statements) {
    if (statement.type !== 'ExportNamedDeclaration' || statement.source) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (specifier.type !== 'ExportSpecifier') {
        continue;
      }
      binder.resolve(exportSpace(statement, specifier), specifier.local);
    }
  }
}

export function hoistImports(
  binder: BinderContext,
  statements: Array<ListStatement>,
) {
  for (const statement of statements) {
    if (statement.type === 'ImportDeclaration') {
      declareImport(binder, statement);
    }
  }
}
