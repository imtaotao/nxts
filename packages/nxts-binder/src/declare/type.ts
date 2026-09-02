import type {
  Node,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
} from '@babel/types';
import type { BinderContext } from '../context';
import { resolveType } from '../walk/resolveType';

export function withTypeParams(
  binder: BinderContext,
  params: Node | null | undefined,
  rest: () => void,
) {
  if (
    params == null ||
    params.type !== 'TSTypeParameterDeclaration' ||
    params.params.length === 0
  ) {
    rest();
    return;
  }
  binder.openScope('typeParams');
  for (const param of params.params) {
    binder.declare('type', param.name);
  }
  for (const param of params.params) {
    resolveType(binder, param.constraint);
    resolveType(binder, param.default);
  }
  rest();
  binder.closeScope();
}

export function declareTypeAlias(
  binder: BinderContext,
  statement: TSTypeAliasDeclaration,
) {
  if (statement.id && !binder.isBound(statement.id)) {
    binder.declare('type', statement.id);
  }
  withTypeParams(binder, statement.typeParameters, () => {
    resolveType(binder, statement.typeAnnotation);
  });
}

export function declareInterface(
  binder: BinderContext,
  statement: TSInterfaceDeclaration,
) {
  if (statement.id && !binder.isBound(statement.id)) {
    binder.declare('type', statement.id);
  }
  withTypeParams(binder, statement.typeParameters, () => {
    for (const parent of statement.extends ?? []) {
      resolveType(binder, parent);
    }
    for (const member of statement.body.body) {
      resolveType(binder, member);
    }
  });
}
