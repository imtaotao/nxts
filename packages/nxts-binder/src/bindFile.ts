import { BinderContext } from './context';
import type { ParseFileResult } from './types';
import { bindStatementList } from './walk/bindStatements';

export function bindFile(file: ParseFileResult) {
  const binder = new BinderContext(file);
  if (file.ast == null) {
    return binder.finish();
  }

  binder.openScope('module');
  bindStatementList(binder, file.ast.program.body);
  return binder.finish();
}
