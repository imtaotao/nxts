import type { TSEnumDeclaration } from '@babel/types';
import type { BinderContext } from '../context';
import { resolveExpr } from '../walk/resolveExpr';

export function declareEnum(
  binder: BinderContext,
  statement: TSEnumDeclaration,
) {
  if (statement.declare) {
    return;
  }
  if (!binder.isBoundIn(statement.id, 'value')) {
    binder.declare('value', statement.id);
  }
  if (!binder.isBoundIn(statement.id, 'type')) {
    binder.declare('type', statement.id);
  }
  binder.openScope('enum');
  for (const member of statement.body.members) {
    if (member.id.type === 'Identifier') {
      binder.declare('value', member.id);
    }
    if (member.initializer) {
      resolveExpr(binder, member.initializer);
    }
  }
  binder.closeScope();
}
