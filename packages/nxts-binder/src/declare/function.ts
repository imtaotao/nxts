import type {
  BlockStatement,
  Expression,
  FunctionDeclaration,
  Identifier,
  Node,
} from '@babel/types';
import type { BinderContext } from '../context';
import { bindStatementList } from '../walk/bindStatements';
import { resolveExpr } from '../walk/resolveExpr';
import { resolveType } from '../walk/resolveType';
import { declarePattern } from './pattern';
import { withTypeParams } from './type';

export function bindFunctionLike(
  binder: BinderContext,
  params: readonly Node[],
  body: BlockStatement | Expression,
  name?: Identifier | null,
  options?: {
    typeParameters?: Node | null;
    returnType?: Node | null;
  },
) {
  binder.openScope('function');
  if (name) {
    binder.declare('value', name);
  }
  withTypeParams(binder, options?.typeParameters, () => {
    for (const param of params) {
      declarePattern(binder, param);
    }
    resolveType(binder, options?.returnType);
    if (body.type === 'BlockStatement') {
      bindStatementList(binder, body.body);
    } else {
      resolveExpr(binder, body);
    }
  });
  binder.closeScope();
}

export function declareFunction(
  binder: BinderContext,
  statement: FunctionDeclaration,
) {
  if (statement.id && !binder.isBound(statement.id)) {
    binder.declare('value', statement.id);
  }
  bindFunctionLike(binder, statement.params, statement.body, null, {
    typeParameters: statement.typeParameters,
    returnType: statement.returnType,
  });
}
