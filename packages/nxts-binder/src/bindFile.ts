import { BinderContext } from './context';
import type { BindEnv, ParseFileResult } from './types';
import { bindStatementList } from './walk/bindStatements';

export function bindFile(
  file: ParseFileResult,
  env: BindEnv = { symbols: [] },
) {
  const binder = new BinderContext(file);
  if (file.ast != null) {
    if (env.symbols.length > 0) {
      binder.installEnv(env);
    }
    binder.openScope('module');
    bindStatementList(binder, file.ast.program.body);
  }
  return binder.finish();
}
